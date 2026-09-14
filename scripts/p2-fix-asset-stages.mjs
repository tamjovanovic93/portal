// Phase 2 one-off: uploads were tagged with the pre-renumber stage numbers
// (wireframes = 3, mockups = 4) while every reader filters on the current
// constants (wireframes = 2, mockups = 3). Re-tag existing rows. Idempotent.
// Run: node --env-file=.env.local scripts/p2-fix-asset-stages.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const wf = await prisma.projectAsset.updateMany({
  where: { folder: "wireframes", stageNumber: 3 },
  data: { stageNumber: 2 },
});
const mk = await prisma.projectAsset.updateMany({
  where: { folder: { in: ["mockup", "design-feedback"] }, stageNumber: 4 },
  data: { stageNumber: 3 },
});
const wfDocs = await prisma.document.updateMany({
  where: { templateType: "wireframe_feedback", stageNumber: 3 },
  data: { stageNumber: 2 },
});
const dsDocs = await prisma.document.updateMany({
  where: { templateType: "design_feedback", stageNumber: 4 },
  data: { stageNumber: 3 },
});

console.log(`wireframe assets: ${wf.count} · mockup assets: ${mk.count} · wireframe_feedback docs: ${wfDocs.count} · design_feedback docs: ${dsDocs.count}`);
await prisma.$disconnect();
