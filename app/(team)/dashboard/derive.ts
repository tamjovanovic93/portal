import type { Accent } from "@/components/ui/kit";
import type { StatTile } from "@/components/team/StatTiles";
import type { WorkMember, WorkQuestion } from "@/components/team/MyWork";
import { STAGE_LABELS, STAGE_INFO, FINAL_STAGE, GATED_STAGES, WIREFRAME_STAGE } from "@/lib/stages";
import { FEED_NOTIFICATION_TYPES } from "@/lib/notification-types";
import type { DashboardData, DashboardProject } from "./queries";
import { daysSince, formatUpcomingDate } from "@/lib/format";
export { timeAgo, formatUpcomingDate, daysSince } from "@/lib/format";

// Pure derivations for the dashboard — no I/O. Every number here matches what
// the page computed before the data layer moved to aggregates.

const DAY = 86400000;

export const STAGE_LIST = Object.values(STAGE_LABELS);

export const STAGE_DESCRIPTIONS: Record<number, string> = Object.fromEntries(
  Object.entries(STAGE_INFO).map(([n, i]) => [Number(n), i.description])
);

export function healthAccent(h: number): Accent {
  return h > 0.75 ? "mint" : h > 0.5 ? "amber" : "rose";
}

export const clientName = (p: { client: { name: string | null; email: string } }) => p.client.name ?? p.client.email;

export function hasGatePending(p: DashboardProject) {
  return p.stages.some((s) => s.status === "GATE_PENDING");
}

export function getPendingStatus(p: DashboardProject) {
  if (hasGatePending(p)) return { label: "Client approval needed", actor: "client" as const };
  if (p.stats.materials.pending > 0) return { label: "Awaiting client materials", actor: "client" as const };
  if (p.stats.draftDocs > 0) return { label: "Document to send", actor: "team" as const };
  return { label: "Team working", actor: "team" as const };
}

export function getBlockingLine(p: DashboardProject): { text: string; dot: Accent; blocking: boolean } {
  const gate = p.stages.find((s) => s.status === "GATE_PENDING");
  if (gate) return { text: `Gate pending · ${STAGE_LABELS[gate.stageNumber]}`, dot: "amber", blocking: true };
  if (p.stats.materials.submitted > 0) return { text: "Client materials to review", dot: "blue", blocking: true };
  if (p.stats.materials.pending > 0) return { text: "Awaiting client materials", dot: "amber", blocking: true };
  if (p.stats.draftDocs > 0) return { text: "Document to send", dot: "mint", blocking: true };
  return { text: STAGE_DESCRIPTIONS[p.currentStage] ?? "In progress", dot: "mint", blocking: false };
}

// Project health (0..1), derived from what's blocking / overdue / stale.
export function computeHealth(p: DashboardProject, now: Date): number {
  let h = 1;
  if (hasGatePending(p)) h -= 0.3;
  h -= Math.min(0.3, p.stats.materials.overdue * 0.12);
  h -= Math.min(0.15, p.stats.draftDocs * 0.05);
  h -= Math.min(0.4, p.stats.tasks.blockers * 0.15);
  h -= Math.min(0.3, p.stats.tasks.overdue * 0.08);
  const days = (now.getTime() - p.updatedAt.getTime()) / DAY;
  if (days > 7 && p.mode !== "ONGOING") h -= 0.15;
  return Math.max(0.1, Math.min(1, h));
}

export type RetainerStat = {
  id: string; name: string; clientName: string; cycleName: string | null;
  openCount: number; overdueCount: number; awaitingClientCount: number;
};

export type FeedItem = { key: string; label: string; projectId: string; projectName: string; at: Date };
export type UpcomingItem = { id: string; title: string; startAt: Date; type: string; sourceType: string; projectName?: string };
export type NotificationItem = { key: string; projectName: string; label: string; dot: Accent; at: Date; href: string };
export type NeedsYouItem = { key: string; dot: Accent; label: string; href: string };
export type WaitingItem = { key: string; label: string; sub: string; href: string; dot: Accent };

