"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { ProjectBrief, ScopeItem } from "@/lib/brief/types";

const MODEL = "claude-opus-4-8";

async function requireTeam() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (user.user_metadata?.role?.toLowerCase() === "client") throw new Error("Unauthorized");
}

// A desired task derived from a scope item. scopeItemId is the stable sync key:
//   simple item        → scopeItemId = item.id
//   AI-broken subtask  → scopeItemId = `${item.id}::${index}`
type Desired = {
  scopeItemId: string;
  parentItemId: string; // the top-level scope item this belongs to (its task list)
  name: string;
  startDate: Date | null;
  dueDate: Date | null;
  stage: number; // delivery stage 2–7 (assigned by the agent)
};

// AI breakdown result per scope item: an optional stage for the item, and any
// concrete sub-tasks (each with its own stage).
type ItemPlan = { stage: number; subtasks: { name: string; stage: number }[] };

function toDate(v?: string | null): Date | null {
  return v ? new Date(v) : null;
}

function clampStage(n: unknown): number {
  const v = typeof n === "number" ? n : parseInt(String(n), 10);
  if (!Number.isFinite(v) || v < 2) return 2;
  if (v > 7) return 7;
  return v;
}

// Ask the model to (a) break larger scope items into a few concrete sub-tasks and
// (b) place each task into the delivery stage where it's relevant:
//   2 wireframe / first direction · 3 full design · 4 build · 5 client review ·
//   6 launch/delivery · 7 complete. Returns a map itemId → ItemPlan.
async function breakdown(
  items: ScopeItem[],
  projectType: string | null
): Promise<Record<string, ItemPlan>> {
  if (!process.env.ANTHROPIC_API_KEY || items.length === 0) return {};
  const prompt = `You are planning delivery tasks for a web/design agency project${projectType ? ` (type: ${projectType})` : ""}.
The project runs in stages: 2 = wireframe / first direction, 3 = full design, 4 = build / development, 5 = client review, 6 = launch / delivery, 7 = complete.

For each Scope of Work item below:
- Decide whether it needs to be broken into a few concrete sub-tasks (2–5). Simple items (e.g. "QA") get an empty subtask list and become one task.
- Assign each task (the item itself, or each sub-task) to the single stage (2–7) where the work actually happens.
- Do NOT overcomplicate or invent scope. Keep names short.

Return ONLY one raw JSON object:
{ "items": [ { "id": "<item id>", "stage": <2-7>, "subtasks": [ { "name": "...", "stage": <2-7> } ] } ] }

SCOPE ITEMS:
${JSON.stringify(items.map((i) => ({ id: i.id, text: i.text })))}`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });
    const message = await stream.finalMessage();
    const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return {};
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      items?: { id: string; stage?: number; subtasks?: ({ name: string; stage?: number } | string)[] }[];
    };
    const map: Record<string, ItemPlan> = {};
    for (const it of parsed.items ?? []) {
      if (!it.id) continue;
      const stage = clampStage(it.stage);
      const subtasks = (it.subtasks ?? [])
        .map((s) => (typeof s === "string" ? { name: s, stage } : { name: s.name, stage: clampStage(s.stage ?? stage) }))
        .filter((s) => typeof s.name === "string" && s.name.trim())
        .map((s) => ({ name: s.name.trim(), stage: s.stage }));
      map[it.id] = { stage, subtasks };
    }
    return map;
  } catch {
    return {}; // fall back to 1:1 mapping at a default stage
  }
}

