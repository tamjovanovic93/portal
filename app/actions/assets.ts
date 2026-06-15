"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "project-assets";

export async function toggleAssetVisibility(assetId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role === "client") return { error: "Unauthorized" };

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role?.toLowerCase() === "client") return { error: "Unauthorized" };

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role === "client") return { error: "Unauthorized" };

  const asset = await prisma.projectAsset.findUnique({ where: { id: assetId } });
  if (!asset) return { error: "Not found" };

  // Delete from storage
  const adminClient = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  await adminClient.storage.from(BUCKET).remove([asset.storagePath]);

  // Delete DB record
  await prisma.projectAsset.delete({ where: { id: assetId } });

  revalidatePath(`/projects/${asset.projectId}/files`);
  revalidatePath(`/projects/${asset.projectId}`);
  revalidatePath("/portal");
  return { success: true };
}
