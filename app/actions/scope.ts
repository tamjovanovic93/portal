"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth/session";
import { STAGE_COUNT } from "@/lib/stages";
import { runAgent, parseJsonResponse, AgentTimeoutError } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/models";
import { buildScopeBreakdownPrompt, FIRST_DELIVERY_STAGE } from "@/lib/ai/prompts/scopeBreakdown";
import type { ProjectBrief, ScopeItem } from "@/lib/brief/types";
import { getSecret } from "@/lib/secrets";

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
  if (!Number.isFinite(v) || v < FIRST_DELIVERY_STAGE) return FIRST_DELIVERY_STAGE;
  if (v > STAGE_COUNT) return STAGE_COUNT;
  return v;
}

// Ask the model to (a) break larger scope items into a few concrete sub-tasks and
// (b) place each task into the delivery stage where it's relevant. Bounded to
// 20 s so a stalled stream can never hang the sync — falls back to a 1:1
// mapping at the first delivery stage. Returns a map itemId → ItemPlan.
async function breakdown(
  items: ScopeItem[],
  projectType: string | null
): Promise<Record<string, ItemPlan>> {
  if (items.length === 0 || !(await getSecret("ANTHROPIC_API_KEY"))) return {};
  try {
    const { text } = await runAgent(buildScopeBreakdownPrompt(items, projectType), {
      model: MODELS.fast,
      maxTokens: 4000,
      timeoutMs: 20000,
      maxTurns: 1,
    });
    const parsed = parseJsonResponse<{
      items?: { id: string; stage?: number; subtasks?: ({ name: string; stage?: number } | string)[] }[];
    }>(text);
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
  } catch (err) {
    if (!(err instanceof AgentTimeoutError)) console.error("scope breakdown failed:", err);
    return {}; // fall back to 1:1 mapping at the default stage
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
  try {

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
    const itemStage = plan ? plan.stage : FIRST_DELIVERY_STAGE;
    const subs = plan?.subtasks ?? [];
    if (subs.length === 0) {
      desired.push({ scopeItemId: item.id, parentItemId: item.id, name: item.text, startDate: start, dueDate: due, stage: itemStage });
    } else {
      subs.forEach((sub, j) =>
        desired.push({ scopeItemId: `${item.id}::${j}`, parentItemId: item.id, name: sub.name, startDate: start, dueDate: due, stage: sub.stage })
      );
    }
  }

  // All DB writes happen in one transaction (the AI call above stays outside
  // it). The brief's version guards against a scope edit that landed while the
  // breakdown was running — in that case nothing is written.
  const { created, updated, removed } = await prisma.$transaction(async (tx) => {
    // ── Task list containers (Cycles) ──
    // PROJECT mode: one task list per scope item (named after the item).
    // ONGOING mode: a single "— Scope" list (unchanged behaviour).
    const cycleForItem = new Map<string, string>();
    let nextContent: Record<string, unknown> | null = null;

    if (isProjectMode) {
      const scopeCycles = { ...((content as { scopeCycles?: Record<string, string> }).scopeCycles ?? {}) };
      let dirty = false;
      for (const item of scope) {
        let cid: string | undefined = scopeCycles[item.id];
        if (cid) {
          const exists = await tx.cycle.findUnique({ where: { id: cid }, select: { id: true } });
          if (!exists) cid = undefined;
        }
        if (!cid) {
          const cycle = await tx.cycle.create({
            data: { projectId, name: item.text.slice(0, 120), startDate: new Date(), status: "ACTIVE" },
          });
          cid = cycle.id;
          scopeCycles[item.id] = cid;
          dirty = true;
        } else {
          // Keep the list name in sync with the (editable) scope item text.
          await tx.cycle.update({ where: { id: cid }, data: { name: item.text.slice(0, 120) } });
        }
        cycleForItem.set(item.id, cid);
      }
      if (dirty) nextContent = { ...content, scopeCycles };
    } else {
      let cycleId = (content as { scopeTaskGroupId?: string }).scopeTaskGroupId;
      if (cycleId) {
        const exists = await tx.cycle.findUnique({ where: { id: cycleId }, select: { id: true } });
        if (!exists) cycleId = undefined;
      }
      if (!cycleId) {
        const name = `${content.name || doc.title || "Brief"} — Scope`;
        const cycle = await tx.cycle.create({
          data: { projectId, name, startDate: new Date(), status: "ACTIVE" },
        });
        cycleId = cycle.id;
        nextContent = { ...content, scopeTaskGroupId: cycleId };
      }
      for (const item of scope) cycleForItem.set(item.id, cycleId);
    }

    if (nextContent) {
      const claimed = await tx.document.updateMany({
        where: { id: briefDocId, version: doc.version },
        data: { content: nextContent as Prisma.InputJsonValue, version: { increment: 1 } },
      });
      if (claimed.count === 0) throw new Error("The brief changed while syncing — please run the sync again.");
    }

    const existing = await tx.task.findMany({ where: { sourceBriefId: briefDocId } });
    const existingByKey = new Map(existing.map((t) => [t.scopeItemId ?? "", t]));
    const desiredKeys = new Set(desired.map((d) => d.scopeItemId));

    let created = 0, updated = 0, removed = 0;

    for (const d of desired) {
      const cycleId = cycleForItem.get(d.parentItemId);
      if (!cycleId) continue;
      const found = existingByKey.get(d.scopeItemId);
      if (found) {
        // Update name/dates/list — preserve status, assignee, description, and any
        // stage the team manually set. Backfill the stage when it's still empty
        // (e.g. tasks synced before staged tasks existed).
        await tx.task.update({
          where: { id: found.id },
          data: {
            name: d.name,
            startDate: d.startDate,
            dueDate: d.dueDate,
            cycleId,
            ...(isProjectMode && found.stageNumber == null ? { stageNumber: d.stage } : {}),
          },
        });
        updated++;
      } else {
        await tx.task.create({
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
    const removable = existing.filter(
      (t) => t.scopeItemId && !desiredKeys.has(t.scopeItemId) && t.status === "PLANNING" && !t.assigneeId
    );
    if (removable.length > 0) {
      const ids = removable.map((t) => t.id);
      await tx.question.deleteMany({ where: { contextType: "TASK", contextId: { in: ids } } });
      const del = await tx.task.deleteMany({ where: { id: { in: ids } } });
      removed = del.count;
    }

    return { created, updated, removed };
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { created, updated, removed };
  } catch (err) {
    console.error("syncScopeTasks failed:", err);
    return { error: err instanceof Error ? err.message : "Sync failed. Please try again." };
  }
}
