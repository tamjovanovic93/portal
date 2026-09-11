// READ-ONLY: look for orphaned/ghost dashboard data after deletions.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

const projects = await prisma.project.findMany({
  select: { id: true, name: true, isArchived: true, clientId: true },
});
const clientIds = new Set((await prisma.profile.findMany({ where: { role: "CLIENT" }, select: { id: true } })).map((c) => c.id));
console.log("projects total:", projects.length, "| active:", projects.filter((p) => !p.isArchived).length);
console.log("projects whose client is missing/not-a-client:",
  projects.filter((p) => !clientIds.has(p.clientId)).map((p) => ({ id: p.id, name: p.name })));

// Ghost rows left by SET NULL when a single project is deleted.
const orphanEvents = await prisma.appEvent.count({ where: { projectId: null, sourceType: { not: "manual" } } });
const orphanEventsAny = await prisma.appEvent.count({ where: { projectId: null } });
const orphanActivity = await prisma.activityLog.count({ where: { projectId: null } });
console.log("app_events with null projectId (non-manual / any):", orphanEvents, "/", orphanEventsAny);
console.log("activity_log with null projectId:", orphanActivity);
await prisma.$disconnect();
