"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { markNotificationsRead, ATTENTION_TYPES } from "@/lib/notifications";

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };

  // Opening the dropdown clears ordinary notifications, but NOT attention items
  // (e.g. client offer questions) — those stay until the question is viewed.
  await markNotificationsRead(user.id, user.role, { excludeTypes: ATTENTION_TYPES });
  // The bell lives in the (team)/(client) layouts — refresh those trees only.
  revalidatePath(user.role === "TEAM" ? "/dashboard" : "/portal", "layout");
  return { ok: true };
}

// Mark a single team notification as seen (e.g. a client response handled from
// the dashboard "From clients" card). Shared team inbox — once one member marks
// it seen it clears for the whole team, so leave it if it isn't yours to handle.
export async function markNotificationSeen(notificationId: string): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user || user.role !== "TEAM") return { ok: false };

  await prisma.notification.updateMany({
    where: { id: notificationId, recipientRole: "TEAM", readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
