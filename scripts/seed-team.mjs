// One-off backfill: seed the Zero Point team roster as TEAM Profile rows (the
// single source of truth, replacing lib/team-static.ts), then migrate existing
// brief owner/team references from the old static ids to the new Profile ids.
//
// Re-runnable: upserts by email. Run: node scripts/seed-team.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// key = old static roster id (lib/team-static.ts). Used to migrate brief refs.
const ROSTER = [
  {
    key: "tam", name: "Tam", email: "tam@zeropoint.com", accent: "blue", sortOrder: 1,
    title: "Creative · Design & UX", photoUrl: "/team/tam.png",
    skills: ["UX/UI design", "Design systems", "Prototyping", "Accessibility"],
    bio: "Leads UX and visual design. Turns user research and strategy into interfaces and experiences that convert and delight.",
    availability: { tz: "GMT+1", hours: "Mon–Thu · 10:00–19:00", note: "At capacity this cycle — route new asks via Ma" },
  },
  {
    key: "ma", name: "Ma", email: "ma@zeropoint.com", accent: "mint", sortOrder: 2,
    title: "Project Lead & Strategy", photoUrl: "/team/ma.png",
    skills: ["Project management", "Brand strategy", "Digital marketing", "UX research", "Growth strategy"],
    bio: "Runs projects end-to-end and shapes brand positioning, creative direction, and market strategy. The point of contact who sees across everything.",
    availability: { tz: "GMT+1", hours: "Mon–Fri · 08:00–18:00", note: "Available for client calls · fastest to reply" },
  },
  {
    key: "mo", name: "Mo", email: "mo@zeropoint.com", accent: "mint", sortOrder: 3,
    title: "Technical Lead", photoUrl: "/team/mo.png",
    skills: ["Full-stack development", "System architecture", "AI integration", "DevOps"],
    bio: "Architects systems, leads development, and keeps the codebase healthy. Mainly dev & backend — makes sure everything actually works.",
    availability: { tz: "GMT+1", hours: "Mon–Fri · 10:00–18:00", note: "Async-friendly · deep-work mornings" },
  },
  {
    key: "vik", name: "Vik", email: "vik@zeropoint.com", accent: "mint", sortOrder: 4,
    title: "Technical · Data & Platform", photoUrl: "/team/vik.png",
    skills: ["Data engineering", "API design", "Cloud infrastructure", "Security"],
    bio: "Focuses on data, integrations, and platform reliability. Turns complex requirements into clean, maintainable systems.",
    availability: { tz: "GMT+1", hours: "Mon–Fri · 09:00–17:00", note: "Heads-down on integrations" },
  },
  // Content team — assignable team members (previously "not on portal").
  { key: "mla", name: "Mla", email: "mla@zeropoint.com", accent: "purple", sortOrder: 5, title: "Content Team Lead", skills: ["Copywriting", "Campaigns"], bio: "Leads the content team — social, blog, video, photography, and campaign assets.", availability: { tz: "GMT+1", hours: "Mon–Fri · 09:00–18:00", note: "" } },
  { key: "al", name: "Al", email: "al@zeropoint.com", accent: "purple", sortOrder: 6, title: "Content", skills: ["Social media", "Copywriting"], bio: "Content production.", availability: { tz: "GMT+1", hours: "Mon–Fri · 09:00–18:00", note: "" } },
  { key: "du", name: "Du", email: "du@zeropoint.com", accent: "purple", sortOrder: 7, title: "Content", skills: ["Video & motion", "Photography"], bio: "Content production.", availability: { tz: "GMT+1", hours: "Mon–Fri · 09:00–18:00", note: "" } },
  { key: "da", name: "Da", email: "da@zeropoint.com", accent: "purple", sortOrder: 8, title: "Content", skills: ["Photography", "Campaigns"], bio: "Content production.", availability: { tz: "GMT+1", hours: "Mon–Fri · 09:00–18:00", note: "" } },
  { key: "le", name: "Le", email: "le@zeropoint.com", accent: "purple", sortOrder: 9, title: "Content", skills: ["Copywriting", "Social media"], bio: "Content production.", availability: { tz: "GMT+1", hours: "Mon–Fri · 09:00–18:00", note: "" } },
];

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
