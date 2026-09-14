import type { TaskStatus, TaskType } from "@prisma/client";
import { STAGE_COUNT } from "@/lib/stages";

// Retainer cycle board: the full status ladder in order.
export const TASK_STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "PLANNING", label: "Planning" },
  { key: "NEEDS_APPROVAL", label: "Needs approval" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "WAITING_FINAL_APPROVAL", label: "Waiting final approval" },
  { key: "DONE", label: "Done" },
];

// Internal tasks skip both approval steps.
export const INTERNAL_TASK_STATUSES = TASK_STATUSES.filter(
  (s) => s.key !== "NEEDS_APPROVAL" && s.key !== "WAITING_FINAL_APPROVAL"
);

// Kanban columns. Both approval states collapse into one "Waiting Approval"
// column; the underlying task status is unchanged, only how it is grouped.
export const KANBAN_COLUMNS: { key: string; label: string; statuses: TaskStatus[] }[] = [
  { key: "PLANNING", label: "Planning", statuses: ["PLANNING"] },
  { key: "IN_PROGRESS", label: "In Progress", statuses: ["IN_PROGRESS"] },
  { key: "WAITING_APPROVAL", label: "Waiting Approval", statuses: ["NEEDS_APPROVAL", "WAITING_FINAL_APPROVAL"] },
  { key: "DONE", label: "Done", statuses: ["DONE"] },
];

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  DELIVERABLE: "Deliverable",
  INTERNAL: "Internal",
  FIX_UPDATE: "Fix / Update",
};

export const TASK_TYPE_CLASS: Record<TaskType, string> = {
  DELIVERABLE: "bg-blue-fill text-blue",
  INTERNAL: "bg-inset text-ink-3",
  FIX_UPDATE: "bg-amber-fill text-amber",
};

// Staged project tasks (Stage 2+): four statuses surfaced. NEEDS_APPROVAL and
// WAITING_FINAL_APPROVAL both read as "Waiting approval".
export const STAGE_TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "PLANNING", label: "Planning" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "WAITING_FINAL_APPROVAL", label: "Waiting approval" },
  { value: "DONE", label: "Done" },
];

// Stages a task can be moved to (everything after the intake stage).
export const STAGE_CHOICES: number[] = Array.from({ length: STAGE_COUNT - 1 }, (_, i) => i + 2);
