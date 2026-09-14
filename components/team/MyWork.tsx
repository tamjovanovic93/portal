"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Avatar, Pill, VAR, type Accent } from "@/components/ui/kit";
import { listWorkTasks } from "@/app/actions/work";

export type WorkTask = {
  id: string;
  name: string;
  status: string;
  dueDate: string | null;
  isBlocker: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  projectId: string;
  projectName: string;
};

export type WorkMember = { id: string; name: string; color: Accent };

export type WorkQuestion = {
  id: string;
  assigneeId: string;
  questionText: string;
  taskName: string | null;
  projectId: string | null;
  projectName: string | null;
};

export type WorkloadCounts = { active: number; overdue: number; dueSoon: number; blocked: number };

type StatusFilter = "active" | "due_soon" | "overdue" | "blocked" | "done" | "all";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "due_soon", label: "Due soon" },
  { key: "overdue", label: "Overdue" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Completed" },
  { key: "all", label: "All" },
];

const DAY = 86400000;
const EMPTY_COUNTS: WorkloadCounts = { active: 0, overdue: 0, dueSoon: 0, blocked: 0 };

function classify(t: WorkTask, now: number) {
  const due = t.dueDate ? new Date(t.dueDate).getTime() : null;
  const done = t.status === "DONE";
  const overdue = !done && due !== null && due < now;
  const dueSoon = !done && due !== null && due >= now && due <= now + 3 * DAY;
  const blocked = !done && t.isBlocker;
  return { done, overdue, dueSoon, blocked };
}

