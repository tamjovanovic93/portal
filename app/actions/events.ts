"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth/session";
import { EventType } from "@prisma/client";

const EVENT_TYPES = Object.values(EventType);

function parseEventType(value: FormDataEntryValue | null): EventType {
  return EVENT_TYPES.includes(value as EventType) ? (value as EventType) : "APPOINTMENT";
}

async function teamOrError() {
  try {
    return await requireTeam();
  } catch {
    return null;
  }
}

export async function createEvent(formData: FormData) {
  const user = await teamOrError();
  if (!user) return { error: "Unauthorized" };

  const title = (formData.get("title") as string)?.trim();
  const startAtRaw = formData.get("startAt") as string;
  const endAtRaw = formData.get("endAt") as string | null;
  const type = parseEventType(formData.get("type"));
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
  if (!(await teamOrError())) return { error: "Unauthorized" };

  const title = (formData.get("title") as string)?.trim();
  const startAtRaw = formData.get("startAt") as string;
  const endAtRaw = formData.get("endAt") as string | null;
  const type = parseEventType(formData.get("type"));
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
  if (!(await teamOrError())) return { error: "Unauthorized" };

  await prisma.appEvent.delete({ where: { id } });
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { success: true };
}
