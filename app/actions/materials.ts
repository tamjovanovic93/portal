"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { MaterialItemStatus } from "@prisma/client";

const MATERIAL_STATUSES = Object.values(MaterialItemStatus);
function parseStatus(value: string | null): MaterialItemStatus | undefined {
  return MATERIAL_STATUSES.includes(value as MaterialItemStatus)
    ? (value as MaterialItemStatus)
    : undefined;
}

async function assertTeam() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role === "client") {
    throw new Error("Unauthorized");
  }
  return user;
}

async function assertOwnsProject(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  if (user.user_metadata?.role !== "client") return user; // team can access any

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.clientId !== user.id) throw new Error("Unauthorized");
  return user;
}

export async function addMaterialItem(formData: FormData) {
  await assertTeam();

  const projectId = formData.get("projectId") as string;
  const label = (formData.get("label") as string)?.trim();
  const category = formData.get("category") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const dueDateRaw = formData.get("dueDate") as string;

  if (!projectId || !label || !category) {
    return { error: "Label and category are required." };
  }

  await prisma.materialItem.create({
    data: {
      projectId,
      label,
      category,
      notes,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      status: "pending",
    },
  });

  revalidatePath(`/projects/${projectId}/materials`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateMaterialStatus(
  itemId: string,
  status: MaterialItemStatus,
  note?: string
) {
  const item = await prisma.materialItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Item not found" };

  await assertOwnsProject(item.projectId);

  await prisma.materialItem.update({
    where: { id: itemId },
    data: {
      status,
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
  await assertTeam();

  const itemId = formData.get("itemId") as string;
  const label = (formData.get("label") as string)?.trim();
  const category = formData.get("category") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const dueDateRaw = formData.get("dueDate") as string;
  const status = parseStatus(formData.get("status") as string | null);

  const item = await prisma.materialItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Item not found" };

  await prisma.materialItem.update({
    where: { id: itemId },
    data: {
      label,
      category,
      notes,
      ...(status ? { status } : {}),
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
    },
  });

  revalidatePath(`/projects/${item.projectId}/materials`);
  revalidatePath(`/projects/${item.projectId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteMaterialItem(itemId: string) {
  await assertTeam();

  const item = await prisma.materialItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Item not found" };

  await prisma.materialItem.delete({ where: { id: itemId } });

  revalidatePath(`/projects/${item.projectId}/materials`);
  revalidatePath(`/projects/${item.projectId}`);
  revalidatePath("/dashboard");
  return { success: true };
}
