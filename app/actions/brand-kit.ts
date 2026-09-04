"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { TypeStyle, BrandColor } from "@/lib/brief/types";

// Brand Kit lives under Data as a single JSON Document (templateType "brand_kit")
// per project: typography + colors. Logo files are ProjectAsset rows (folder
// "brand"). This is the central home for brand identity — never duplicated in
// individual briefs.

// Not exported: a "use server" module may only export async functions.
const BRAND_KIT_DOC = "brand_kit";

export type BrandKit = {
  typography?: TypeStyle[];
  colors?: BrandColor[];
};

async function requireTeam() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (user.user_metadata?.role?.toLowerCase() === "client") throw new Error("Unauthorized");
  return user;
}

async function getDoc(projectId: string) {
  return prisma.document.findFirst({ where: { projectId, templateType: BRAND_KIT_DOC } });
}

export async function getBrandKit(projectId: string): Promise<BrandKit> {
  const doc = await getDoc(projectId);
  return (doc?.content as BrandKit) ?? {};
}

async function mutate(projectId: string, fn: (k: BrandKit) => BrandKit) {
  const existing = await getDoc(projectId);
  const current = (existing?.content as BrandKit) ?? {};
  const next = fn({ ...current });
  const data = { content: next as unknown as Prisma.InputJsonValue };
  if (existing) {
    await prisma.document.update({ where: { id: existing.id }, data });
  } else {
    await prisma.document.create({
      data: { projectId, stageNumber: 1, templateType: BRAND_KIT_DOC, title: "Brand Kit", ...data },
    });
  }
  revalidatePath(`/projects/${projectId}/brief`);
}

export async function updateBrandTypography(projectId: string, typography: TypeStyle[]) {
  await requireTeam();
  await mutate(projectId, (k) => ({ ...k, typography }));
  return { ok: true };
}

export async function updateBrandColors(projectId: string, colors: BrandColor[]) {
  await requireTeam();
  await mutate(projectId, (k) => ({ ...k, colors }));
  return { ok: true };
}

// ── Logo assets (ProjectAsset, folder "brand") ──
export async function getBrandLogos(projectId: string) {
  const rows = await prisma.projectAsset.findMany({
    where: { projectId, folder: "brand" },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, filename: true, storagePath: true, mimeType: true },
  });
  return rows.map((r) => ({ id: r.id, filename: r.filename, url: r.storagePath, isLink: r.mimeType === "text/uri-list" }));
}

export async function addBrandLogoLink(projectId: string, label: string, url: string) {
  const user = await requireTeam();
  if (!url.trim()) return { error: "URL required" };
  await prisma.projectAsset.create({
    data: {
      projectId,
      storagePath: url.trim(),
      filename: label.trim() || url.trim(),
      mimeType: "text/uri-list",
      folder: "brand",
      visibility: "SHARED",
      uploadedBy: user.id,
    },
  });
  revalidatePath(`/projects/${projectId}/brief`);
  return { ok: true };
}

export async function deleteBrandLogo(assetId: string, projectId: string) {
  await requireTeam();
  await prisma.projectAsset.delete({ where: { id: assetId } });
  revalidatePath(`/projects/${projectId}/brief`);
  return { ok: true };
}