// Sync the tasks generated from a brief's Scope of Work. Idempotent: upserts by
// (sourceBriefId, scopeItemId) so re-running updates rather than duplicating.
// Manual tasks (no scopeItemId) are never touched. Removed scope items delete
// only their still-untouched generated tasks (PLANNING + unassigned).
export async function syncScopeTasks(
  briefDocId: string,
  useAi = true
): Promise<{ created?: number; updated?: number; removed?: number; error?: string }> {
  await requireTeam();

  const doc = await prisma.document.findUnique({
    where: { id: briefDocId },
    include: { project: { select: { id: true, type: true, mode: true } } },
  });
  if (!doc?.project) return { error: "Brief not found." };
  const projectId = doc.project.id;
  const isProjectMode = doc.project.mode !== "ONGOING";
  const content = (doc.content as ProjectBrief) ?? {};
  const scope = (content.scope ?? []) as ScopeItem[];

  // Compute desired tasks (with optional AI sub-task breakdown + stage placement).
  const map = useAi ? await breakdown(scope, doc.project.type) : {};
  const desired: Desired[] = [];
  for (const item of scope) {
    const plan = map[item.id];
    const start = toDate(item.startDate);
    const due = toDate(item.dueDate);
    const itemStage = plan ? plan.stage : 2;
    const subs = plan?.subtasks ?? [];
    if (subs.length === 0) {
      desired.push({ scopeItemId: item.id, parentItemId: item.id, name: item.text, startDate: start, dueDate: due, stage: itemStage });
    } else {
      subs.forEach((sub, j) =>
        desired.push({ scopeItemId: `${item.id}::${j}`, parentItemId: item.id, name: sub.name, startDate: start, dueDate: due, stage: sub.stage })
      );
    }
  }

  // ── Task list containers (Cycles) ──
  // PROJECT mode: one task list per scope item (named after the item).
  // ONGOING mode: a single "— Scope" list (unchanged behaviour).
  const cycleForItem = new Map<string, string>();
  if (isProjectMode) {
    const scopeCycles = { ...((content as { scopeCycles?: Record<string, string> }).scopeCycles ?? {}) };
    let dirty = false;
    for (const item of scope) {
      let cid: string | undefined = scopeCycles[item.id];
      if (cid) {
        const exists = await prisma.cycle.findUnique({ where: { id: cid }, select: { id: true } });
        if (!exists) cid = undefined;
      }
      if (!cid) {
        const cycle = await prisma.cycle.create({
          data: { projectId, name: item.text.slice(0, 120), startDate: new Date(), status: "ACTIVE" },
        });
        cid = cycle.id;
        scopeCycles[item.id] = cid;
        dirty = true;
      } else {
        // Keep the list name in sync with the (editable) scope item text.
        await prisma.cycle.update({ where: { id: cid }, data: { name: item.text.slice(0, 120) } });
      }
      cycleForItem.set(item.id, cid);
    }
    if (dirty) {
      await prisma.document.update({
        where: { id: briefDocId },
        data: { content: { ...content, scopeCycles } as unknown as Prisma.InputJsonValue },
      });
    }
  } else {
    let cycleId = (content as { scopeTaskGroupId?: string }).scopeTaskGroupId;
    if (cycleId) {
      const exists = await prisma.cycle.findUnique({ where: { id: cycleId }, select: { id: true } });
      if (!exists) cycleId = undefined;
    }
    if (!cycleId) {
      const name = `${content.name || doc.title || "Brief"} — Scope`;
      const cycle = await prisma.cycle.create({
        data: { projectId, name, startDate: new Date(), status: "ACTIVE" },
      });
      cycleId = cycle.id;
      await prisma.document.update({
        where: { id: briefDocId },
        data: { content: { ...content, scopeTaskGroupId: cycleId } as unknown as Prisma.InputJsonValue },
      });
    }
    for (const item of scope) cycleForItem.set(item.id, cycleId);
  }

  const existing = await prisma.task.findMany({ where: { sourceBriefId: briefDocId } });
  const existingByKey = new Map(existing.map((t) => [t.scopeItemId ?? "", t]));
  const desiredKeys = new Set(desired.map((d) => d.scopeItemId));

  let created = 0, updated = 0, removed = 0;

  for (const d of desired) {
    const cycleId = cycleForItem.get(d.parentItemId);
    if (!cycleId) continue;
    const found = existingByKey.get(d.scopeItemId);
    if (found) {
      // Update name/dates/list only — preserve status, assignee, description,
      // and any stage the team manually moved the task to.
      await prisma.task.update({
        where: { id: found.id },
        data: { name: d.name, startDate: d.startDate, dueDate: d.dueDate, cycleId },
      });
      updated++;
    } else {
      await prisma.task.create({
        data: {
          cycleId,
          name: d.name,
          type: "DELIVERABLE",
          status: "PLANNING",
          sourceBriefId: briefDocId,
          scopeItemId: d.scopeItemId,
          startDate: d.startDate,
          dueDate: d.dueDate,
          stageNumber: isProjectMode ? d.stage : null,
        },
      });
      created++;
    }
  }

  // Remove generated tasks whose scope item is gone — only if still untouched.
  for (const t of existing) {
    if (t.scopeItemId && !desiredKeys.has(t.scopeItemId)) {
      if (t.status === "PLANNING" && !t.assigneeId) {
        await prisma.task.delete({ where: { id: t.id } });
        removed++;
      }
    }
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { created, updated, removed };
}
