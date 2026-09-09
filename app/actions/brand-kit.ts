"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { TypeStyle, BrandColor } from "@/lib/brief/types";

// Brand Kit is shared CLIENT DATA — a single JSON Document (templateType
// "brand_kit") per CLIENT: typography + colors + logo links. The central home
// for brand identity, referenced by all of the client's projects.

// Not exported: a "use server" module may only export async functions.
const BRAND_KIT_DOC = "brand_kit";

export type BrandLogo = { id: string; filename: string; url: string; isLink: boolean };
export type BrandKit = {
  typography?: TypeStyle[];
  colors?: BrandColor[];
  logos?: BrandLogo[];
};

async function requireTeam() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (user.user_metadata?.role?.toLowerCase() === "client") throw new Error("Unauthorized");
  return user;
}

async function getDoc(clientId: string) {
  return prisma.document.findFirst({ where: { clientId, templateType: BRAND_KIT_DOC } });
}

export async function getBrandKit(clientId: string): Promise<BrandKit> {
  const doc = await getDoc(clientId);
  return (doc?.content as BrandKit) ?? {};
}

async function mutate(clientId: string, fn: (k: BrandKit) => BrandKit) {
  const existing = await getDoc(clientId);
  const current = (existing?.content as BrandKit) ?? {};
  const next = fn({ ...current });
  const data = { content: next as unknown as Prisma.InputJsonValue };
  if (existing) {
    await prisma.document.update({ where: { id: existing.id }, data });
  } else {
    await prisma.document.create({
      data: { clientId, stageNumber: 1, templateType: BRAND_KIT_DOC, title: "Brand Kit", ...data },
    });
  }
  revalidatePath(`/clients/${clientId}/data`);
}

export async function updateBrandTypography(clientId: string, typography: TypeStyle[]) {
  await requireTeam();
  await mutate(clientId, (k) => ({ ...k, typography }));
  return { ok: true };
}

export async function updateBrandColors(clientId: string, colors: BrandColor[]) {
  await requireTeam();
  await mutate(clientId, (k) => ({ ...k, colors }));
  return { ok: true };
}

// ── Logos (links, stored in the brand_kit JSON — client-level) ──
export async function getBrandLogos(clientId: string): Promise<BrandLogo[]> {
  const kit = await getBrandKit(clientId);
  return kit.logos ?? [];
}

export async function addBrandLogoLink(clientId: string, label: string, url: string) {
  await requireTeam();
  if (!url.trim()) return { error: "URL required" };
  const logo: BrandLogo = {
    id: `logo_${Date.now().toString(36)}`,
    filename: label.trim() || url.trim(),
    url: url.trim(),
    isLink: true,
  };
  await mutate(clientId, (k) => ({ ...k, logos: [logo, ...(k.logos ?? [])] }));
  return { ok: true };
}

export async function deleteBrandLogo(logoId: string, clientId: string) {
  await requireTeam();
  await mutate(clientId, (k) => ({ ...k, logos: (k.logos ?? []).filter((l) => l.id !== logoId) }));
  return { ok: true };
}
