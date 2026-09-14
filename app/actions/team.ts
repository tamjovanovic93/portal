"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Team-member management. Team members are TEAM Profiles (the single source of
// truth — see lib/team.ts). Add / edit reuse that structure; "remove" is a safe
// soft-deactivate (active=false) so existing references — approvals, task
// assignments, activity history, brief team refs — are preserved.

const ACCENTS = ["mint", "blue", "amber", "rose", "purple"];

function parseSkills(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function accentOrNull(fd: FormData): string | null {
  const a = str(fd, "accent");
  return a && ACCENTS.includes(a) ? a : null;
}

function availabilityOf(fd: FormData): Prisma.InputJsonValue {
  return {
    hours: str(fd, "availHours"),
    tz: str(fd, "availTz"),
    note: str(fd, "availNote"),
  };
}

// Fields shared by create + edit. Email is create-only (it is the unique key,
// and may back a login), so it is not part of the edit payload.
function profileFieldsFrom(fd: FormData) {
  return {
    name: str(fd, "name") || null,
    title: str(fd, "title") || null,
    skills: parseSkills(fd.get("skills")),
    bio: str(fd, "bio") || null,
    photoUrl: str(fd, "photoUrl") || null,
    accent: accentOrNull(fd),
    availability: availabilityOf(fd),
  };
}

export async function createTeamMember(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  await requireTeam();

  const email = str(formData, "email").toLowerCase();
  if (!email) return { error: "Email is required." };

  const existing = await prisma.profile.findUnique({ where: { email } });
  if (existing) return { error: "A profile with that email already exists." };

  // Provision a real login so the profile id matches auth.users.id. The member
  // sets their password via "Forgot password" on the login page.
  const admin = createAdminClient();
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { role: "TEAM" },
  });
  if (authErr || !created.user) {
    return { error: authErr?.message ?? "Could not create the login for this member." };
  }

  try {
    await prisma.profile.create({
      data: {
        id: created.user.id,
        email,
        role: "TEAM",
        active: true,
        ...profileFieldsFrom(formData),
      },
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

  await prisma.profile.update({
    where: { id },
    data: profileFieldsFrom(formData),
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
  await createAdminClient()
    .auth.admin.updateUserById(id, { ban_duration: "876000h" })
    .catch(() => {});

  revalidatePath("/team");
  revalidatePath("/dashboard");
  return { ok: true };
}
