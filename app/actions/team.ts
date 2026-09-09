"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// Team-member management. Team members are TEAM Profiles (the single source of
// truth — see lib/team.ts). Add / edit reuse that structure; "remove" is a safe
// soft-deactivate (active=false) so existing references — approvals, task
// assignments, activity history, brief team refs — are preserved.

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

  await prisma.profile.create({
    data: {
      id: crypto.randomUUID(), // non-login team member; a login can be attached later
      email,
      role: "TEAM",
      active: true,
      ...profileFieldsFrom(formData),
    },
  });

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

  revalidatePath("/team");
  revalidatePath("/dashboard");
  return { ok: true };
}
