"use client";

import { useState, useTransition } from "react";
import {
  addTask,
  updateTaskStatus,
  setOwnerRole,
  toggleBlocker,
  setBlockerResolver,
  markUnblocked,
  toggleRequiresApproval,
  deleteTask,
  closeCycle,
  reopenCycle,
  deleteCycle,
  updateCycle,
  updateCycleFocus,
} from "@/app/actions/retainer";
import type { TaskStatus, TaskType, TaskOwnerRole } from "@prisma/client";
import { OWNER_ROLES, OWNER_ROLE_LABEL } from "@/lib/retainer-labels";

type Task = {
  id: string;
  name: string;
  type: TaskType;
  status: TaskStatus;
  description: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  ownerRole: TaskOwnerRole | null;
  isBlocker: boolean;
  blockerResolver: TaskOwnerRole | null;
  unblockedAt: Date | null;
  requiresClientApproval: boolean;
  approvalCount: number;
};

type Cycle = {
  id: string;
  name: string;
  focus: string | null;
  startDate: Date;
  endDate: Date | null;
  status: "ACTIVE" | "CLOSED";
  tasks: Task[];
};

const STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "PLANNING", label: "Planning" },
  { key: "NEEDS_APPROVAL", label: "Needs approval" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "WAITING_FINAL_APPROVAL", label: "Waiting final approval" },
  { key: "DONE", label: "Done" },
];

// Internal tasks skip both approval steps.
const INTERNAL_STATUSES = STATUSES.filter(
  (s) => s.key !== "NEEDS_APPROVAL" && s.key !== "WAITING_FINAL_APPROVAL"
);

// Kanban columns. Both approval states collapse into one "Waiting Approval"
// column — the underlying task status is unchanged, only how it's grouped.
const COLUMNS: { key: string; label: string; statuses: TaskStatus[] }[] = [
  { key: "PLANNING", label: "Planning", statuses: ["PLANNING"] },
  { key: "IN_PROGRESS", label: "In Progress", statuses: ["IN_PROGRESS"] },
  { key: "WAITING_APPROVAL", label: "Waiting Approval", statuses: ["NEEDS_APPROVAL", "WAITING_FINAL_APPROVAL"] },
  { key: "DONE", label: "Done", statuses: ["DONE"] },
];

const TYPE_LABEL: Record<TaskType, string> = {
  DELIVERABLE: "Deliverable",
  INTERNAL: "Internal",
  FIX_UPDATE: "Fix / Update",
};

const TYPE_CLASS: Record<TaskType, string> = {
  DELIVERABLE: "bg-blue-50 text-blue-700",
  INTERNAL: "bg-neutral-100 text-neutral-500",
  FIX_UPDATE: "bg-amber-50 text-amber-700",
};

function orderFor(task: Task) {
  return task.type === "INTERNAL" ? INTERNAL_STATUSES : STATUSES;
}