const DOC_LABELS: Record<string, string> = {
  intake_form: "Intake form submitted",
  scope_of_work: "Scope of Work completed",
  feedback_revision: "Revision request submitted",
  review_signoff: "Review & sign-off submitted",
};

export function deriveDashboard(d: DashboardData) {
  const { now, fiveDaysAgo, sevenDaysAgo, projects, team } = d;

  const workMembers: WorkMember[] = team.map((m) => ({ id: m.id, name: m.name, color: m.color }));

  const taskNameById = new Map(d.questionTasks.map((t) => [t.id, t.name]));
  const memberQuestions: WorkQuestion[] = d.memberQuestionsRaw.map((q) => ({
    id: q.id,
    assigneeId: q.recipientId!,
    questionText: q.questionText,
    taskName: q.contextType === "TASK" && q.contextId ? taskNameById.get(q.contextId) ?? null : null,
    projectId: q.project?.id ?? null,
    projectName: q.project?.name ?? null,
  }));

  const gateProjects = projects.filter(hasGatePending);
  const healthById = new Map(projects.map((p) => [p.id, computeHealth(p, now)]));
  const staleProjects = projects.filter(
    (p) => p.mode !== "ONGOING" && !hasGatePending(p) && p.updatedAt < fiveDaysAgo && p.currentStage < FINAL_STAGE
  );
  const overdueProjects = projects.filter((p) => p.stats.materials.overdue > 0);

  const feedItems: FeedItem[] = [
    ...d.recentApprovals.map((a) => ({
      key: `approval-${a.id}`,
      label: `${a.approvedBy.name ?? a.approvedBy.email} approved stage ${a.stageNumber}`,
      projectId: a.projectId,
      projectName: a.project.name,
      at: a.approvedAt,
    })),
    ...d.recentUploads.map((u) => ({
      key: `upload-${u.id}`,
      label: `File uploaded — ${u.filename}`,
      projectId: u.projectId,
      projectName: u.project.name,
      at: u.uploadedAt,
    })),
    ...d.recentStageCompletions
      .filter((s) => s.completedAt)
      .map((s) => ({
        key: `stage-${s.id}`,
        label: `Stage ${s.stageNumber} (${STAGE_LABELS[s.stageNumber]}) completed`,
        projectId: s.projectId,
        projectName: s.project.name,
        at: s.completedAt!,
      })),
  ];
  feedItems.sort((a, b) => b.at.getTime() - a.at.getTime());
  const feed = feedItems.slice(0, 12);

  const upcoming: UpcomingItem[] = [
    ...d.upcomingEvents.map((e) => ({ id: e.id, title: e.title, startAt: e.startAt, type: e.type, sourceType: "manual", projectName: e.project?.name })),
    ...d.upcomingTasks.map((t) => ({ id: `task-${t.id}`, title: t.name, startAt: t.dueDate!, type: "TASK_DUE", sourceType: "task", projectName: t.cycle.project.name })),
    ...d.upcomingMaterials.map((m) => ({ id: `mat-${m.id}`, title: `${m.label} due`, startAt: m.dueDate!, type: "DEADLINE", sourceType: "material", projectName: m.project.name })),
  ];
  upcoming.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  // ── Notifications (client actions, last 7 days) ──
  const notifications: NotificationItem[] = [];
  d.clientSubmittedDocs.forEach((doc) => {
    if (!doc.completedAt || !doc.project) return;
    notifications.push({
      key: `notif-doc-${doc.id}`, projectName: doc.project.name,
      label: DOC_LABELS[doc.templateType] ?? `Document submitted — ${doc.title}`,
      dot: "blue", at: doc.completedAt,
      href: `/projects/${doc.project.id}/stage/${doc.stageNumber}/documents/${doc.id}`,
    });
  });
  d.wireframeFeedbackDocs.forEach((doc) => {
    if (!doc.completedAt || !doc.project) return;
    notifications.push({ key: `notif-wf-${doc.id}`, projectName: doc.project.name, label: "Wireframe feedback received", dot: "purple", at: doc.completedAt, href: `/projects/${doc.project.id}/stage/${WIREFRAME_STAGE}` });
  });
  d.clientSubmittedMaterials.forEach((mat) => {
    notifications.push({ key: `notif-mat-${mat.id}`, projectName: mat.project.name, label: `Client submitted — ${mat.label}`, dot: "amber", at: mat.updatedAt, href: `/projects/${mat.project.id}/materials` });
  });
  d.recentUploads
    .filter((u) => u.uploadedBy === u.project.clientId && u.uploadedAt >= sevenDaysAgo)
    .forEach((u) => {
      notifications.push({ key: `notif-upload-${u.id}`, projectName: u.project.name, label: `Uploaded — ${u.filename}`, dot: "blue", at: u.uploadedAt, href: `/projects/${u.project.id}?tab=files` });
    });
  d.recentTaskApprovals.forEach((a) => {
    notifications.push({ key: `notif-task-${a.id}`, projectName: a.project.name, label: `Approved deliverable — ${a.task?.name ?? "task"}`, dot: "mint", at: a.approvedAt, href: `/projects/${a.project.id}` });
  });
  // Client → team actions captured in the Notification table that the derived
  // feed above doesn't cover — chiefly answered questions, confirmations and
  // approved edits. Doc submissions are already covered above.
  d.teamNotificationsRaw
    .filter((n) => FEED_NOTIFICATION_TYPES.has(n.type))
    .forEach((n) => {
      notifications.push({ key: `notif-tbl-${n.id}`, projectName: "", label: n.message, dot: "blue", at: n.createdAt, href: n.link ?? "/dashboard" });
    });
  notifications.sort((a, b) => b.at.getTime() - a.at.getTime());

  // ── Retainer aggregates ──
  const retainerStats: RetainerStat[] = projects
    .filter((p) => p.mode === "ONGOING")
    .map((p) => ({
      id: p.id, name: p.name, clientName: clientName(p),
      cycleName: p.stats.activeCycleName,
      openCount: p.stats.tasks.open, overdueCount: p.stats.tasks.overdue, awaitingClientCount: p.stats.tasks.awaiting,
    }));
  const retainerOverdue = retainerStats.filter((r) => r.overdueCount > 0);
  const retainerAwaiting = retainerStats.filter((r) => r.awaitingClientCount > 0);

  const advancableProjects = projects.filter((p) => {
    if (!GATED_STAGES.includes(p.currentStage)) return false;
    const row = p.stages.find((s) => s.stageNumber === p.currentStage);
    return row?.gateApproved && row?.status !== "COMPLETE";
  });
  const draftDocProjects = projects.filter((p) => p.stats.draftDocs > 0);

  const needsYou: NeedsYouItem[] = [
    ...advancableProjects.map((p) => ({ key: `adv-${p.id}`, dot: "mint" as const, label: `${clientName(p)} — ready to advance to ${STAGE_LABELS[p.currentStage + 1] ?? "next stage"}`, href: `/projects/${p.id}` })),
    ...gateProjects.map((p) => {
      const gs = p.stages.find((s) => s.status === "GATE_PENDING");
      return { key: `gate-${p.id}`, dot: "rose" as const, label: `${clientName(p)} — awaiting client sign-off (${STAGE_LABELS[gs?.stageNumber ?? p.currentStage]})`, href: `/projects/${p.id}` };
    }),
    ...retainerAwaiting.map((r) => ({ key: `rawait-${r.id}`, dot: "amber" as const, label: `${r.clientName} — ${r.awaitingClientCount} deliverable${r.awaitingClientCount !== 1 ? "s" : ""} awaiting client`, href: `/projects/${r.id}` })),
    ...overdueProjects
      .filter((p) => !gateProjects.find((g) => g.id === p.id))
      .map((p) => ({ key: `ovd-${p.id}`, dot: "amber" as const, label: `${clientName(p)} — materials overdue`, href: `/projects/${p.id}/materials` })),
    ...retainerOverdue.map((r) => ({ key: `rovd-${r.id}`, dot: "rose" as const, label: `${r.clientName} — ${r.overdueCount} retainer task${r.overdueCount !== 1 ? "s" : ""} overdue`, href: `/projects/${r.id}` })),
    ...draftDocProjects.map((p) => {
      const c = p.stats.draftDocs;
      return { key: `draft-${p.id}`, dot: "mint" as const, label: `${clientName(p)} — ${c} document${c !== 1 ? "s" : ""} to send`, href: `/projects/${p.id}` };
    }),
    ...staleProjects.map((p) => ({ key: `stale-${p.id}`, dot: "mint" as const, label: `${clientName(p)} — no activity for ${daysSince(p.updatedAt, now)}d`, href: `/projects/${p.id}` })),
  ];

  const statTiles: StatTile[] = [
    {
      key: "engagements", n: projects.length, label: "Active engagements", color: "mint", icon: "folder",
      items: projects.map((p) => ({ key: p.id, label: p.name, sub: clientName(p), href: `/projects/${p.id}` })),
    },
    {
      key: "needsYou", n: needsYou.length, label: "Need you", color: "amber", icon: "alert",
      items: needsYou.map((n) => ({ key: n.key, label: n.label, href: n.href, dot: n.dot })),
    },
    {
      key: "fromClients", n: notifications.length, label: "From clients", color: "blue", icon: "bell",
      items: notifications.map((n) => ({ key: n.key, label: n.label, sub: n.projectName, href: n.href, dot: n.dot })),
    },
    {
      key: "upcoming", n: upcoming.length, label: "Upcoming (14d)", color: "mint", icon: "calendar",
      items: upcoming.map((u) => ({
        key: u.id, label: u.title,
        sub: `${u.projectName ? `${u.projectName} · ` : ""}${formatUpcomingDate(u.startAt, now)}`,
        href: "/calendar",
      })),
    },
  ];

  const waitingItems: WaitingItem[] = [
    ...d.waitingQuestions.map((q) => ({
      key: `q-${q.id}`,
      label: q.kind === "CONFIRM" ? "Confirmation requested" : "Question awaiting answer",
      sub: `${q.project?.name ?? "—"} · ${q.questionText.slice(0, 40)}${q.questionText.length > 40 ? "…" : ""}`,
      href: q.project ? `/projects/${q.project.id}` : "/dashboard",
      dot: "amber" as Accent,
    })),
    ...gateProjects.map((p) => ({ key: `gate-${p.id}`, label: "Client sign-off needed", sub: clientName(p), href: `/projects/${p.id}`, dot: "rose" as Accent })),
    ...overdueProjects.map((p) => ({ key: `mat-${p.id}`, label: "Materials outstanding", sub: clientName(p), href: `/projects/${p.id}/materials`, dot: "blue" as Accent })),
    ...d.waitingDocs.map((doc) => {
      const who = doc.client?.name ?? doc.client?.email ?? doc.project?.name ?? "Client";
      const label =
        doc.templateType === "intake_form"
          ? "Intake form — waiting on client"
          : doc.templateType === "financial_offer"
          ? "Offer — waiting on client approval"
          : "Initial form — waiting on client";
      return {
        key: `doc-${doc.id}`,
        label,
        sub: `${who} · ${doc.title}`,
        href: doc.projectId ? `/projects/${doc.projectId}` : doc.clientId ? `/clients/${doc.clientId}` : "/dashboard",
        dot: "amber" as Accent,
      };
    }),
  ];

  return {
    workMembers, memberQuestions, gateProjects, healthById, feed, notifications,
    retainerStats, needsYou, statTiles, waitingItems,
  };
}
