"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ProjectMode, ProjectType } from "@prisma/client";

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role === "client") {
    return { error: "Unauthorized" };
  }

  const name = (formData.get("name") as string)?.trim();
  const clientChoice = (formData.get("clientChoice") as string) ?? "new";
  const existingClientId = (formData.get("existingClientId") as string)?.trim();
  const clientEmail = (formData.get("clientEmail") as string)?.trim().toLowerCase();
  const type = formData.get("type") as ProjectType;
  const mode = (formData.get("mode") as ProjectMode) ?? "PROJECT";

  if (!name || !type) {
    return { error: "Project name and type are required." };
  }

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
      const adminSupabase = createAdminClient();
      const { data: userData, error: userError } =
        await adminSupabase.auth.admin.createUser({
          email: clientEmail,
          email_confirm: true,
          user_metadata: { role: "CLIENT" },
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
      onboardingStep: "initial_form",
      // Both project and retainer engagements track the 8-stage progression.
      stages: {
        create: Array.from({ length: 8 }, (_, i) => ({
          stageNumber: i + 1,
          status: i === 0 ? "IN_PROGRESS" : "NOT_STARTED",
        })),
      },
    },
  });

  // New onboarding flow: create the Initial Client Form as a DRAFT so the team
  // can pre-fill it and review before sending it to the client. The full intake
  // form comes later, after the offer is approved.
  await prisma.document.create({
    data: {
      projectId: project.id,
      stageNumber: 1,
      templateType: "initial_client_form",
      title: "Initial Client Form",
      content: {},
      status: "DRAFT",
    },
  });

  revalidatePath("/dashboard");
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role?.toLowerCase() === "client") {
    return { error: "Unauthorized" };
  }
  await prisma.project.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function restoreProject(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role?.toLowerCase() === "client") {
    return { error: "Unauthorized" };
  }
  await prisma.project.update({ where: { id }, data: { isArchived: false } });
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function deleteProject(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role?.toLowerCase() === "client") {
    return { error: "Unauthorized" };
  }
  await prisma.project.delete({ where: { id } });
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function generateClientAccess(
  projectId: string
): Promise<{ email?: string; password?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role?.toLowerCase() === "client") {
    return { error: "Unauthorized" };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: { select: { email: true } } },
  });
  if (!project) return { error: "Project not found" };

  const email = project.client.email;
  const adminSupabase = createAdminClient();

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
        user_metadata: { role: "CLIENT" },
      });
    if (createError) return { error: createError.message };
    authUserId = newUserData.user?.id ?? null;
    if (!authUserId) return { error: "Failed to create the client's login." };

    await prisma.profile.upsert({
      where: { id: authUserId },
      update: {},
      create: { id: authUserId, email, role: "CLIENT" },
    });

    if (!existingProfile || existingProfile.id !== authUserId) {
      await prisma.project.update({
        where: { id: projectId },
        data: { clientId: authUserId },
      });
    }
  }

  // Set a temporary password the client can use to log in immediately
  const tempPassword =
    Math.random().toString(36).slice(2, 8).toUpperCase() +
    Math.random().toString(36).slice(2, 8) +
    "1!";

  const { error: pwError } = await adminSupabase.auth.admin.updateUserById(
    authUserId,
    { password: tempPassword }
  );
  if (pwError) return { error: pwError.message };

  return { email, password: tempPassword };
}

function createAdminClient() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient: create } = require("@supabase/supabase-js");
  return create(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
