// One-off backfill: move typography/colors off individual briefs into a single
// per-project Brand Kit document (templateType "brand_kit"), then strip them
// from the briefs. Re-runnable. Run: node scripts/migrate-brandkit.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BRAND_KIT_DOC = "brand_kit";

const briefs = await prisma.document.findMany({ where: { templateType: "project_brief" } });

// Group brief typography/colors by project.
const byProject = new Map();
for (const b of briefs) {
  const c = b.content ?? {};
  const hasType = Array.isArray(c.typography) && c.typography.length > 0;
  const hasColors = Array.isArray(c.colors) && c.colors.length > 0;
  if (!hasType && !hasColors) continue;
  const acc = byProject.get(b.projectId) ?? { typography: [], colors: [] };
  if (hasType) acc.typography.push(...c.typography);
  if (hasColors) acc.colors.push(...c.colors);
  byProject.set(b.projectId, acc);
}

let kits = 0;
for (const [projectId, acc] of byProject) {
  const existing = await prisma.document.findFirst({ where: { projectId, templateType: BRAND_KIT_DOC } });
  const current = existing?.content ?? {};
  const merged = {
    ...current,
    typography: [...(current.typography ?? []), ...acc.typography],
    colors: [...(current.colors ?? []), ...acc.colors],
  };
  if (existing) await prisma.document.update({ where: { id: existing.id }, data: { content: merged } });
  else await prisma.document.create({ data: { projectId, stageNumber: 1, templateType: BRAND_KIT_DOC, title: "Brand Kit", content: merged } });
  kits++;
}

// Strip typography/colors from briefs (data now lives in Brand Kit).
let stripped = 0;
for (const b of briefs) {
  const c = b.content ?? {};
  if (c.typography === undefined && c.colors === undefined) continue;
  const { typography, colors, ...rest } = c;
  void typography; void colors;
  await prisma.document.update({ where: { id: b.id }, data: { content: rest } });
  stripped++;
}

console.log(`Brand Kit docs written/updated: ${kits}; briefs stripped of typography/colors: ${stripped}`);
await prisma.$disconnect();
