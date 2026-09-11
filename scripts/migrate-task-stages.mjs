// One-time migration: distribute existing PROJECT-mode scope tasks that have no
// stageNumber into delivery stages (2–7) using the agent, and move each into a
// per-scope-item task list (Cycle). Safe to re-run — only touches tasks whose
// stageNumber is still null. Run with:
//   node --env-file=.env.local --env-file=.env scripts/migrate-task-stages.mjs
import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";

const prisma = new PrismaClient();
const MODEL = "claude-sonnet-4-6";

function clampStage(n) {
  const v = typeof n === "number" ? n : parseInt(String(n), 10);
  if (!Number.isFinite(v) || v < 2) return 2;
  if (v > 7) return 7;
  return v;
}

async function breakdown(items, projectType) {
  if (!process.env.ANTHROPIC_API_KEY || items.length === 0) return {};
  const prompt = `You are planning delivery tasks for a web/design agency project${projectType ? ` (type: ${projectType})` : ""}.
The project runs in stages: 2 = wireframe / first direction, 3 = full design, 4 = build / development, 5 = client review, 6 = launch / delivery, 7 = complete.
For each Scope of Work item below, assign the single stage (2–7) where the work actually happens. If it clearly splits into a few concrete sub-tasks (2–5), give each a stage.
Return ONLY one raw JSON object:
{ "items": [ { "id": "<item id>", "stage": <2-7>, "subtasks": [ { "name": "...", "stage": <2-7> } ] } ] }
SCOPE ITEMS:
${JSON.stringify(items.map((i) => ({ id: i.id, text: i.text })))}`;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    if (s === -1 || e === -1) return {};
    const parsed = JSON.parse(text.slice(s, e + 1));
    const map = {};
    for (const it of parsed.items ?? []) {
      if (!it.id) continue;
      const stage = clampStage(it.stage);
      const subs = (it.subtasks ?? []).map((x) => (typeof x === "string" ? { stage } : { stage: clampStage(x.stage ?? stage) }));
      map[it.id] = { stage, subtasks: subs };
    }
    return map;
  } catch (err) {
    console.warn("  breakdown failed, defaulting stages:", err.message);
    return {};
  }
}

const briefs = await prisma.document.findMany({
  where: { templateType: "project_brief", project: { mode: "PROJECT" } },
  select: { id: true, content: true, project: { select: { id: true, name: true, type: true } } },
});

let totalUpdated = 0;
for (const b of briefs) {
  const tasks = await prisma.task.findMany({
    where: { sourceBriefId: b.id, stageNumber: null },
    select: { id: true, scopeItemId: true },
  });
  if (tasks.length === 0) continue;
  const content = b.content ?? {};
  const scope = content.scope ?? [];
  console.log(`\n${b.project.name}: ${tasks.length} unstaged tasks across ${scope.length} scope items`);

  const plans = await breakdown(scope, b.project.type);
  const scopeCycles = { ...(content.scopeCycles ?? {}) };
  const cycleForItem = new Map();

  // Ensure a per-item cycle exists for each scope item.
  for (const item of scope) {
    let cid = scopeCycles[item.id];
    if (cid) {
      const exists = await prisma.cycle.findUnique({ where: { id: cid }, select: { id: true } });
      if (!exists) cid = undefined;
    }
    if (!cid) {
      const cycle = await prisma.cycle.create({
        data: { projectId: b.project.id, name: String(item.text).slice(0, 120), startDate: new Date(), status: "ACTIVE" },
      });
      cid = cycle.id;
      scopeCycles[item.id] = cid;
    }
    cycleForItem.set(item.id, cid);
  }

  for (const t of tasks) {
    const key = t.scopeItemId ?? "";
    const [parentId, subIdx] = key.split("::");
    const plan = plans[parentId];
    let stage = 2;
    if (plan) {
      stage = subIdx != null && plan.subtasks[Number(subIdx)] ? plan.subtasks[Number(subIdx)].stage : plan.stage;
    }
    const cid = cycleForItem.get(parentId);
    await prisma.task.update({
      where: { id: t.id },
      data: { stageNumber: stage, ...(cid ? { cycleId: cid } : {}) },
    });
    totalUpdated++;
  }

  await prisma.document.update({
    where: { id: b.id },
    data: { content: { ...content, scopeCycles } },
  });
  console.log(`  ✓ staged ${tasks.length} tasks, ${Object.keys(scopeCycles).length} task lists`);
}

console.log(`\nDone. Updated ${totalUpdated} tasks.`);
await prisma.$disconnect();
