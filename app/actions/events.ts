"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { EventType } from "@prisma/client";

export async function createEvent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role?.toLowerCase() === "client") {
    return { error: "Unauthorized" };
  }

  const title = (formData.get("title") as string)?.trim();
  const startAtRaw = formData.get("startAt") as string;
  const endAtRaw = formData.get("endAt") as string | null;
  const type = (formData.get("type") as EventType) ?? "APPOINTMENT";
  const description = (formData.get("description") as string)?.trim() || null;
  const projectId = (formData.get("projectId") as string) || null;
  const allDay = formData.get("allDay") === "true";

  if (!title || !startAtRaw) return { error: "Title and start date are required." };

  await prisma.appEvent.create({
    data: {
      title,
      startAt: new Date(startAtRaw),
      endAt: endAtRaw ? new Date(endAtRaw) : null,
      allDay,
      type,
      description,
      projectId: projectId || null,
      sourceType: "manual",
      createdBy: user.id,
    },
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateEvent(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role?.toLowerCase() === "client") {
    return { error: "Unauthorized" };
  }

  const title = (formData.get("title") as string)?.trim();
  const startAtRaw = formData.get("startAt") as string;
  const endAtRaw = formData.get("endAt") as string | null;
  const type = (formData.get("type") as EventType) ?? "APPOINTMENT";
  const description = (formData.get("description") as string)?.trim() || null;
  const projectId = (formData.get("projectId") as string) || null;
  const allDay = formData.get("allDay") === "true";

  if (!title || !startAtRaw) return { error: "Title and start date are required." };

  await prisma.appEvent.update({
    where: { id },
    data: {
      title,
      startAt: new Date(startAtRaw),
      endAt: endAtRaw ? new Date(endAtRaw) : null,
      allDay,
      type,
      description,
      projectId: projectId || null,
    },
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteEvent(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role?.toLowerCase() === "client") {
    return { error: "Unauthorized" };
  }

  await prisma.appEvent.delete({ where: { id } });
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { success: true };
}
