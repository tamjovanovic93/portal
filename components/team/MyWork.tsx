"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, Pill, VAR, type Accent } from "@/components/ui/kit";

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

function classify(t: WorkTask, now: number) {
  const due = t.dueDate ? new Date(t.dueDate).getTime() : null;
  const done = t.status === "DONE";
  const overdue = !done && due !== null && due < now;
  const dueSoon = !done && due !== null && due >= now && due <= now + 3 * DAY;
  const blocked = !done && t.isBlocker;
  return { done, overdue, dueSoon, blocked };
}

export default function MyWork({
  tasks,
  members,
  currentUserId,
}: {
  tasks: WorkTask[];
  members: WorkMember[];
  currentUserId: string;
}) {
  const meHasTasks = tasks.some((t) => t.assigneeId === currentUserId);
  const [who, setWho] = useState<string>(meHasTasks ? currentUserId : "all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const now = Date.now();

  // Per-member workload counts (from the same task set — one source of truth).
  const workload = useMemo(() => {
    const map = new Map<string, { active: number; overdue: number; dueSoon: number; blocked: number }>();
    for (const m of members) map.set(m.id, { active: 0, overdue: 0, dueSoon: 0, blocked: 0 });
    for (const t of tasks) {
      if (!t.assigneeId || !map.has(t.assigneeId)) continue;
      const c = map.get(t.assigneeId)!;
      const k = classify(t, now);
      if (!k.done) c.active++;
      if (k.overdue) c.overdue++;
      if (k.dueSoon) c.dueSoon++;
      if (k.blocked) c.blocked++;
    }
    return map;
  }, [tasks, members, now]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (who === "me" ? t.assigneeId !== currentUserId : who !== "all" && t.assigneeId !== who) return false;
      const k = classify(t, now);
      switch (status) {
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
  }, [tasks, who, status, currentUserId, now]);

  return (
    <div className="card card-pad space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ fontWeight: 600, fontSize: 14 }}>Tasks</span>
        <div className="flex-1" />
        <select className="zp-select" style={{ width: "auto", fontSize: 12 }} value={who} onChange={(e) => setWho(e.target.value)}>
          <option value={currentUserId}>My tasks</option>
          <option value="all">Everyone</option>
          {members.filter((m) => m.id !== currentUserId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="zp-select" style={{ width: "auto", fontSize: 12 }} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          {STATUS_FILTERS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {/* Workload strip */}
      <div className="flex flex-wrap gap-2">
        {members.map((m) => {
          const c = workload.get(m.id)!;
          const selected = who === m.id;
          return (
            <button key={m.id} type="button" onClick={() => setWho(selected ? "all" : m.id)}
              className="flex items-center gap-2" style={{ padding: "6px 10px", borderRadius: "var(--r-md)", border: `1px solid ${selected ? VAR[m.color] : "var(--border)"}`, background: selected ? "var(--feature-grad)" : "var(--surface-2)" }}>
              <Avatar name={m.name} color={m.color} size={22} />
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{m.name}</span>
              <span className="tech" style={{ fontSize: 11, color: VAR[m.color] }}>{c.active}</span>
              {c.overdue > 0 && <Pill color="rose" style={{ fontSize: 9 }}>{c.overdue} od</Pill>}
              {c.blocked > 0 && <Pill color="amber" style={{ fontSize: 9 }}>{c.blocked} bl</Pill>}
            </button>
          );
        })}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <p className="faint" style={{ fontSize: 12.5 }}>No tasks match this filter.</p>
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
                {t.assigneeName && who === "all" && <span className="faint" style={{ fontSize: 11 }}>{t.assigneeName}</span>}
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
