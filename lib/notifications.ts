import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

// ─── In-app notifications ────────────────────────────────────────────────────
//
// A client notification targets a specific profile (recipientId). A team
// notification targets everyone on the team (recipientRole = "TEAM"). Written
// by server actions at each onboarding hand-off; read by components/Notifications.

type NotifyInput = {
  projectId?: string;
  type: string;
  message: string;
  link?: string;
} & ({ toProfileId: string } | { toRole: UserRole });

export async function notify(input: NotifyInput): Promise<void> {
  const base = {
    projectId: input.projectId ?? null,
    type: input.type,
    message: input.message,
    link: input.link ?? null,
  };
  const target =
    "toProfileId" in input
      ? { recipientId: input.toProfileId }
      : { recipientRole: input.toRole };
  try {
    await prisma.notification.create({ data: { ...base, ...target } });
  } catch (err) {
    // Notifications are best-effort — never let a failed insert break the
    // action that triggered it.
    console.error("notify failed:", err);
  }
}

// Notify the whole team.
export function notifyTeam(input: Omit<NotifyInput, "toProfileId" | "toRole">) {
  return notify({ ...input, toRole: "TEAM" });
}

// Notify a specific client.
export function notifyClient(
  toProfileId: string,
  input: Omit<NotifyInput, "toProfileId" | "toRole">
) {
  return notify({ ...input, toProfileId });
}

// List notifications for a user by their role. Team members see all TEAM
// notifications; clients see their own.
export async function listNotifications(userId: string, role: UserRole, take = 20) {
  return prisma.notification.findMany({
    where: role === "TEAM" ? { recipientRole: "TEAM" } : { recipientId: userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function unreadCount(userId: string, role: UserRole): Promise<number> {
  return prisma.notification.count({
    where: {
      readAt: null,
      ...(role === "TEAM" ? { recipientRole: "TEAM" } : { recipientId: userId }),
    },
  });
}

export async function markNotificationsRead(userId: string, role: UserRole): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      readAt: null,
      ...(role === "TEAM" ? { recipientRole: "TEAM" } : { recipientId: userId }),
    },
    data: { readAt: new Date() },
  });
}
