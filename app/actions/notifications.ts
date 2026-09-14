"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { markNotificationsRead, markNotificationSeen as markSeen, ATTENTION_TYPES } from "@/lib/notifications";

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

// Mark a single notification as seen for the current user only (each team
// member has their own copy).
export async function markNotificationSeen(notificationId: string): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };

  await markSeen(user.id, user.role, notificationId);
  revalidatePath(user.role === "TEAM" ? "/dashboard" : "/portal", "layout");
  return { ok: true };
}
