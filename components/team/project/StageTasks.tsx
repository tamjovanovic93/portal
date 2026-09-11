"use client";

import { useState, useTransition } from "react";
import type { RosterMember } from "@/lib/team";
import {
  assignTask,
  updateTaskStatus,
  toggleBlocker,
  moveTaskToStage,
  updateTaskNotes,
  updateTaskEstimate,
  updateTaskWorkLink,
  deleteTask,
} from "@/app/actions/retainer";
import type { TaskStatus } from "@prisma/client";
import { STAGE_LABELS } from "@/lib/stages";

export type StageTask = {
  id: string;
  name: string;
  status: TaskStatus;
  stageNumber: number | null;
  assigneeId: string | null;
  estimateDate: string | null;
  workLink: string | null;
  notes: string | null;
  isBlocker: boolean;
  listName: string;
};

// Four statuses surfaced from Stage 2 onward (NEEDS_APPROVAL and
// WAITING_FINAL_APPROVAL both read as "Waiting approval").
const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "PLANNING", label: "Planning" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "WAITING_FINAL_APPROVAL", label: "Waiting approval" },
  { value: "DONE", label: "Done" },
];

const STAGE_CHOICES = [2, 3, 4, 5, 6, 7];

function toDateInput(d: string | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

function TaskRow({
  task,
  projectId,
  roster,
  planning,
}: {
  task: StageTask;
  projectId: string;
  roster: RosterMember[];
  planning: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(task.notes ?? "");
  const [link, setLink] = useState(task.workLink ?? "");
  const activeBlocker = task.isBlocker;

  const run = (fn: () => Promise<unknown>) => startTransition(() => void fn());

  const displayStatus: TaskStatus =
    task.status === "NEEDS_APPROVAL" ? "WAITING_FINAL_APPROVAL" : task.status;

  return (
    <div
      className={`rounded-md border bg-white px-3 py-2.5 space-y-2 ${isPending ? "opacity-60" : ""} ${
        activeBlocker ? "border-red-300 border-l-4 border-l-red-500" : "border-neutral-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`text-sm ${task.status === "DONE" ? "line-through text-neutral-400" : "text-neutral-800"}`}>
          {task.name}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {activeBlocker && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">Blocked</span>
          )}
          <button
            type="button"
            onClick={() => run(() => deleteTask(task.id, projectId))}
            className="text-neutral-300 hover:text-red-500 text-sm"
            title="Delete task"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Assignee — team member only */}
        <select
          value={task.assigneeId ?? ""}
          onChange={(e) => run(() => assignTask(task.id, projectId, e.target.value || null))}
          disabled={isPending}
          className="text-xs rounded border border-neutral-300 px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
        >
          <option value="">Unassigned</option>
          {roster.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        {/* Estimate date */}
        <label className="text-xs text-neutral-500 flex items-center gap-1">
          Est.
          <input
            type="date"
            defaultValue={toDateInput(task.estimateDate)}
            onChange={(e) => run(() => updateTaskEstimate(task.id, projectId, e.target.value || null))}
            className="text-xs rounded border border-neutral-300 px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </label>

        {/* Status — stage view only (no statuses in the Stage 1 planning view) */}
        {!planning && (
          <select
            value={displayStatus}
            onChange={(e) => run(() => updateTaskStatus(task.id, projectId, e.target.value as TaskStatus))}
            disabled={isPending}
            className="text-xs rounded border border-neutral-300 px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        )}

        {/* Move to stage */}
        <label className="text-xs text-neutral-500 flex items-center gap-1">
          Stage
          <select
            value={task.stageNumber ?? ""}
            onChange={(e) => run(() => moveTaskToStage(task.id, projectId, e.target.value ? Number(e.target.value) : null))}
            disabled={isPending}
            className="text-xs rounded border border-neutral-300 px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
          >
            <option value="">—</option>
            {STAGE_CHOICES.map((n) => (
              <option key={n} value={n}>{n} · {STAGE_LABELS[n]}</option>
            ))}
          </select>
        </label>

        {/* Blocked toggle */}
        <button
          type="button"
          onClick={() => run(() => toggleBlocker(task.id, projectId, !task.isBlocker))}
          disabled={isPending}
          className={`text-xs px-2 py-1 rounded font-medium ${
            activeBlocker
              ? "bg-red-600 text-white hover:bg-red-700"
              : "border border-red-200 text-red-600 hover:bg-red-50"
          }`}
        >
          {activeBlocker ? "Unblock" : "Blocked!"}
        </button>
      </div>

      {/* Work link */}
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onBlur={() => { if (link !== (task.workLink ?? "")) run(() => updateTaskWorkLink(task.id, projectId, link)); }}
          placeholder="Link to the work (Figma, doc, PR…)"
          className="flex-1 text-xs rounded border border-neutral-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
        {task.workLink && (
          <a href={task.workLink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline shrink-0">
            Open ↗
          </a>
        )}
      </div>

      {/* Notes (per task/chunk) */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => { if (notes !== (task.notes ?? "")) run(() => updateTaskNotes(task.id, projectId, notes)); }}
        rows={planning ? 2 : 1}
        placeholder="Notes…"
        className="w-full text-xs rounded border border-neutral-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-neutral-900 resize-y"
      />
    </div>
  );
}

// Stage 1 planning view groups every task by its task list (scope item). Stages
// 2+ show only that stage's tasks with status controls.
export default function StageTasks({
  projectId,
  tasks,
  roster,
  planning = false,
}: {
  projectId: string;
  tasks: StageTask[];
  roster: RosterMember[];
  planning?: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        {planning
          ? "No tasks yet — approve “Sync Scope to Tasks” on the project brief to generate them."
          : "No tasks assigned to this stage yet."}
      </p>
    );
  }

  if (!planning) {
    // Familiar Kanban board: Planning / In Progress / Waiting Approval / Done.
    const COLUMNS: { key: string; label: string; statuses: TaskStatus[] }[] = [
      { key: "PLANNING", label: "Planning", statuses: ["PLANNING"] },
      { key: "IN_PROGRESS", label: "In Progress", statuses: ["IN_PROGRESS"] },
      { key: "WAITING_APPROVAL", label: "Waiting Approval", statuses: ["NEEDS_APPROVAL", "WAITING_FINAL_APPROVAL"] },
      { key: "DONE", label: "Done", statuses: ["DONE"] },
    ];
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => col.statuses.includes(t.status));
          return (
            <div key={col.key} className="rounded-lg bg-neutral-50 border border-neutral-200 p-2.5">
              <div className="flex items-center justify-between mb-2 px-0.5">
                <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">{col.label}</span>
                <span className={`text-xs font-medium px-1.5 rounded-full ${items.length > 0 ? "bg-neutral-200 text-neutral-600" : "text-neutral-300"}`}>
                  {items.length}
                </span>
              </div>
              <div className="space-y-2 min-h-[3rem]">
                {items.length === 0 ? (
                  <div className="h-12 rounded-md border border-dashed border-neutral-200" />
                ) : (
                  items.map((t) => (
                    <TaskRow key={t.id} task={t} projectId={projectId} roster={roster} planning={false} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Planning view: group by task list.
  const groups = new Map<string, StageTask[]>();
  for (const t of tasks) {
    const key = t.listName || "Tasks";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([listName, list]) => (
        <div key={listName} className="space-y-2">
          <h4 className="text-sm font-semibold text-neutral-900">{listName}</h4>
          <div className="space-y-2">
            {list.map((t) => (
              <TaskRow key={t.id} task={t} projectId={projectId} roster={roster} planning />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
