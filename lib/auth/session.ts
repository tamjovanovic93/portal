import { cache } from "react";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
};

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

// The role comes from profiles.role — the only trusted source. Supabase
// user_metadata is editable by the user and must never drive authorization.
// React.cache dedupes this across layout, bell, page and actions in one request.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { email: true, role: true, active: true },
  });
  if (!profile || !profile.active) return null;

  return { id: user.id, email: profile.email, role: profile.role };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireTeam(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "TEAM") throw new UnauthorizedError();
  return user;
}

export function isTeam(user: SessionUser | null): user is SessionUser & { role: "TEAM" } {
  return user?.role === "TEAM";
}

export function homeFor(role: UserRole | null | undefined): string {
  return role === "CLIENT" ? "/portal" : "/dashboard";
}
