// Phase 2 one-off: create the 7 ProjectStage rows for any project that has none
// (retainers created before stages were tracked). Previously done lazily during
// page render. Idempotent.
// Run: node --env-file=.env scripts/p2-backfill-stages.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const STAGE_COUNT = 7;

const projects = await prisma.project.findMany({
  where: { stages: { none: {} } },
  select: { id: true, name: true, currentStage: true },
});

for (const p of projects) {
  await prisma.projectStage.createMany({
    data: Array.from({ length: STAGE_COUNT }, (_, i) => ({
      projectId: p.id,
      stageNumber: i + 1,
      status: i + 1 < p.currentStage ? "COMPLETE" : i + 1 === p.currentStage ? "IN_PROGRESS" : "NOT_STARTED",
    })),
    skipDuplicates: true,
  });
  console.log(`  backfilled ${p.name}`);
}

console.log(`Done. ${projects.length} project(s) backfilled.`);
await prisma.$disconnect();
