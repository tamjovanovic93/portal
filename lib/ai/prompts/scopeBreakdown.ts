import { STAGE_COUNT, STAGE_INFO } from "@/lib/stages";
import type { ScopeItem } from "@/lib/brief/types";

// Delivery stages a scope task can land in (Stage 1 is planning only).
export const FIRST_DELIVERY_STAGE = 2;

function stageList(): string {
  return Array.from({ length: STAGE_COUNT - FIRST_DELIVERY_STAGE + 1 }, (_, i) => {
    const n = FIRST_DELIVERY_STAGE + i;
    return `${n} = ${STAGE_INFO[n].description.toLowerCase()}`;
  }).join(", ");
}

// Break scope items into sub-tasks and place each in a delivery stage.
export function buildScopeBreakdownPrompt(items: ScopeItem[], projectType: string | null): string {
  return `You are planning delivery tasks for a web/design agency project${projectType ? ` (type: ${projectType})` : ""}.
The project runs in stages: ${stageList()}.

For each Scope of Work item below:
- Decide whether it needs to be broken into a few concrete sub-tasks (2–5). Simple items (e.g. "QA") get an empty subtask list and become one task.
- Assign each task (the item itself, or each sub-task) to the single stage (${FIRST_DELIVERY_STAGE}–${STAGE_COUNT}) where the work actually happens.
- Do NOT overcomplicate or invent scope. Keep names short.

Return ONLY one raw JSON object:
{ "items": [ { "id": "<item id>", "stage": <${FIRST_DELIVERY_STAGE}-${STAGE_COUNT}>, "subtasks": [ { "name": "...", "stage": <${FIRST_DELIVERY_STAGE}-${STAGE_COUNT}> } ] } ] }

SCOPE ITEMS:
${JSON.stringify(items.map((i) => ({ id: i.id, text: i.text })))}`;
}
