// One-off backfill: seed the Zero Point team roster as TEAM Profile rows (the
// single source of truth, replacing lib/team-static.ts), then migrate existing
// brief owner/team references from the old static ids to the new Profile ids.
//
// Re-runnable: upserts by email. Run: node scripts/archive/seed-team.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Roster lives outside git: copy scripts/seed/team.example.json to
// scripts/seed/team.local.json and fill it in. `key` is the old static
// roster id (lib/team-static.ts), used only to migrate brief refs.
import { readFileSync } from "node:fs";
const ROSTER = JSON.parse(readFileSync(new URL("../seed/team.local.json", import.meta.url), "utf8"));

const idMap = {}; // old static key -> new Profile id

for (const m of ROSTER) {
  const data = {
    name: m.name,
    role: "TEAM",
    title: m.title,
    skills: m.skills ?? [],
    photoUrl: m.photoUrl ?? null,
    bio: m.bio ?? null,
    availability: m.availability ?? null,
    accent: m.accent ?? null,
    active: true,
    sortOrder: m.sortOrder ?? null,
  };
  const row = await prisma.profile.upsert({
    where: { email: m.email },
    create: { id: crypto.randomUUID(), email: m.email, ...data },
    update: data,
  });
  idMap[m.key] = row.id;
}

console.log("Seeded team roster:", Object.keys(idMap).length, "members");
console.log("id map:", JSON.stringify(idMap, null, 2));

// ── Migrate existing brief references (ownerId + team[].memberId) ──
const briefs = await prisma.document.findMany({ where: { templateType: "project_brief" } });
let migrated = 0;
for (const b of briefs) {
  const content = b.content ?? {};
  let changed = false;

  if (typeof content.ownerId === "string" && idMap[content.ownerId]) {
    content.ownerId = idMap[content.ownerId];
    changed = true;
  }
  if (Array.isArray(content.team)) {
    content.team = content.team.map((t) => {
      if (t && typeof t.memberId === "string" && idMap[t.memberId]) {
        changed = true;
        return { ...t, memberId: idMap[t.memberId] };
      }
      return t;
    });
  }
  if (changed) {
    await prisma.document.update({ where: { id: b.id }, data: { content } });
    migrated++;
  }
}
console.log("Migrated brief references:", migrated, "of", briefs.length, "briefs");

await prisma.$disconnect();
