// Phase 4 one-off: VERIFICATION questions used the per-client item id
// ("VQ_001") as contextId, which collides across clients. Prefix it with the
// client id ("<clientId>:VQ_001"). Idempotent.
// Run: node --env-file=.env scripts/p4-verification-context-ids.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rows = await prisma.question.findMany({
  where: { contextType: "VERIFICATION", contextId: { not: null } },
  select: { id: true, contextId: true, recipientId: true },
});

let updated = 0, skipped = 0;
for (const q of rows) {
  if (!q.contextId || q.contextId.includes(":")) { skipped++; continue; }
  if (!q.recipientId) { skipped++; continue; }
  await prisma.question.update({
    where: { id: q.id },
    data: { contextId: `${q.recipientId}:${q.contextId}` },
  });
  updated++;
}

console.log(`Updated ${updated}, skipped ${skipped} (already prefixed or no recipient).`);
await prisma.$disconnect();
