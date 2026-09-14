"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth/session";
import { removeStorageObjects } from "@/lib/storage";

async function teamOrError() {
  try {
    return await requireTeam();
  } catch {
    return null;
  }
}

export async function toggleAssetVisibility(assetId: string) {
  if (!(await teamOrError())) return { error: "Unauthorized" };

  const asset = await prisma.projectAsset.findUnique({ where: { id: assetId } });
  if (!asset) return { error: "Not found" };

  const next = asset.visibility === "INTERNAL" ? "SHARED" : "INTERNAL";
  await prisma.projectAsset.update({
    where: { id: assetId },
    data: { visibility: next },
  });

  revalidatePath(`/projects/${asset.projectId}/files`);
  revalidatePath(`/projects/${asset.projectId}`);
  revalidatePath("/portal");
  return { success: true };
}

export async function approveAsset(assetId: string) {
  const user = await teamOrError();
  if (!user) return { error: "Unauthorized" };

  const asset = await prisma.projectAsset.findUnique({ where: { id: assetId } });
  if (!asset) return { error: "Not found" };

  await prisma.projectAsset.update({
    where: { id: assetId },
    data: { approvedAt: new Date(), approvedById: user.id },
  });

  revalidatePath(`/projects/${asset.projectId}`);
  return { success: true };
}

export async function deleteAsset(assetId: string) {
  if (!(await teamOrError())) return { error: "Unauthorized" };

  const asset = await prisma.projectAsset.findUnique({ where: { id: assetId } });
  if (!asset) return { error: "Not found" };

  await prisma.projectAsset.delete({ where: { id: assetId } });
  if (asset.mimeType !== "text/uri-list") await removeStorageObjects([asset.storagePath]);

  revalidatePath(`/projects/${asset.projectId}/files`);
  revalidatePath(`/projects/${asset.projectId}`);
  revalidatePath("/portal");
  return { success: true };
}
