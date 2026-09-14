// Phase 4 one-off: team notifications used to be a single shared row
// (recipient_id null, recipient_role TEAM) with one read state for everyone.
// Fan each legacy row out to every active team member, then delete the original.
// Idempotent — a second run finds no legacy rows.
// Run: node --env-file=.env.local scripts/p4-fanout-legacy-notifications.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const members = await prisma.profile.findMany({
  where: { role: "TEAM", active: true },
  select: { id: true },
});
const legacy = await prisma.notification.findMany({
  where: { recipientId: null, recipientRole: "TEAM" },
});

let created = 0;
for (const n of legacy) {
  await prisma.$transaction([
    prisma.notification.createMany({
      data: members.map((m) => ({
        projectId: n.projectId,
        recipientId: m.id,
        recipientRole: "TEAM",
        type: n.type,
        message: n.message,
        link: n.link,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
    }),
    prisma.notification.delete({ where: { id: n.id } }),
  ]);
  created += members.length;
}

console.log(`Fanned out ${legacy.length} legacy notification(s) to ${members.length} member(s) → ${created} rows.`);
await prisma.$disconnect();
