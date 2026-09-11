"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { markNotificationsRead, ATTENTION_TYPES } from "@/lib/notifications";

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (!profile) return { ok: false };

  // Opening the dropdown clears ordinary notifications, but NOT attention items
  // (e.g. client offer questions) — those stay until the question is viewed.
  await markNotificationsRead(user.id, profile.role, { excludeTypes: ATTENTION_TYPES });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Mark a single team notification as seen (e.g. a client response handled from
// the dashboard "From clients" card). Shared team inbox — once one member marks
// it seen it clears for the whole team, so leave it if it isn't yours to handle.
export async function markNotificationSeen(notificationId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  if (user.user_metadata?.role?.toLowerCase() === "client") return { ok: false };

  await prisma.notification.updateMany({
    where: { id: notificationId, recipientRole: "TEAM", readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  return { ok: true };
}
