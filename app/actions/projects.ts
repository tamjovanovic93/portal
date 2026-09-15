"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, requireTeam } from "@/lib/auth/session";
import { generateTempPassword } from "@/lib/auth/passwords";
import { removeStorageObjects } from "@/lib/storage";
import { parseForm } from "@/lib/validation/form";
import { createProjectSchema } from "@/lib/validation/schemas";
import { STAGE_COUNT } from "@/lib/stages";

async function teamOrError() {
  const user = await getSessionUser();
  return user?.role === "TEAM" ? user : null;
}

export async function createProject(formData: FormData) {
  if (!(await teamOrError())) return { error: "Unauthorized" };

  const parsed = parseForm(createProjectSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { name, clientChoice, existingClientId, clientEmail, type, mode } = parsed.data;

  // Resolve the client: an existing profile, or a newly-created one.
  let clientProfile;
  if (clientChoice === "existing") {
    if (!existingClientId) return { error: "Select an existing client." };
    clientProfile = await prisma.profile.findUnique({ where: { id: existingClientId } });
    if (!clientProfile) return { error: "Selected client not found." };
  } else {
    if (!clientEmail) return { error: "Client email is required for a new client." };
    clientProfile = await prisma.profile.findUnique({ where: { email: clientEmail } });
    if (!clientProfile) {
      // Create the client user via Supabase Auth admin API
      const adminSupabase = await createAdminClient();
      const { data: userData, error: userError } =
        await adminSupabase.auth.admin.createUser({
          email: clientEmail,
          email_confirm: true,
          app_metadata: { role: "CLIENT" },
        });

      if (userError) {
        console.error("Create user error:", JSON.stringify(userError));
        return { error: userError.message };
      }

      // Create profile row directly (bypass trigger race conditions)
      clientProfile = await prisma.profile.upsert({
        where: { id: userData.user.id },
        update: {},
        create: {
          id: userData.user.id,
          email: clientEmail,
          role: "CLIENT",
        },
      });
    }
  }

  const project = await prisma.project.create({
    data: {
      name,
      clientId: clientProfile.id,
      type,
      mode,
      currentStage: 1,
      // Projects begin at Strategy (stage 1). Client intake / discovery happens
      // at the client level before the project exists — see lib/stages.ts.
      stages: {
        create: Array.from({ length: STAGE_COUNT }, (_, i) => ({
          stageNumber: i + 1,
          status: i === 0 ? "IN_PROGRESS" : "NOT_STARTED",
        })),
      },
    },
  });

  // Onboarding (initial form / offer / intake) now happens at the CLIENT level
  // before a project exists, so it is NOT created here. Every project still gets
  // its single Brief (Client Data lives on the client and is shared/reused).
  await prisma.document.create({
    data: {
      projectId: project.id,
      stageNumber: 1,
      templateType: "project_brief",
      title: "Project Brief",
      content: { name: "Project Brief" },
      status: "DRAFT",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/clients/${clientProfile.id}`);
  redirect(`/projects/${project.id}`);
}

// Team members can create projects for existing clients — list them for the picker.
export async function listClients() {
  return prisma.profile.findMany({
    where: { role: "CLIENT" },
    select: { id: true, name: true, email: true },
    orderBy: { email: "asc" },
  });
}

export async function archiveProject(id: string) {
  if (!(await teamOrError())) return { error: "Unauthorized" };
  await prisma.project.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function restoreProject(id: string) {
  if (!(await teamOrError())) return { error: "Unauthorized" };
  await prisma.project.update({ where: { id }, data: { isArchived: false } });
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function deleteProject(id: string) {
  if (!(await teamOrError())) return { error: "Unauthorized" };

  const project = await prisma.project.findUnique({
    where: { id },
    select: { clientId: true },
  });

  // Storage objects are not cascaded by the DB — collect paths before deleting.
  const assetPaths = (
    await prisma.projectAsset.findMany({
      where: { projectId: id, mimeType: { not: "text/uri-list" } },
      select: { storagePath: true },
    })
  ).map((a) => a.storagePath);

  // app_events.project_id and activity_log.project_id are ON DELETE SET NULL, so
  // a plain delete would leave the project's calendar events and activity behind
  // (still visible on the dashboard/calendar). Remove them first, in one tx.
  await prisma.$transaction(async (tx) => {
    await tx.appEvent.deleteMany({ where: { projectId: id } });
    await tx.activityLog.deleteMany({ where: { projectId: id } });
    await tx.project.delete({ where: { id } });
  });

  await removeStorageObjects(assetPaths);

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  if (project) revalidatePath(`/clients/${project.clientId}`);
}

// Permanently delete a Client (a Profile with role CLIENT) and everything that
// cannot meaningfully exist without them. A client's Projects reference the
// profile with ON DELETE RESTRICT, so the projects must be removed first; the
// remaining project-scoped records (stages, documents, approvals, assets,
// materials, cycles → tasks → approvals, notifications, questions) then cascade.
// The client's shared Client Data documents and their notifications cascade when
// the profile itself is deleted. Team-member profiles are never touched.
export async function deleteClient(clientId: string) {
  if (!(await teamOrError())) return { error: "Unauthorized" };

  const client = await prisma.profile.findUnique({
    where: { id: clientId },
    select: { id: true, role: true },
  });
  if (!client) return { error: "Client not found." };
  if (client.role !== "CLIENT") {
    return { error: "Only clients can be deleted here." };
  }

  const projects = await prisma.project.findMany({
    where: { clientId },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);

  // Client-scoped documents (projectId null) — used to purge lingering TEAM
  // notifications that link to them (those have no projectId/recipientId, so they
  // don't cascade when the profile is deleted and would otherwise stay on the
  // dashboard/bell forever pointing at a deleted client).
  const clientDocs = await prisma.document.findMany({
    where: { clientId, projectId: null },
    select: { id: true },
  });
  const clientDocIds = clientDocs.map((d) => d.id);

  const assetPaths =
    projectIds.length > 0
      ? (
          await prisma.projectAsset.findMany({
            where: { projectId: { in: projectIds }, mimeType: { not: "text/uri-list" } },
            select: { storagePath: true },
          })
        ).map((a) => a.storagePath)
      : [];

  // One transaction: any failure rolls back so the client is never left in a
  // half-deleted state.
  await prisma.$transaction(async (tx) => {
    if (projectIds.length > 0) {
      // app_events.project_id and activity_log.project_id are ON DELETE SET NULL,
      // so deleting the projects would leave these rows orphaned. Remove the
      // client's project-scoped ones explicitly first.
      await tx.appEvent.deleteMany({ where: { projectId: { in: projectIds } } });
      await tx.activityLog.deleteMany({ where: { projectId: { in: projectIds } } });
      // Deleting the projects cascades stages, project documents, approvals,
      // assets, materials, cycles → tasks → approvals, notifications and questions.
      await tx.project.deleteMany({ where: { id: { in: projectIds } } });
    }
    // Purge team notifications about this client's client-level docs/onboarding
    // (projectId null → not covered by any cascade).
    if (clientDocIds.length > 0) {
      await tx.notification.deleteMany({
        where: {
          recipientRole: "TEAM",
          projectId: null,
          OR: clientDocIds.map((docId) => ({ link: { contains: docId } })),
        },
      });
    }
    // Cascades the shared Client Data documents (client_profile /
    // verification_queue / strategy / brand_kit) and the client's notifications.
    await tx.profile.delete({ where: { id: clientId } });
  });

  await removeStorageObjects(assetPaths);

  // Remove the client's Supabase Auth login so no orphaned auth user remains and
  // the email can be reused. Best-effort — the data is already gone by here.
  try {
    const adminSupabase = await createAdminClient();
    await adminSupabase.auth.admin.deleteUser(clientId);
  } catch (err) {
    console.error("deleteClient: auth user cleanup failed", err);
  }

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/calendar");
  redirect("/clients");
}

export async function generateClientAccess(
  projectId: string
): Promise<{ email?: string; password?: string; error?: string }> {
  try {
    await requireTeam();
  } catch {
    return { error: "Unauthorized" };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: { select: { email: true } } },
  });
  if (!project) return { error: "Project not found" };

  const email = project.client.email;
  const adminSupabase = await createAdminClient();

  // Ensure the Supabase auth user exists (reuse existing profile UUID to avoid trigger conflicts)
  const existingProfile = await prisma.profile.findUnique({
    where: { email },
    select: { id: true },
  });

  let authUserId: string | null = null;

  // Try a no-op update to check if the user exists; if not, create them
  if (existingProfile) {
    const { data: existing } = await adminSupabase.auth.admin.getUserById(
      existingProfile.id
    );
    if (existing?.user) {
      authUserId = existing.user.id;
    }
  }

  if (!authUserId) {
    const { data: newUserData, error: createError } =
      await adminSupabase.auth.admin.createUser({
        ...(existingProfile ? { id: existingProfile.id } : {}),
        email,
        email_confirm: true,
        app_metadata: { role: "CLIENT" },
      });
    if (createError) return { error: createError.message };
    authUserId = newUserData.user?.id ?? null;
    if (!authUserId) return { error: "Failed to create the client's login." };

    await prisma.profile.upsert({
      where: { id: authUserId },
      update: {},
      create: { id: authUserId, email, role: "CLIENT" },
    });

    if (!existingProfile) {
      // No profile existed for this email: point the project at the one we
      // just created.
      await prisma.project.update({
        where: { id: projectId },
        data: { clientId: authUserId },
      });
    } else if (existingProfile.id !== authUserId) {
      // A profile exists but the new login got a different id. Silently
      // re-pointing the project here would orphan that profile's documents,
      // tasks and approvals. Fail instead and let a human reconcile it.
      await adminSupabase.auth.admin.deleteUser(authUserId).catch(() => {});
      return {
        error:
          "This client's profile and login have different ids. Reconcile them " +
          "before generating access.",
      };
    }
  }

  // Set a temporary password the client can use to log in immediately
  const tempPassword = generateTempPassword();

  const { error: pwError } = await adminSupabase.auth.admin.updateUserById(
    authUserId,
    { password: tempPassword }
  );
  if (pwError) return { error: pwError.message };

  return { email, password: tempPassword };
}
