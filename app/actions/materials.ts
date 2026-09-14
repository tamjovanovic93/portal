"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth/session";
import { requireProjectAccess } from "@/lib/auth/access";
import { MaterialItemStatus } from "@prisma/client";
import { parseForm } from "@/lib/validation/form";
import { addMaterialSchema, updateMaterialSchema } from "@/lib/validation/schemas";

const MATERIAL_STATUSES = Object.values(MaterialItemStatus);
function parseStatus(value: string | null): MaterialItemStatus | undefined {
  return MATERIAL_STATUSES.includes(value as MaterialItemStatus)
    ? (value as MaterialItemStatus)
    : undefined;
}

async function teamOrError() {
  try {
    await requireTeam();
    return true;
  } catch {
    return false;
  }
}

export async function addMaterialItem(formData: FormData) {
  if (!(await teamOrError())) return { error: "Unauthorized" };

  const parsed = parseForm(addMaterialSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { projectId, label, category, notes, dueDate } = parsed.data;

  await prisma.materialItem.create({
    data: { projectId, label, category, notes, dueDate, status: "pending" },
  });

  revalidatePath(`/projects/${projectId}/materials`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

// Clients may update status on their own project's items; team on any.
export async function updateMaterialStatus(
  itemId: string,
  status: MaterialItemStatus,
  note?: string
) {
  const item = await prisma.materialItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Item not found" };

  await requireProjectAccess(item.projectId);
  const parsed = parseStatus(status);
  if (!parsed) return { error: "Invalid status" };

  await prisma.materialItem.update({
    where: { id: itemId },
    data: {
      status: parsed,
      ...(note !== undefined ? { notes: note } : {}),
    },
  });

  revalidatePath(`/projects/${item.projectId}/materials`);
  revalidatePath(`/projects/${item.projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/portal");
  return { success: true };
}

export async function updateMaterialItem(formData: FormData) {
  if (!(await teamOrError())) return { error: "Unauthorized" };

  const parsed = parseForm(updateMaterialSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { itemId, label, category, notes, dueDate, status } = parsed.data;

  const item = await prisma.materialItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Item not found" };

  await prisma.materialItem.update({
    where: { id: itemId },
    data: { label, category, notes, ...(status ? { status } : {}), dueDate },
  });

  revalidatePath(`/projects/${item.projectId}/materials`);
  revalidatePath(`/projects/${item.projectId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteMaterialItem(itemId: string) {
  if (!(await teamOrError())) return { error: "Unauthorized" };

  const item = await prisma.materialItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Item not found" };

  await prisma.materialItem.delete({ where: { id: itemId } });

  revalidatePath(`/projects/${item.projectId}/materials`);
  revalidatePath(`/projects/${item.projectId}`);
  revalidatePath("/dashboard");
  return { success: true };
}
