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
  name: string;
  startDate: Date | null;
  dueDate: Date | null;
};

function toDate(v?: string | null): Date | null {
  return v ? new Date(v) : null;
}

// Ask the model to break larger scope items into a few concrete sub-tasks.
// Conservative: simple items get no breakdown. Returns a map itemId → subtasks.
async function breakdown(
  items: ScopeItem[],
  projectType: string | null
): Promise<Record<string, string[]>> {
  if (!process.env.ANTHROPIC_API_KEY || items.length === 0) return {};
  const prompt = `You are planning delivery tasks for a web/design agency project${projectType ? ` (type: ${projectType})` : ""}.
For each Scope of Work item below, decide whether it needs to be broken into a few concrete sub-tasks.
Rules:
- Simple items (e.g. "QA", "Responsive design") → return an EMPTY array (they become one task).
- Larger items (e.g. "Homepage design", "Development") → return 2–5 concrete, actionable sub-tasks.
- Do NOT overcomplicate. Never invent scope that isn't implied by the item.
- Keep sub-task names short (a few words).

Return ONLY one raw JSON object: { "items": [ { "id": "<item id>", "subtasks": ["...", "..."] } ] }

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
    const parsed = JSON.parse(text.slice(start, end + 1)) as { items?: { id: string; subtasks?: string[] }[] };
    const map: Record<string, string[]> = {};
    for (const it of parsed.items ?? []) {
      if (it.id && Array.isArray(it.subtasks)) map[it.id] = it.subtasks.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim());
    }
    return map;
  } catch {
    return {}; // fall back to 1:1 mapping
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
    include: { project: { select: { id: true, type: true } } },
  });
  if (!doc) return { error: "Brief not found." };
  const projectId = doc.project.id;
  const content = (doc.content as ProjectBrief) ?? {};
  const scope = (content.scope ?? []) as ScopeItem[];

  // Find or create the Scope task group (a Cycle) for this brief.
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

  // Compute desired tasks (with optional AI sub-task breakdown).
  const map = useAi ? await breakdown(scope, doc.project.type) : {};
  const desired: Desired[] = [];
  for (const item of scope) {
    const subs = map[item.id] ?? [];
    const start = toDate(item.startDate);
    const due = toDate(item.dueDate);
    if (subs.length === 0) {
      desired.push({ scopeItemId: item.id, name: item.text, startDate: start, dueDate: due });
    } else {
      subs.forEach((sub, j) => desired.push({ scopeItemId: `${item.id}::${j}`, name: sub, startDate: start, dueDate: due }));
    }
  }

  const existing = await prisma.task.findMany({ where: { sourceBriefId: briefDocId } });
  const existingByKey = new Map(existing.map((t) => [t.scopeItemId ?? "", t]));
  const desiredKeys = new Set(desired.map((d) => d.scopeItemId));

  let created = 0, updated = 0, removed = 0;

  for (const d of desired) {
    const found = existingByKey.get(d.scopeItemId);
    if (found) {
      // Update name/dates only — preserve status, assignee, description, type.
      await prisma.task.update({
        where: { id: found.id },
        data: { name: d.name, startDate: d.startDate, dueDate: d.dueDate },
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
