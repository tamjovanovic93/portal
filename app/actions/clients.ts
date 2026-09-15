"use server";

import { revalidatePath } from "next/cache";
import { Prisma, ProjectMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeam } from "@/lib/auth/session";
import { generateTempPassword } from "@/lib/auth/passwords";
import { parseForm } from "@/lib/validation/form";
import { createClientSchema } from "@/lib/validation/schemas";

// Client-first creation. A Client no longer needs an initial Project — intake and
// Client Data happen at the Client level (Projects come later, from approved
// suggestions). Creating a client provisions the login and seeds the first
// onboarding document (the Initial Client Form) scoped to the client.

// Create a client from just business name + email + mode. A login is provisioned
// with a temporary password (returned once so the team can hand it to the client)
// and the Initial Client Form is seeded. No project/type is chosen here — projects
// come later from agent suggestions. Returns { clientId, tempPassword } on success.
export async function createClientAccount(
  formData: FormData
): Promise<{ clientId?: string; tempPassword?: string; error?: string }> {
  await requireTeam();

  const parsed = parseForm(createClientSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { name, email } = parsed.data;
  const mode: ProjectMode = parsed.data.mode;

  // Reuse an existing profile with this email, otherwise provision a login.
  let clientProfile = await prisma.profile.findUnique({ where: { email } });
  if (clientProfile && clientProfile.role !== "CLIENT") {
    return { error: "That email already belongs to a team member." };
  }

  let tempPassword: string | undefined;
  if (!clientProfile) {
    tempPassword = generateTempPassword();
    const adminSupabase = await createAdminClient();
    const { data: userData, error: userError } =
      await adminSupabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        app_metadata: { role: "CLIENT" },
      });
    if (userError) {
      console.error("createClientAccount: create user error", JSON.stringify(userError));
      return { error: userError.message };
    }
    try {
      clientProfile = await prisma.profile.upsert({
        where: { id: userData.user.id },
        update: {},
        create: { id: userData.user.id, email, name, role: "CLIENT", clientMode: mode },
      });
    } catch (err) {
      // Compensate: don't leave an auth user without a profile.
      await adminSupabase.auth.admin.deleteUser(userData.user.id).catch(() => {});
      throw err;
    }
  } else {
    clientProfile = await prisma.profile.update({
      where: { id: clientProfile.id },
      data: { name: name ?? clientProfile.name, clientMode: mode },
    });
  }

  // Seed the client-level Initial Client Form (onboarding step 1) as a DRAFT the
  // team can pre-fill before sending. projectId is null — this is client-scoped.
  const existingInitial = await prisma.document.findFirst({
    where: { clientId: clientProfile.id, templateType: "initial_client_form" },
  });
  if (!existingInitial) {
    await prisma.document.create({
      data: {
        clientId: clientProfile.id,
        stageNumber: 1,
        templateType: "initial_client_form",
        title: "Initial Client Form",
        content: {} as Prisma.InputJsonValue,
        status: "DRAFT",
      },
    });
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientProfile.id}`);
  return { clientId: clientProfile.id, tempPassword };
}

// Edit a client's business name and/or email after creation. An email change is
// applied to both the Supabase auth login and the Profile row.
export async function updateClient(
  clientId: string,
  input: { name?: string; email?: string }
): Promise<{ ok?: boolean; error?: string }> {
  await requireTeam();
  const client = await prisma.profile.findUnique({ where: { id: clientId } });
  if (!client || client.role !== "CLIENT") return { error: "Client not found." };

  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (name !== undefined && !name) return { error: "Business name cannot be empty." };

  if (email && email !== client.email) {
    const clash = await prisma.profile.findUnique({ where: { email } });
    if (clash && clash.id !== clientId) return { error: "That email is already in use." };
    const adminSupabase = await createAdminClient();
    const { error: authErr } = await adminSupabase.auth.admin.updateUserById(clientId, {
      email,
      email_confirm: true,
    });
    if (authErr) return { error: authErr.message };
  }

  await prisma.profile.update({
    where: { id: clientId },
    data: {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
    },
  });
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

// Generate a fresh temporary password for an existing client and return it once
// (shown in the Client Stream). Covers lost-password hand-offs.
export async function resetClientPassword(
  clientId: string
): Promise<{ email?: string; tempPassword?: string; error?: string }> {
  await requireTeam();
  const client = await prisma.profile.findUnique({
    where: { id: clientId },
    select: { email: true, role: true },
  });
  if (!client || client.role !== "CLIENT") return { error: "Client not found." };
  const tempPassword = generateTempPassword();
  const adminSupabase = await createAdminClient();
  const { error: authErr } = await adminSupabase.auth.admin.updateUserById(clientId, {
    password: tempPassword,
  });
  if (authErr) return { error: authErr.message };
  return { email: client.email, tempPassword };
}
