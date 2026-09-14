import { prisma } from "@/lib/prisma";
import type { Prisma, UserRole } from "@prisma/client";
import { ATTENTION_TYPES, type NotificationType } from "./notification-types";

export { ATTENTION_TYPES, NOTIFICATION_TYPES, FEED_NOTIFICATION_TYPES } from "./notification-types";
export type { NotificationType } from "./notification-types";

// ─── In-app notifications ────────────────────────────────────────────────────
//
// A client notification targets a specific profile (recipientId). A team
// notification is fanned out to every active team member as its own row
// (recipientId = member, recipientRole = TEAM) so each person has their own
// read state. Legacy rows (recipientId null, recipientRole TEAM) are still
// read until scripts/p4-fanout-legacy-notifications.mjs has run.

type NotifyInput = {
  projectId?: string;
  type: NotificationType | string;
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
  try {
    if ("toProfileId" in input) {
      await prisma.notification.create({ data: { ...base, recipientId: input.toProfileId } });
      return;
    }
    if (input.toRole === "TEAM") {
      const members = await prisma.profile.findMany({
        where: { role: "TEAM", active: true },
        select: { id: true },
      });
      const rows: Prisma.NotificationCreateManyInput[] = members.map((m) => ({
        ...base,
        recipientId: m.id,
        recipientRole: "TEAM",
      }));
      if (rows.length > 0) await prisma.notification.createMany({ data: rows });
      return;
    }
    await prisma.notification.create({ data: { ...base, recipientRole: input.toRole } });
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

// Rows visible to a user: their own, plus (for team members) legacy shared rows.
function recipientFilter(userId: string, role: UserRole): Prisma.NotificationWhereInput {
  return role === "TEAM"
    ? { OR: [{ recipientId: userId }, { recipientId: null, recipientRole: "TEAM" }] }
    : { recipientId: userId };
}

export async function listNotifications(userId: string, role: UserRole, take = 20) {
  return prisma.notification.findMany({
    where: recipientFilter(userId, role),
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function unreadCount(userId: string, role: UserRole): Promise<number> {
  return prisma.notification.count({
    where: { readAt: null, ...recipientFilter(userId, role) },
  });
}

export async function markNotificationsRead(
  userId: string,
  role: UserRole,
  opts?: { excludeTypes?: readonly string[] }
): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      readAt: null,
      ...(opts?.excludeTypes?.length ? { type: { notIn: [...opts.excludeTypes] } } : {}),
      ...recipientFilter(userId, role),
    },
    data: { readAt: new Date() },
  });
}

// Mark one of the user's own notifications as seen.
export async function markNotificationSeen(userId: string, role: UserRole, notificationId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, readAt: null, ...recipientFilter(userId, role) },
    data: { readAt: new Date() },
  });
}

export { ATTENTION_TYPES as attentionTypes };
