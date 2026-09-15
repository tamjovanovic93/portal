"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseForm } from "@/lib/validation/form";
import { teamMemberSchema } from "@/lib/validation/schemas";

// Team-member management. Team members are TEAM Profiles (the single source of
// truth — see lib/team.ts). Add / edit reuse that structure; "remove" is a safe
// soft-deactivate (active=false) so existing references — approvals, task
// assignments, activity history, brief team refs — are preserved.

type MemberInput = z.infer<typeof teamMemberSchema>;

// Fields shared by create + edit. Email is create-only (it is the unique key,
// and backs the login), so it is not part of the edit payload.
function profileFieldsFrom(d: MemberInput) {
  return {
    name: d.name,
    title: d.title,
    skills: d.skills,
    bio: d.bio,
    photoUrl: d.photoUrl,
    accent: d.accent ?? null,
    availability: { hours: d.availHours, tz: d.availTz, note: d.availNote } as Prisma.InputJsonValue,
  };
}

export async function createTeamMember(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  await requireTeam();

  const parsed = parseForm(teamMemberSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const email = parsed.data.email;
  if (!email) return { error: "Email is required." };

  const existing = await prisma.profile.findUnique({ where: { email } });
  if (existing) return { error: "A profile with that email already exists." };

  // Provision a real login so the profile id matches auth.users.id. The member
  // sets their password via "Forgot password" on the login page.
  const admin = await createAdminClient();
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { role: "TEAM" },
  });
  if (authErr || !created.user) {
    return { error: authErr?.message ?? "Could not create the login for this member." };
  }

  try {
    // The auth trigger may already have inserted a bare row for this id, so
    // fill it in rather than colliding on the primary key.
    const fields = { email, role: "TEAM" as const, active: true, ...profileFieldsFrom(parsed.data) };
    await prisma.profile.upsert({
      where: { id: created.user.id },
      update: fields,
      create: { id: created.user.id, ...fields },
    });
  } catch (err) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    throw err;
  }

  revalidatePath("/team");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateTeamMember(
  id: string,
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  await requireTeam();

  const member = await prisma.profile.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!member || member.role !== "TEAM") return { error: "Team member not found." };

  const parsed = parseForm(teamMemberSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  await prisma.profile.update({
    where: { id },
    data: profileFieldsFrom(parsed.data),
  });

  revalidatePath("/team");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Safe remove: deactivate. getRoster()/getTeamData() filter active:true, so the
// member immediately disappears from every roster/selector while all their
// historical references stay intact.
export async function deactivateTeamMember(
  id: string
): Promise<{ ok?: boolean; error?: string }> {
  await requireTeam();

  const member = await prisma.profile.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!member || member.role !== "TEAM") return { error: "Team member not found." };

  await prisma.profile.update({ where: { id }, data: { active: false } });

  // Best-effort: block the login too (no auth user exists for legacy members).
  const adminForBan = await createAdminClient();
  await adminForBan.auth.admin
    .updateUserById(id, { ban_duration: "876000h" })
    .catch(() => {});

  revalidatePath("/team");
  revalidatePath("/dashboard");
  return { ok: true };
}