function toDateInputValue(d: Date | null): string {
  const dt = d ? new Date(d) : new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function TaskCard({ task, projectId, isActive }: { task: Task; projectId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unblockDate, setUnblockDate] = useState(() => toDateInputValue(null));

  const order = orderFor(task);
  const idx = order.findIndex((s) => s.key === task.status);

  const isUnblocked = task.isBlocker && !!task.unblockedAt;
  const activeBlocker = task.isBlocker && !task.unblockedAt && task.status !== "DONE";

  const awaitingClient =
    task.type === "DELIVERABLE" &&
    task.requiresClientApproval &&
    task.status === "WAITING_FINAL_APPROVAL" &&
    task.approvalCount === 0;
  const clientApproved = task.requiresClientApproval && task.approvalCount > 0;

  function changeStatus(next: TaskStatus) {
    if (next === task.status) return;
    setError(null);
    startTransition(async () => {
      const res = await updateTaskStatus(task.id, projectId, next);
      if (res?.error) setError(res.error);
    });
  }

  function changeOwner(value: string) {
    startTransition(async () => {
      await setOwnerRole(task.id, projectId, (value || null) as TaskOwnerRole | null);
    });
  }

  function flipBlocker() {
    startTransition(async () => {
      await toggleBlocker(task.id, projectId, !task.isBlocker);
    });
  }

  function changeResolver(value: string) {
    startTransition(async () => {
      await setBlockerResolver(task.id, projectId, (value || null) as TaskOwnerRole | null);
    });
  }

  function confirmUnblock() {
    startTransition(async () => {
      await markUnblocked(task.id, projectId, unblockDate);
    });
  }

  function undoUnblock() {
    startTransition(async () => {
      await markUnblocked(task.id, projectId, null);
    });
  }

  function flipApproval() {
    startTransition(async () => {
      await toggleRequiresApproval(task.id, projectId, !task.requiresClientApproval);
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${task.name}"?`)) return;
    startTransition(async () => {
      await deleteTask(task.id, projectId);
    });
  }

  const isOverdue = task.dueDate && task.status !== "DONE" && new Date(task.dueDate) < new Date();

  return (
    <div
      className={`rounded-md border bg-white px-3 py-2.5 space-y-1.5 ${isPending ? "opacity-50" : ""} ${
        activeBlocker
          ? "border-red-300 border-l-4 border-l-red-500 ring-1 ring-red-200"
          : task.status === "DONE"
          ? "border-neutral-100"
          : "border-neutral-200"
      }`}
    >
      {activeBlocker && (
        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">
          ⛔ Blocker
        </span>
      )}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`text-sm text-left leading-snug flex-1 ${
            task.status === "DONE" ? "line-through text-neutral-500" : "text-neutral-800"
          }`}
        >
          {task.name}
        </button>
        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_CLASS[task.type]}`}>
          {TYPE_LABEL[task.type]}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-neutral-600">
          {task.ownerRole ? OWNER_ROLE_LABEL[task.ownerRole] : "Unassigned"}
        </span>
        {isUnblocked && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
            Unblocked {new Date(task.unblockedAt!).toLocaleDateString()}
          </span>
        )}
        {awaitingClient && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Awaiting client</span>
        )}
        {clientApproved && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">Client approved</span>
        )}
      </div>

      {expanded && (
        <div className="space-y-2 pt-1">
          {task.description && <p className="text-xs text-neutral-500">{task.description}</p>}
          {task.dueDate && (
            <p className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-neutral-600"}`}>
              Due {new Date(task.dueDate).toLocaleDateString()}
              {isOverdue && " — overdue"}
            </p>
          )}

          {isActive && (
            <>
              <div>
                <label className="block text-xs text-neutral-600 mb-0.5">Owner</label>
                <select
                  value={task.ownerRole ?? ""}
                  onChange={(e) => changeOwner(e.target.value)}
                  disabled={isPending}
                  className="w-full text-xs rounded border border-neutral-300 px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="">Unassigned</option>
                  {OWNER_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
                <input type="checkbox" checked={task.isBlocker} onChange={flipBlocker} disabled={isPending} className="accent-red-600" />
                Blocker — stops progress until cleared
              </label>

              {task.isBlocker && (
                <div>
                  <label className="block text-xs text-neutral-600 mb-0.5">Resolver — who needs to clear it</label>
                  <select
                    value={task.blockerResolver ?? ""}
                    onChange={(e) => changeResolver(e.target.value)}
                    disabled={isPending}
                    className="w-full text-xs text-neutral-900 rounded border border-neutral-300 px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  >
                    <option value="">Choose resolver…</option>
                    {OWNER_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Unblock — check off with a date */}
              {task.isBlocker && (
                isUnblocked ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-700 font-medium">
                      ✓ Unblocked {new Date(task.unblockedAt!).toLocaleDateString()}
                    </span>
                    <button type="button" onClick={undoUnblock} disabled={isPending} className="text-neutral-600 hover:text-neutral-900 underline underline-offset-2">
                      undo
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-neutral-600 mb-0.5">Mark unblocked</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={unblockDate}
                        onChange={(e) => setUnblockDate(e.target.value)}
                        disabled={isPending}
                        className="text-xs text-neutral-900 rounded border border-neutral-300 px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={confirmUnblock}
                        disabled={isPending}
                        className="text-xs px-2.5 py-1 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        Unblock
                      </button>
                    </div>
                  </div>
                )
              )}

              {task.type === "DELIVERABLE" && (
                <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
                  <input type="checkbox" checked={task.requiresClientApproval} onChange={flipApproval} disabled={isPending} className="accent-neutral-900" />
                  Requires client approval to close
                </label>
              )}
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        {isActive ? (
          <select
            value={task.status}
            onChange={(e) => changeStatus(e.target.value as TaskStatus)}
            disabled={isPending}
            title={awaitingClient ? "Waiting on client approval" : undefined}
            className="text-xs text-neutral-700 rounded border border-neutral-200 bg-white px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
          >
            {order.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-neutral-600">{order[idx]?.label ?? task.status}</span>
        )}
        {isActive && (
          <button type="button" onClick={handleDelete} disabled={isPending} className="text-xs text-neutral-200 hover:text-red-500 transition-colors shrink-0">
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function AddTaskForm({ cycleId, projectId, onDone }: { cycleId: string; projectId: string; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<TaskType>("DELIVERABLE");
  const [isBlocker, setIsBlocker] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await addTask(cycleId, projectId, formData);
      onDone();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-2 pt-3 border-t border-neutral-100">
      <div className="flex gap-2">
        <input name="name" required placeholder="Task name" className="flex-1 text-sm rounded border border-neutral-300 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-900" />
        <select name="type" value={type} onChange={(e) => setType(e.target.value as TaskType)} className="text-sm text-neutral-900 rounded border border-neutral-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900">
          <option value="DELIVERABLE">Deliverable</option>
          <option value="INTERNAL">Internal</option>
          <option value="FIX_UPDATE">Fix / Update</option>
        </select>
        <select name="status" defaultValue="PLANNING" className="text-sm text-neutral-900 rounded border border-neutral-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900">
          {(type === "INTERNAL" ? INTERNAL_STATUSES : STATUSES).map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <input name="description" placeholder="Description (optional)" className="flex-1 text-sm rounded border border-neutral-300 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-900" />
        <select name="ownerRole" className="text-sm text-neutral-900 rounded border border-neutral-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900">
          <option value="">Owner…</option>
          {OWNER_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <input name="dueDate" type="date" className="text-sm rounded border border-neutral-300 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-900" />
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
          <input
            type="checkbox"
            name="isBlocker"
            checked={isBlocker}
            onChange={(e) => setIsBlocker(e.target.checked)}
            className="accent-red-600"
          />
          Blocker
        </label>
        {isBlocker && (
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            Resolver
            <select name="blockerResolver" className="text-xs text-neutral-900 rounded border border-neutral-300 px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900">
              <option value="">Choose…</option>
              {OWNER_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
        )}
        {type === "DELIVERABLE" && (
          <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
            <input type="checkbox" name="requiresClientApproval" className="accent-neutral-900" />
            Requires client approval
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="text-xs px-3 py-1.5 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50 transition-colors">
          {isPending ? "Adding…" : "Add task"}
        </button>
        <button type="button" onClick={onDone} className="text-xs text-neutral-500 hover:text-neutral-800 transition-colors">Cancel</button>
      </div>
    </form>
  );
}

function CycleFocus({ cycle }: { cycle: Cycle }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cycle.focus ?? "");
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-neutral-300 hover:text-white text-left transition-colors mt-1"
      >
        {cycle.focus ? `Focus: ${cycle.focus}` : "+ Add focus / what needs to happen"}
      </button>
    );
  }

  return (
    <div className="mt-2 flex items-start gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="What needs to happen this cycle…"
        className="flex-1 text-xs rounded border border-neutral-600 bg-neutral-800 text-neutral-100 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 resize-none"
      />
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(async () => { await updateCycleFocus(cycle.id, value); setEditing(false); })}
        className="text-xs px-2.5 py-1 rounded-md bg-white text-neutral-900 hover:bg-neutral-100 transition-colors"
      >
        Save
      </button>
    </div>
  );
}

function toDateInput(d: Date | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function CycleEditForm({ cycle, onDone }: { cycle: Cycle; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(cycle.name);
  const [startDate, setStartDate] = useState(toDateInput(cycle.startDate));
  const [endDate, setEndDate] = useState(toDateInput(cycle.endDate));

  function save() {
    startTransition(async () => {
      await updateCycle(cycle.id, { name, startDate, endDate: endDate || null });
      onDone();
    });
  }

  return (
    <div className="flex items-end gap-2 flex-wrap">
      <div>
        <label className="block text-xs text-neutral-400 mb-0.5">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-sm text-neutral-900 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-neutral-400 placeholder:text-neutral-500"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-400 mb-0.5">Start</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="text-sm text-neutral-100 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-neutral-400 [color-scheme:dark]"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-400 mb-0.5">End</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="text-sm text-neutral-100 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-neutral-400 [color-scheme:dark]"
        />
      </div>
      <button type="button" onClick={save} disabled={isPending} className="text-xs px-2.5 py-1.5 rounded-md bg-white text-neutral-900 hover:bg-neutral-100 transition-colors">
        {isPending ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={onDone} className="text-xs px-2.5 py-1.5 text-neutral-400 hover:text-white transition-colors">Cancel</button>
    </div>
  );
}

function CloseCycleControl({ cycle, otherActiveCycles }: { cycle: Cycle; otherActiveCycles: { id: string; name: string }[] }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [target, setTarget] = useState("");
  const openCount = cycle.tasks.filter((t) => t.status !== "DONE").length;

  function close(carryTo?: string) {
    startTransition(async () => {
      await closeCycle(cycle.id, carryTo);
      setConfirming(false);
    });
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} disabled={isPending} className="text-xs px-3 py-1.5 rounded-md border border-neutral-600 text-neutral-300 hover:border-neutral-400 hover:text-white transition-colors">
        Close cycle
      </button>
    );
  }

  if (openCount === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-300">Close this cycle?</span>
        <button type="button" onClick={() => close()} disabled={isPending} className="text-xs px-2.5 py-1 rounded-md bg-white text-neutral-900 hover:bg-neutral-100 transition-colors">Confirm</button>
        <button type="button" onClick={() => setConfirming(false)} className="text-xs text-neutral-400 hover:text-white transition-colors">Cancel</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end max-w-md">
      <span className="text-xs text-neutral-300">{openCount} open —</span>
      {otherActiveCycles.length > 0 && (
        <>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="text-xs rounded border border-neutral-600 bg-neutral-800 text-neutral-200 px-2 py-1 focus:outline-none">
            <option value="">move to…</option>
            {otherActiveCycles.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <button type="button" onClick={() => close(target)} disabled={isPending || !target} className="text-xs px-2.5 py-1 rounded-md bg-white text-neutral-900 hover:bg-neutral-100 disabled:opacity-40 transition-colors">Move &amp; close</button>
        </>
      )}
      <button type="button" onClick={() => close()} disabled={isPending} className="text-xs px-2.5 py-1 rounded-md border border-neutral-600 text-neutral-300 hover:text-white transition-colors">Close anyway</button>
      <button type="button" onClick={() => setConfirming(false)} className="text-xs text-neutral-400 hover:text-white transition-colors">Cancel</button>
    </div>
  );
}

export default function CycleBoard({
  cycle,
  projectId,
  otherActiveCycles = [],
}: {
  cycle: Cycle;
  projectId: string;
  otherActiveCycles?: { id: string; name: string }[];
}) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isActive = cycle.status === "ACTIVE";

  const tasksByStatus = Object.fromEntries(
    STATUSES.map(({ key }) => [key, cycle.tasks.filter((t) => t.status === key)])
  ) as Record<TaskStatus, Task[]>;

  const doneCount = tasksByStatus.DONE.length;
  const totalCount = cycle.tasks.length;

  function handleReopen() {
    startTransition(async () => { await reopenCycle(cycle.id); });
  }
  function handleDelete() {
    if (!confirm(`Delete cycle "${cycle.name}"? All tasks will be lost.`)) return;
    startTransition(async () => { await deleteCycle(cycle.id); });
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${isActive ? "border-neutral-900" : "border-neutral-200"} ${isPending ? "opacity-60" : ""}`}>
      {/* Cycle header */}
      <div className={`px-5 py-4 flex items-start justify-between gap-3 ${isActive ? "bg-neutral-900 text-white" : "bg-white text-neutral-900"}`}>
        <div className="min-w-0 flex-1">
          {editing && isActive ? (
            <CycleEditForm cycle={cycle} onDone={() => setEditing(false)} />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-semibold ${isActive ? "text-white" : "text-neutral-900"}`}>{cycle.name}</h3>
                {!isActive && <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">Closed</span>}
              </div>
              <p className="text-xs mt-0.5 text-neutral-500">
                {new Date(cycle.startDate).toLocaleDateString()}
                {cycle.endDate && <> — {new Date(cycle.endDate).toLocaleDateString()}</>}
                {totalCount > 0 && <> · {doneCount}/{totalCount} done</>}
              </p>
              {isActive ? <CycleFocus cycle={cycle} /> : cycle.focus && (
                <p className="text-xs text-neutral-600 mt-1">Focus: {cycle.focus}</p>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isActive ? (
            <>
              <button type="button" onClick={() => setEditing((v) => !v)} disabled={isPending} className="text-xs px-3 py-1.5 rounded-md border border-neutral-600 text-neutral-300 hover:border-neutral-400 hover:text-white transition-colors">
                {editing ? "Close" : "Edit"}
              </button>
              <button type="button" onClick={() => setShowAddTask((v) => !v)} disabled={isPending} className="text-xs px-3 py-1.5 rounded-md border border-neutral-600 text-neutral-300 hover:border-neutral-400 hover:text-white transition-colors">+ Task</button>
              <CloseCycleControl cycle={cycle} otherActiveCycles={otherActiveCycles} />
            </>
          ) : (
            <>
              <button type="button" onClick={handleReopen} disabled={isPending} className="text-xs px-3 py-1.5 rounded-md border border-neutral-300 text-neutral-500 hover:bg-neutral-50 transition-colors">Reopen</button>
              <button type="button" onClick={handleDelete} disabled={isPending} className="text-xs text-neutral-600 hover:text-red-500 transition-colors">Delete</button>
            </>
          )}
        </div>
      </div>

      {/* Task board */}
      <div className="p-4 bg-neutral-50">
        {cycle.tasks.length === 0 && !showAddTask ? (
          <p className="text-sm text-neutral-600 text-center py-4">
            No tasks yet.{" "}
            {isActive && <button type="button" onClick={() => setShowAddTask(true)} className="underline underline-offset-2">Add the first one.</button>}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {COLUMNS.map(({ key, label, statuses }) => {
              const col = cycle.tasks.filter((t) => statuses.includes(t.status));
              const isDoneCol = key === "DONE";
              return (
                <div key={key} className="rounded-lg bg-white border border-neutral-200 p-2.5">
                  <div className="flex items-center justify-between mb-2 px-0.5">
                    <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">{label}</span>
                    <span className={`text-xs font-medium px-1.5 rounded-full ${
                      col.length > 0 ? "bg-neutral-100 text-neutral-600" : "text-neutral-300"
                    }`}>
                      {col.length}
                    </span>
                  </div>
                  <div className={`space-y-2 min-h-[3rem] ${isDoneCol ? "opacity-80" : ""}`}>
                    {col.length === 0 ? (
                      <div className="h-12 rounded-md border border-dashed border-neutral-200" />
                    ) : (
                      col.map((task) => (<TaskCard key={task.id} task={task} projectId={projectId} isActive={isActive} />))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showAddTask && isActive && (
          <div className="mt-3">
            <AddTaskForm cycleId={cycle.id} projectId={projectId} onDone={() => setShowAddTask(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
