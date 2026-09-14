"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth/session";
import { parseForm } from "@/lib/validation/form";
import { eventSchema } from "@/lib/validation/schemas";

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

  const parsed = parseForm(eventSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { title, startAt, endAt, type, description, projectId, allDay } = parsed.data;

  await prisma.appEvent.create({
    data: {
      title,
      startAt,
      endAt,
      allDay,
      type,
      description,
      projectId,
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

  const parsed = parseForm(eventSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { title, startAt, endAt, type, description, projectId, allDay } = parsed.data;

  await prisma.appEvent.update({
    where: { id },
    data: { title, startAt, endAt, allDay, type, description, projectId },
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