// `tasks` are the current member's tasks; other members and "Everyone" are
// fetched on demand so the page does not ship every task up front. Per-member
// workload counts come precomputed from the server.
export default function MyWork({
  tasks,
  workload,
  members,
  questions = [],
  currentUserId,
}: {
  tasks: WorkTask[];
  workload: Record<string, WorkloadCounts>;
  members: WorkMember[];
  questions?: WorkQuestion[];
  currentUserId: string;
}) {
  // Nothing selected by default: show only the member bubbles. The task list
  // appears once a person is chosen (bubble / dropdown) or a category is picked.
  const [who, setWho] = useState<string>("");
  const [status, setStatus] = useState<StatusFilter | "">("");
  const [tasksByWho, setTasksByWho] = useState<Record<string, WorkTask[]>>(() =>
    currentUserId ? { [currentUserId]: tasks } : {}
  );
  const [loading, startLoading] = useTransition();
  const [now] = useState(() => Date.now());

  const showList = who !== "" || status !== "";
  const effectiveWho = who === "" ? "all" : who;
  const effectiveStatus: StatusFilter = status === "" ? "active" : status;

  function ensureLoaded(key: string) {
    if (tasksByWho[key]) return;
    startLoading(async () => {
      const rows = await listWorkTasks(key === "all" ? "all" : key);
      setTasksByWho((prev) => ({ ...prev, [key]: rows }));
    });
  }
  function selectWho(next: string) {
    setWho(next);
    const key = next === "" ? (status !== "" ? "all" : null) : next;
    if (key) ensureLoaded(key);
  }
  function selectStatus(next: StatusFilter | "") {
    setStatus(next);
    if (next !== "" || who !== "") ensureLoaded(who === "" ? "all" : who);
  }

  const questionsByMember = useMemo(() => {
    const map = new Map<string, WorkQuestion[]>();
    for (const q of questions) {
      if (!map.has(q.assigneeId)) map.set(q.assigneeId, []);
      map.get(q.assigneeId)!.push(q);
    }
    return map;
  }, [questions]);

  const selectedQuestions = useMemo(() => {
    if (!showList) return [];
    if (effectiveWho === "all") return questions;
    return questionsByMember.get(effectiveWho) ?? [];
  }, [showList, effectiveWho, questions, questionsByMember]);

  const filtered = useMemo(() => {
    if (!showList) return [];
    const source = tasksByWho[effectiveWho] ?? [];
    return source.filter((t) => {
      if (effectiveWho !== "all" && t.assigneeId !== effectiveWho) return false;
      const k = classify(t, now);
      switch (effectiveStatus) {
        case "active": return !k.done;
        case "due_soon": return k.dueSoon;
        case "overdue": return k.overdue;
        case "blocked": return k.blocked;
        case "done": return k.done;
        case "all": return true;
      }
    }).sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - db;
    });
  }, [tasksByWho, showList, effectiveWho, effectiveStatus, now]);

  return (
    <div className="card card-pad space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ fontWeight: 600, fontSize: 14 }}>Tasks</span>
        <div className="flex-1" />
        <select className="zp-select" style={{ width: "auto", fontSize: 12 }} value={who} onChange={(e) => selectWho(e.target.value)}>
          <option value="">Who…</option>
          <option value={currentUserId}>My tasks</option>
          <option value="all">Everyone</option>
          {members.filter((m) => m.id !== currentUserId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="zp-select" style={{ width: "auto", fontSize: 12 }} value={status} onChange={(e) => selectStatus(e.target.value as StatusFilter | "")}>
          <option value="">Category…</option>
          {STATUS_FILTERS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        {showList && (
          <button type="button" onClick={() => { setWho(""); setStatus(""); }} className="faint" style={{ fontSize: 11.5, cursor: "pointer", background: "transparent", border: 0 }} title="Back to overview">
            Clear
          </button>
        )}
      </div>

      {/* Workload strip */}
      <div className="flex flex-wrap gap-2">
        {members.map((m) => {
          const c = workload[m.id] ?? EMPTY_COUNTS;
          const selected = who === m.id;
          return (
            <button key={m.id} type="button" onClick={() => selectWho(selected ? "" : m.id)}
              className="flex items-center gap-2" style={{ padding: "6px 10px", borderRadius: "var(--r-md)", border: `1px solid ${selected ? VAR[m.color] : "var(--border)"}`, background: selected ? "var(--feature-grad)" : "var(--surface-2)" }}>
              <Avatar name={m.name} color={m.color} size={22} />
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{m.name}</span>
              <span className="tech" style={{ fontSize: 11, color: VAR[m.color] }}>{c.active}</span>
              {c.overdue > 0 && <Pill color="rose" style={{ fontSize: 9 }}>{c.overdue} od</Pill>}
              {c.blocked > 0 && <Pill color="amber" style={{ fontSize: 9 }}>{c.blocked} bl</Pill>}
              {(questionsByMember.get(m.id)?.length ?? 0) > 0 && (
                <Pill color="blue" style={{ fontSize: 9 }}>{questionsByMember.get(m.id)!.length} q</Pill>
              )}
            </button>
          );
        })}
      </div>

      {/* Questions directed at the selected member(s) under a task */}
      {showList && selectedQuestions.length > 0 && (
        <div className="flex flex-col" style={{ gap: 2 }}>
          <span className="tech" style={{ fontSize: 10.5, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Questions ({selectedQuestions.length})
          </span>
          {selectedQuestions.slice(0, 20).map((q) => (
            <Link
              key={q.id}
              href={q.projectId ? `/projects/${q.projectId}` : "/dashboard"}
              className="flex items-center gap-2.5"
              style={{ padding: "7px 8px", borderRadius: "var(--r-md)" }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: VAR.blue, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, flex: 1 }} className="truncate">{q.questionText}</span>
              {q.taskName && <span className="faint truncate" style={{ fontSize: 11, maxWidth: 130 }}>{q.taskName}</span>}
              <Pill color="blue" style={{ fontSize: 9 }}>Q</Pill>
            </Link>
          ))}
        </div>
      )}

      {/* Task list — only once a person or category is selected */}
      {!showList ? (
        <p className="faint" style={{ fontSize: 12.5 }}>Pick a person above or choose a category to see their tasks.</p>
      ) : filtered.length === 0 ? (
        <p className="faint" style={{ fontSize: 12.5 }}>{loading && !tasksByWho[effectiveWho] ? "Loading…" : "No tasks match this filter."}</p>
      ) : (
        <div className="flex flex-col" style={{ gap: 2 }}>
          {filtered.slice(0, 40).map((t) => {
            const k = classify(t, now);
            const dot: Accent = k.overdue ? "rose" : k.blocked ? "amber" : k.dueSoon ? "blue" : k.done ? "mint" : "mint";
            return (
              <Link key={t.id} href={`/projects/${t.projectId}`} className="flex items-center gap-2.5" style={{ padding: "7px 8px", borderRadius: "var(--r-md)" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: VAR[dot], flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, flex: 1, textDecoration: k.done ? "line-through" : "none", opacity: k.done ? 0.6 : 1 }} className="truncate">{t.name}</span>
                <span className="faint truncate" style={{ fontSize: 11, maxWidth: 130 }}>{t.projectName}</span>
                {t.assigneeName && effectiveWho === "all" && <span className="faint" style={{ fontSize: 11 }}>{t.assigneeName}</span>}
                {t.dueDate && <span className="faint" style={{ fontSize: 11, flexShrink: 0 }}>{new Date(t.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                {k.blocked && <Pill color="amber" style={{ fontSize: 9 }}>BLOCKED</Pill>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
