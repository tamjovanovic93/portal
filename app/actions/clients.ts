"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// Client-first creation. A Client no longer needs an initial Project — intake and
// Client Data happen at the Client level (Projects come later, from approved
// suggestions). Creating a client provisions the login and seeds the first
// onboarding document (the Initial Client Form) scoped to the client.

async function requireTeam() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role?.toLowerCase() === "client") {
    throw new Error("Unauthorized");
  }
  return user;
}

function createAdminClient() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient: create } = require("@supabase/supabase-js");
  return create(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function createClientAccount(formData: FormData) {
  await requireTeam();

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const name = (formData.get("name") as string)?.trim() || null;
  if (!email) return { error: "Client email is required." };

  // Reuse an existing profile with this email, otherwise provision a login.
  let clientProfile = await prisma.profile.findUnique({ where: { email } });
  if (clientProfile && clientProfile.role !== "CLIENT") {
    return { error: "That email already belongs to a team member." };
  }

  if (!clientProfile) {
    const adminSupabase = createAdminClient();
    const { data: userData, error: userError } =
      await adminSupabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { role: "CLIENT" },
      });
    if (userError) {
      console.error("createClientAccount: create user error", JSON.stringify(userError));
      return { error: userError.message };
    }
    clientProfile = await prisma.profile.upsert({
      where: { id: userData.user.id },
      update: {},
      create: { id: userData.user.id, email, name, role: "CLIENT" },
    });
  } else if (name && !clientProfile.name) {
    clientProfile = await prisma.profile.update({
      where: { id: clientProfile.id },
      data: { name },
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
  redirect(`/clients/${clientProfile.id}`);
}
