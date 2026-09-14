// One-off migration: move Client Data from projects to the client level.
//
// - client_profile / verification_queue / strategy / brand_kit Documents were
//   keyed by projectId; re-key them to the parent client (clientId set,
//   projectId null). One canonical doc per (client, type) — newest wins; any
//   extras (multi-project clients) are LEFT IN PLACE, never deleted.
// - Brand logo ProjectAssets (folder "brand") are copied into the client's
//   brand_kit JSON (logos[]). The asset rows are left untouched.
// - Every project gets exactly one project_brief (create if missing; if a
//   project somehow has several, the oldest is canonical and extras are left).
//
// Safe to run more than once (idempotent-ish): already-migrated client-level
// docs are skipped.

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const CLIENT_LEVEL = ["client_profile", "verification_queue", "strategy", "brand_kit"];

function contentScore(c) {
  // crude "completeness" — prefer the doc with more keys / items.
  try { return JSON.stringify(c ?? {}).length; } catch { return 0; }
}

async function migrateClientLevelDocs() {
  for (const templateType of CLIENT_LEVEL) {
    const docs = await prisma.document.findMany({
      where: { templateType, projectId: { not: null }, clientId: null },
      include: { project: { select: { clientId: true } } },
    });
    // Group by client.
    const byClient = new Map();
    for (const d of docs) {
      const clientId = d.project?.clientId;
      if (!clientId) continue;
      const arr = byClient.get(clientId) ?? [];
      arr.push(d);
      byClient.set(clientId, arr);
    }
    for (const [clientId, arr] of byClient) {
      // Skip if this client already has a client-level doc of this type.
      const already = await prisma.document.findFirst({ where: { clientId, templateType } });
      if (already) {
        console.log(`  [${templateType}] client ${clientId} already has a client-level doc — leaving ${arr.length} project doc(s) in place`);
        continue;
      }
      // Canonical = newest (tie-break by content size).
      const sorted = [...arr].sort((a, b) => {
        const t = b.updatedAt.getTime() - a.updatedAt.getTime();
        return t !== 0 ? t : contentScore(b.content) - contentScore(a.content);
      });
      const canonical = sorted[0];
      await prisma.document.update({
        where: { id: canonical.id },
        data: { clientId, projectId: null },
      });
      console.log(`  [${templateType}] client ${clientId} ← doc ${canonical.id} (re-keyed; ${arr.length - 1} extra left in place)`);
    }
  }
}

async function migrateBrandLogos() {
  const assets = await prisma.projectAsset.findMany({
    where: { folder: "brand" },
    include: { project: { select: { clientId: true } } },
  });
  const byClient = new Map();
  for (const a of assets) {
    const clientId = a.project?.clientId;
    if (!clientId) continue;
    const arr = byClient.get(clientId) ?? [];
    arr.push(a);
    byClient.set(clientId, arr);
  }
  for (const [clientId, arr] of byClient) {
    const existing = await prisma.document.findFirst({ where: { clientId, templateType: "brand_kit" } });
    const content = (existing?.content && typeof existing.content === "object") ? { ...existing.content } : {};
    const logos = Array.isArray(content.logos) ? [...content.logos] : [];
    const haveUrls = new Set(logos.map((l) => l.url));
    let added = 0;
    for (const a of arr) {
      if (haveUrls.has(a.storagePath)) continue;
      logos.push({ id: `logo_${a.id}`, filename: a.filename, url: a.storagePath, isLink: a.mimeType === "text/uri-list" });
      added++;
    }
    if (added === 0) continue;
    content.logos = logos;
    if (existing) {
      await prisma.document.update({ where: { id: existing.id }, data: { content } });
    } else {
      await prisma.document.create({
        data: { clientId, stageNumber: 1, templateType: "brand_kit", title: "Brand Kit", content },
      });
    }
    console.log(`  [brand logos] client ${clientId} ← ${added} logo(s) into brand_kit JSON`);
  }
}

async function ensureOneBriefPerProject() {
  const projects = await prisma.project.findMany({ select: { id: true, name: true } });
  for (const p of projects) {
    const briefs = await prisma.document.findMany({
      where: { projectId: p.id, templateType: "project_brief" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (briefs.length === 0) {
      await prisma.document.create({
        data: { projectId: p.id, stageNumber: 1, templateType: "project_brief", title: "Project Brief", content: { name: "Project Brief" }, status: "DRAFT" },
      });
      console.log(`  [brief] project ${p.id} (${p.name}) ← created missing brief`);
    } else if (briefs.length > 1) {
      console.log(`  [brief] project ${p.id} (${p.name}) has ${briefs.length} briefs — keeping oldest ${briefs[0].id}, leaving ${briefs.length - 1} extra in place`);
    }
  }
}

console.log("1) Re-keying client-level documents to clients…");
await migrateClientLevelDocs();
console.log("2) Moving brand logos into brand_kit JSON…");
await migrateBrandLogos();
console.log("3) Ensuring one brief per project…");
await ensureOneBriefPerProject();
console.log("Done.");
await prisma.$disconnect();
