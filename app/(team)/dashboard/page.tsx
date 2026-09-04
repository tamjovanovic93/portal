import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ProjectType, StageStatus } from "@prisma/client";
import NewProjectButton from "@/components/team/NewProjectButton";
import Icon from "@/components/ui/Icon";
import { Eyebrow, Pill, StageBar, Health, Avatar, VAR, FILL, type Accent } from "@/components/ui/kit";
import { getTeamData, capacityColor } from "@/lib/team";
import { createClient } from "@/lib/supabase/server";
import { WAITING_CLIENT_STATUSES } from "@/lib/questions";
import MyWork, { type WorkTask, type WorkMember } from "@/components/team/MyWork";

function healthAccent(h: number): Accent {
  return h > 0.75 ? "mint" : h > 0.5 ? "amber" : "rose";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<number, string> = {
  1: "Onboarding", 2: "Strategy", 3: "Sketch", 4: "Make",
  5: "Build", 6: "Client Review", 7: "Launch", 8: "Complete",
};
const STAGE_LIST = Object.values(STAGE_LABELS);

const STAGE_DESCRIPTIONS: Record<number, string> = {
  1: "Intake, client database, brief",
  2: "Research, scope, materials checklist",
  3: "Wireframes / first direction",
  4: "Full design / creative output",
  5: "Build, QA, dev handoff",
  6: "Final review and sign-off",
  7: "Go live, delivery, handover",
  8: "Archived — record retained",
};

const TYPE_LABELS: Record<ProjectType, string> = {
  WEBSITE: "Website", BRANDING: "Branding", MARKETING: "Marketing",
  SOFTWARE_CRM: "Software / CRM", OTHER: "Other",
};

const EVENT_DOT: Record<string, Accent> = {
  MEETING: "blue", DEADLINE: "rose", APPROVAL_GATE: "amber",
  APPOINTMENT: "purple", MILESTONE: "mint", TASK_DUE: "mint",
  task: "mint", material: "rose",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: Date) {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86400000);
  return `${days}d ago`;
}

function formatUpcomingDate(d: Date) {
  const now = new Date();
  const diffDays = Math.floor((d.getTime() - now.setHours(0, 0, 0, 0)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function getPendingStatus(project: {
  stages: { status: StageStatus }[];
  materials: { status: string }[];
  documents: { status: string }[];
}) {
  if (project.stages.some((s) => s.status === "GATE_PENDING")) {
    return { label: "Client approval needed", actor: "client" as const };
  }
  if (project.materials.some((m) => m.status === "pending")) {
    return { label: "Awaiting client materials", actor: "client" as const };
  }
  if (project.documents.some((d) => d.status === "DRAFT")) {
    return { label: "Document to send", actor: "team" as const };
  }
  return { label: "Team working", actor: "team" as const };
}

function getBlockingLine(project: {
  currentStage: number;
  stages: { stageNumber: number; status: StageStatus }[];
  materials: { status: string }[];
  documents: { status: string }[];
}): { text: string; dot: Accent; blocking: boolean } {
  const gate = project.stages.find((s) => s.status === "GATE_PENDING");
  if (gate) {
    return { text: `Gate pending · ${STAGE_LABELS[gate.stageNumber]}`, dot: "amber", blocking: true };
  }
  if (project.materials.some((m) => m.status === "submitted")) {
    return { text: "Client materials to review", dot: "blue", blocking: true };
  }
  if (project.materials.some((m) => m.status === "pending")) {
    return { text: "Awaiting client materials", dot: "amber", blocking: true };
  }
  if (project.documents.some((d) => d.status === "DRAFT")) {
    return { text: "Document to send", dot: "mint", blocking: true };
  }
  return {
    text: STAGE_DESCRIPTIONS[project.currentStage] ?? "In progress",
    dot: "mint",
    blocking: false,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const fourteenDaysOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const [
    projects,
    recentApprovals,
    recentUploads,
    recentStageCompletions,
    upcomingEvents,
    upcomingTasks,
    upcomingMaterials,
    clientSubmittedDocs,
    wireframeFeedbackDocs,
    clientSubmittedMaterials,
    recentTaskApprovals,
  ] = await Promise.all([
    prisma.project.findMany({
      where: { isArchived: false },
      include: {
        client: { select: { name: true, email: true } },
        stages: { select: { stageNumber: true, status: true, gateApproved: true } },
        materials: { select: { status: true, dueDate: true } },
        documents: { select: { status: true } },
        cycles: {
          where: { status: "ACTIVE" },
          select: {
            name: true,
            tasks: {
              select: {
                status: true,
                type: true,
                dueDate: true,
                isBlocker: true,
                unblockedAt: true,
                requiresClientApproval: true,
                _count: { select: { approvals: true } },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.approval.findMany({
      take: 6,
      orderBy: { approvedAt: "desc" },
      include: {
        project: { select: { id: true, name: true } },
        approvedBy: { select: { name: true, email: true } },
      },
    }),
    prisma.projectAsset.findMany({
      take: 10,
      orderBy: { uploadedAt: "desc" },
      include: { project: { select: { id: true, name: true, clientId: true } } },
    }),
    prisma.projectStage.findMany({
      where: { completedAt: { not: null } },
      take: 6,
      orderBy: { completedAt: "desc" },
      include: { project: { select: { id: true, name: true } } },
    }),
    prisma.appEvent.findMany({
      where: { startAt: { gte: now, lte: fourteenDaysOut } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { startAt: "asc" },
      take: 8,
    }),
    prisma.task.findMany({
      where: { dueDate: { gte: now, lte: fourteenDaysOut }, status: { not: "DONE" } },
      include: { cycle: { include: { project: { select: { id: true, name: true } } } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.materialItem.findMany({
      where: { dueDate: { gte: now, lte: fourteenDaysOut }, status: { in: ["pending", "submitted"] } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.document.findMany({
      where: {
        status: "APPROVED",
        completedAt: { gte: sevenDaysAgo },
        templateType: { not: "wireframe_feedback" },
        handledAt: null, // reviewed items move to project history, off the action feed
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
    prisma.document.findMany({
      where: {
        templateType: "wireframe_feedback",
        status: "APPROVED",
        completedAt: { gte: sevenDaysAgo },
        handledAt: null,
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { completedAt: "desc" },
      take: 5,
    }),
    prisma.materialItem.findMany({
      where: { status: "submitted", updatedAt: { gte: sevenDaysAgo } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.approval.findMany({
      where: { taskId: { not: null }, approvedAt: { gte: sevenDaysAgo } },
      include: {
        task: { select: { name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { approvedAt: "desc" },
      take: 10,
    }),
  ]);

  const team = await getTeamData();

  // ── Current user (for "My tasks" default) ──
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const currentUserId = authUser?.id ?? "";

  // ── Connected PM data: tasks, blockers, waiting-on-client, meetings ──
  const [workTasksRaw, blockerTasks, waitingQuestions, meetings] = await Promise.all([
    // Tasks across active projects for the workload/My-Work view (bounded).
    prisma.task.findMany({
      where: { cycle: { project: { isArchived: false } } },
      select: {
        id: true, name: true, status: true, dueDate: true, isBlocker: true, assigneeId: true,
        assignee: { select: { name: true, email: true } },
        cycle: { select: { project: { select: { id: true, name: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    prisma.task.findMany({
      where: { isBlocker: true, unblockedAt: null, status: { not: "DONE" }, cycle: { project: { isArchived: false } } },
      select: {
        id: true, name: true, blockerResolver: true, dueDate: true,
        cycle: { select: { project: { select: { id: true, name: true, client: { select: { name: true, email: true } } } } } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.question.findMany({
      where: { status: { in: WAITING_CLIENT_STATUSES } },
      select: {
        id: true, questionText: true, kind: true, status: true, createdAt: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 30,
    }),
    prisma.appEvent.findMany({
      where: { type: "MEETING", startAt: { gte: now } },
      select: { id: true, title: true, startAt: true, project: { select: { id: true, name: true } } },
      orderBy: { startAt: "asc" },
      take: 8,
    }),
  ]);

  const workTasks: WorkTask[] = workTasksRaw.map((t) => ({
    id: t.id, name: t.name, status: t.status,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    isBlocker: t.isBlocker, assigneeId: t.assigneeId,
    assigneeName: t.assignee ? (t.assignee.name ?? t.assignee.email) : null,
    projectId: t.cycle.project.id, projectName: t.cycle.project.name,
  }));
  const workMembers: WorkMember[] = team.map((m) => ({ id: m.id, name: m.name, color: m.color }));

  // ── Derived data ──
  const gateProjects = projects.filter((p) => p.stages.some((s) => s.status === "GATE_PENDING"));

  // Project health (0..1), derived from what's blocking / overdue / stale.
  const healthById = new Map<string, number>();
  for (const p of projects) {
    let h = 1;
    if (p.stages.some((s) => s.status === "GATE_PENDING")) h -= 0.3;
    const overdueMat = p.materials.filter((m) => m.dueDate && m.dueDate < now && ["pending", "submitted"].includes(m.status)).length;
    h -= Math.min(0.3, overdueMat * 0.12);
    const drafts = p.documents.filter((d) => d.status === "DRAFT").length;
    h -= Math.min(0.15, drafts * 0.05);
    const blockers = p.cycles.flatMap((c) => c.tasks).filter((t) => t.isBlocker && !t.unblockedAt && t.status !== "DONE").length;
    h -= Math.min(0.4, blockers * 0.15);
    const overdueTasks = p.cycles.flatMap((c) => c.tasks).filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate < now).length;
    h -= Math.min(0.3, overdueTasks * 0.08);
    const daysSince = (now.getTime() - p.updatedAt.getTime()) / 86400000;
    if (daysSince > 7 && p.mode !== "ONGOING") h -= 0.15;
    healthById.set(p.id, Math.max(0.1, Math.min(1, h)));
  }
  const staleProjects = projects.filter(
    (p) =>
      p.mode !== "ONGOING" &&
      !p.stages.some((s) => s.status === "GATE_PENDING") &&
      p.updatedAt < fiveDaysAgo &&
      p.currentStage < 8
  );
  const overdueProjects = projects.filter((p) =>
    p.materials.some((m) => m.dueDate && m.dueDate < now && ["pending", "submitted"].includes(m.status))
  );

  type FeedItem = { key: string; label: string; projectId: string; projectName: string; at: Date };
  const feedItems: FeedItem[] = [
    ...recentApprovals.map((a) => ({
      key: `approval-${a.id}`,
      label: `${a.approvedBy.name ?? a.approvedBy.email} approved stage ${a.stageNumber}`,
      projectId: a.projectId,
      projectName: a.project.name,
      at: a.approvedAt,
    })),
    ...recentUploads.map((u) => ({
      key: `upload-${u.id}`,
      label: `File uploaded — ${u.filename}`,
      projectId: u.projectId,
      projectName: u.project.name,
      at: u.uploadedAt,
    })),
    ...recentStageCompletions
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

  type UpcomingItem = { id: string; title: string; startAt: Date; type: string; sourceType: string; projectName?: string };
  const upcoming: UpcomingItem[] = [
    ...upcomingEvents.map((e) => ({ id: e.id, title: e.title, startAt: e.startAt, type: e.type, sourceType: "manual", projectName: e.project?.name })),
    ...upcomingTasks.map((t) => ({ id: `task-${t.id}`, title: t.name, startAt: t.dueDate!, type: "TASK_DUE", sourceType: "task", projectName: t.cycle.project.name })),
    ...upcomingMaterials.map((m) => ({ id: `mat-${m.id}`, title: `${m.label} due`, startAt: m.dueDate!, type: "DEADLINE", sourceType: "material", projectName: m.project.name })),
  ];
  upcoming.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  // ── Notifications (client actions, last 7 days) ──
  type NotificationItem = { key: string; projectName: string; label: string; dot: Accent; at: Date; href: string };
  const DOC_LABELS: Record<string, string> = {
    intake_form: "Intake form submitted",
    scope_of_work: "Scope of Work completed",
    feedback_revision: "Revision request submitted",
    review_signoff: "Review & sign-off submitted",
  };
  const notifications: NotificationItem[] = [];
  clientSubmittedDocs.forEach((doc) => {
    if (!doc.completedAt) return;
    notifications.push({
      key: `notif-doc-${doc.id}`, projectName: doc.project.name,
      label: DOC_LABELS[doc.templateType] ?? `Document submitted — ${doc.title}`,
      dot: "blue", at: doc.completedAt,
      href: `/projects/${doc.project.id}/stage/${doc.stageNumber}/documents/${doc.id}`,
    });
  });
  wireframeFeedbackDocs.forEach((doc) => {
    if (!doc.completedAt) return;
    notifications.push({ key: `notif-wf-${doc.id}`, projectName: doc.project.name, label: "Wireframe feedback received", dot: "purple", at: doc.completedAt, href: `/projects/${doc.project.id}/stage/3` });
  });
  clientSubmittedMaterials.forEach((mat) => {
    notifications.push({ key: `notif-mat-${mat.id}`, projectName: mat.project.name, label: `Client submitted — ${mat.label}`, dot: "amber", at: mat.updatedAt, href: `/projects/${mat.project.id}/materials` });
  });
  recentUploads
    .filter((u) => u.uploadedBy === u.project.clientId && u.uploadedAt >= sevenDaysAgo)
    .forEach((u) => {
      notifications.push({ key: `notif-upload-${u.id}`, projectName: u.project.name, label: `Uploaded — ${u.filename}`, dot: "blue", at: u.uploadedAt, href: `/projects/${u.project.id}?tab=files` });
    });
  recentTaskApprovals.forEach((a) => {
    notifications.push({ key: `notif-task-${a.id}`, projectName: a.project.name, label: `Approved deliverable — ${a.task?.name ?? "task"}`, dot: "mint", at: a.approvedAt, href: `/projects/${a.project.id}` });
  });
  notifications.sort((a, b) => b.at.getTime() - a.at.getTime());

  // ── Retainer aggregates ──
  const ongoingProjects = projects.filter((p) => p.mode === "ONGOING");
  type RetainerStat = { id: string; name: string; clientName: string; cycleName: string | null; openCount: number; overdueCount: number; awaitingClientCount: number };
  const retainerStats: RetainerStat[] = ongoingProjects.map((p) => {
    const tasks = p.cycles.flatMap((c) => c.tasks);
    const open = tasks.filter((t) => t.status !== "DONE");
    const overdue = open.filter((t) => t.dueDate && t.dueDate < now);
    const awaiting = tasks.filter(
      (t) => t.type === "DELIVERABLE" && t.requiresClientApproval && t.status === "WAITING_FINAL_APPROVAL" && t._count.approvals === 0
    );
    return {
      id: p.id, name: p.name, clientName: p.client.name ?? p.client.email,
      cycleName: p.cycles[0]?.name ?? null,
      openCount: open.length, overdueCount: overdue.length, awaitingClientCount: awaiting.length,
    };
  });
  const retainerOverdue = retainerStats.filter((r) => r.overdueCount > 0);
  const retainerAwaiting = retainerStats.filter((r) => r.awaitingClientCount > 0);

  const GATED_STAGES = [3, 4, 6];
  const advancableProjects = projects.filter((p) => {
    if (!GATED_STAGES.includes(p.currentStage)) return false;
    const row = p.stages.find((s) => s.stageNumber === p.currentStage);
    return row?.gateApproved && row?.status !== "COMPLETE";
  });
  const draftDocProjects = projects.filter((p) => p.documents.some((d) => d.status === "DRAFT"));

  const clientName = (p: { client: { name: string | null; email: string } }) => p.client.name ?? p.client.email;
  const needsYou: { key: string; dot: Accent; label: string; href: string }[] = [
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
      const c = p.documents.filter((d) => d.status === "DRAFT").length;
      return { key: `draft-${p.id}`, dot: "mint" as const, label: `${clientName(p)} — ${c} document${c !== 1 ? "s" : ""} to send`, href: `/projects/${p.id}` };
    }),
    ...staleProjects.map((p) => ({ key: `stale-${p.id}`, dot: "mint" as const, label: `${clientName(p)} — no activity for ${Math.floor((Date.now() - p.updatedAt.getTime()) / 86400000)}d`, href: `/projects/${p.id}` })),
  ];

  // ── Stat tiles ──
  const stats: { n: number; label: string; color: Accent; icon: string }[] = [
    { n: projects.length, label: "Active engagements", color: "mint", icon: "folder" },
    { n: needsYou.length, label: "Need you", color: "amber", icon: "alert" },
    { n: notifications.length, label: "From clients", color: "blue", icon: "bell" },
    { n: upcoming.length, label: "Upcoming (14d)", color: "mint", icon: "calendar" },
  ];

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 1440, margin: "0 auto" }} className="space-y-6">
      {/* Header */}
      <div className="fade-up flex items-end justify-between gap-5">
        <div>
          <Eyebrow style={{ marginBottom: 10 }}>0VERVIEW</Eyebrow>
          <h1 className="page-title" style={{ fontSize: 34 }}>Dashboard</h1>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 14.5 }}>
            {projects.length} active engagement{projects.length !== 1 ? "s" : ""}
            {needsYou.length > 0 && <> · <span style={{ color: "var(--amber)" }}>{needsYou.length} need you</span></>}
            {gateProjects.length > 0 && <> · <span style={{ color: "var(--rose)" }}>{gateProjects.length} awaiting sign-off</span></>}
          </p>
        </div>
        <NewProjectButton />
      </div>

      {/* Stat tiles */}
      <div className="fade-up grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {stats.map((s) => (
          <div key={s.label} className="card flex items-center gap-4" style={{ padding: "18px 20px" }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: FILL[s.color], color: VAR[s.color] }} className="flex items-center justify-center">
              <Icon name={s.icon} size={20} />
            </div>
            <div>
              <div className="figure" style={{ fontSize: 30, color: VAR[s.color], lineHeight: 1 }}>{String(s.n).padStart(2, "0")}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* My Work — tasks for the logged-in member, filterable, with workload strip */}
      <div className="fade-up">
        <Eyebrow style={{ marginBottom: 14 }}>MY W0RK</Eyebrow>
        <MyWork tasks={workTasks} members={workMembers} currentUserId={currentUserId} />
      </div>

      {/* Main split */}
      <div className="grid gap-5 items-start" style={{ gridTemplateColumns: "minmax(0,1fr) 340px" }}>
        {/* Left — projects */}
        <div className="fade-up">
          <Eyebrow style={{ marginBottom: 14 }}>ACTIVE PR0JECTS</Eyebrow>
          {projects.length === 0 ? (
            <div className="card muted" style={{ padding: 40, textAlign: "center", fontSize: 13.5 }}>
              No active projects. Create one to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
              {projects.map((project) => {
                if (project.mode === "ONGOING") {
                  const r = retainerStats.find((s) => s.id === project.id);
                  const accent: Accent = r && r.overdueCount > 0 ? "rose" : r && r.awaitingClientCount > 0 ? "amber" : "mint";
                  const daysSince = Math.floor((now.getTime() - project.updatedAt.getTime()) / 86400000);
                  return (
                    <Link key={project.id} href={`/projects/${project.id}`} className="card block" style={{ padding: 18 }}>
                      <div className="flex items-center gap-2">
                        <Pill color="blue">RETAINER</Pill>
                        <div className="flex-1" />
                        <span className="faint" style={{ fontSize: 11 }}>{daysSince === 0 ? "today" : `${daysSince}d ago`}</span>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <div className="eyebrow mint" style={{ marginBottom: 5, fontSize: 10.5 }}>{clientName(project)}</div>
                        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>{project.name}</div>
                        <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>{r?.cycleName ?? "No active cycle"} · {r?.openCount ?? 0} open</div>
                      </div>
                      {(() => {
                        const h = healthById.get(project.id) ?? 1;
                        return (
                          <div style={{ marginTop: 12 }}>
                            <div className="flex justify-between" style={{ fontSize: 11.5, marginBottom: 6 }}>
                              <span className="tech" style={{ letterSpacing: "0.04em", color: "var(--text-2)" }}>HEALTH</span>
                              <span className="faint">{Math.round(h * 100)}%</span>
                            </div>
                            <Health value={h} color={healthAccent(h)} w={"100%"} />
                          </div>
                        );
                      })()}
                      <div className="flex items-center gap-1.5 flex-wrap" style={{ marginTop: 12, minHeight: 20 }}>
                        {r && r.overdueCount > 0 && <Pill color="rose">{r.overdueCount} OVERDUE</Pill>}
                        {r && r.awaitingClientCount > 0 && <Pill color="amber">{r.awaitingClientCount} AWAITING</Pill>}
                        {r && r.overdueCount === 0 && r.awaitingClientCount === 0 && <Pill color="mint">ON TRACK</Pill>}
                        <div className="flex-1" />
                        <span style={{ color: VAR[accent], display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                          Open <Icon name="chevR" size={14} />
                        </span>
                      </div>
                    </Link>
                  );
                }

                const pending = getPendingStatus(project);
                const blocking = getBlockingLine(project);
                const hasGate = project.stages.some((s) => s.status === "GATE_PENDING");
                const statusColor: Accent = hasGate ? "rose" : pending.actor === "client" ? "amber" : "mint";
                const daysSince = Math.floor((Date.now() - project.updatedAt.getTime()) / 86400000);
                return (
                  <Link key={project.id} href={`/projects/${project.id}`} className="card block" style={{ padding: 18 }}>
                    <div className="flex items-center gap-2">
                      <Pill>{TYPE_LABELS[project.type]}</Pill>
                      <Pill color={statusColor}><span className="dot" />{hasGate ? "Gate" : pending.actor === "client" ? "Client" : "Team"}</Pill>
                      <div className="flex-1" />
                      <span className="faint" style={{ fontSize: 11 }}>{daysSince === 0 ? "today" : `${daysSince}d ago`}</span>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div className="eyebrow mint" style={{ marginBottom: 5, fontSize: 10.5 }}>{clientName(project)}</div>
                      <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>{project.name}</div>
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <StageBar stages={STAGE_LIST} current={project.currentStage - 1} compact />
                      <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                        <span className="tech" style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--text-3)", textTransform: "uppercase" }}>
                          STAGE {project.currentStage}/8 · {STAGE_LABELS[project.currentStage]}
                        </span>
                        {(() => {
                          const h = healthById.get(project.id) ?? 1;
                          return (
                            <span className="flex items-center gap-1.5">
                              <Health value={h} color={healthAccent(h)} w={44} />
                              <span className="faint tech" style={{ fontSize: 10 }}>{Math.round(h * 100)}%</span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="hr" style={{ margin: "14px 0" }} />
                    <div className="flex items-center gap-1.5">
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: VAR[blocking.dot], flexShrink: 0 }} />
                      <span className={blocking.blocking ? "" : "faint"} style={{ fontSize: 12 }}>{blocking.text}</span>
                      <div className="flex-1" />
                      <span style={{ color: "var(--text-3)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                        Open <Icon name="chevR" size={14} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="fade-up flex flex-col gap-4 sticky" style={{ top: 76 }}>
          {/* Needs you */}
          <div className="card card-pad">
            <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
              <Icon name="alert" size={15} style={{ color: "var(--rose)" }} />
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Needs you</span>
              {needsYou.length > 0 && <Pill color="rose" style={{ marginLeft: "auto" }}>{needsYou.length}</Pill>}
            </div>
            {needsYou.length === 0 ? (
              <p className="faint" style={{ fontSize: 12.5 }}>All clear — nothing needs you right now.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {needsYou.slice(0, 7).map((n) => (
                  <Link key={n.key} href={n.href} className="flex items-start gap-2.5" style={{ padding: "8px", borderRadius: "var(--r-md)" }}>
                    <span style={{ marginTop: 5, width: 7, height: 7, borderRadius: "50%", background: VAR[n.dot], flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, lineHeight: 1.4 }}>{n.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Blockers */}
          <div className="card card-pad">
            <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
              <Icon name="alert" size={15} style={{ color: "var(--amber)" }} />
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Blockers</span>
              {blockerTasks.length > 0 && <Pill color="amber" style={{ marginLeft: "auto" }}>{blockerTasks.length}</Pill>}
            </div>
            {blockerTasks.length === 0 ? (
              <p className="faint" style={{ fontSize: 12.5 }}>No active blockers.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {blockerTasks.slice(0, 7).map((b) => (
                  <Link key={b.id} href={`/projects/${b.cycle.project.id}`} className="flex items-start gap-2.5">
                    <span style={{ marginTop: 5, width: 7, height: 7, borderRadius: "50%", background: VAR.amber, flexShrink: 0 }} />
                    <div className="min-w-0">
                      <p style={{ fontSize: 12.5, lineHeight: 1.35 }}>{b.name}</p>
                      <p className="faint" style={{ fontSize: 11 }}>
                        {b.cycle.project.client.name ?? b.cycle.project.client.email}
                        {b.blockerResolver ? ` · waiting on ${b.blockerResolver.replace(/_/g, " ").toLowerCase()}` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Waiting on client */}
          {(() => {
            const items: { key: string; label: string; sub: string; href: string; dot: Accent }[] = [
              ...waitingQuestions.map((q) => ({
                key: `q-${q.id}`,
                label: q.kind === "CONFIRM" ? "Confirmation requested" : "Question awaiting answer",
                sub: `${q.project?.name ?? "—"} · ${q.questionText.slice(0, 40)}${q.questionText.length > 40 ? "…" : ""}`,
                href: q.project ? `/projects/${q.project.id}` : "/dashboard",
                dot: "amber" as Accent,
              })),
              ...gateProjects.map((p) => ({
                key: `gate-${p.id}`,
                label: "Client sign-off needed",
                sub: clientName(p),
                href: `/projects/${p.id}`,
                dot: "rose" as Accent,
              })),
              ...overdueProjects.map((p) => ({
                key: `mat-${p.id}`,
                label: "Materials outstanding",
                sub: clientName(p),
                href: `/projects/${p.id}/materials`,
                dot: "blue" as Accent,
              })),
            ];
            return (
              <div className="card card-pad">
                <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                  <Icon name="clock" size={15} style={{ color: "var(--blue)" }} />
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>Waiting on client</span>
                  {items.length > 0 && <Pill color="blue" style={{ marginLeft: "auto" }}>{items.length}</Pill>}
                </div>
                {items.length === 0 ? (
                  <p className="faint" style={{ fontSize: 12.5 }}>Nothing outstanding from clients.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {items.slice(0, 8).map((it) => (
                      <Link key={it.key} href={it.href} className="flex items-start gap-2.5">
                        <span style={{ marginTop: 5, width: 7, height: 7, borderRadius: "50%", background: VAR[it.dot], flexShrink: 0 }} />
                        <div className="min-w-0">
                          <p style={{ fontSize: 12.5, lineHeight: 1.35 }}>{it.label}</p>
                          <p className="faint truncate" style={{ fontSize: 11 }}>{it.sub}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Meetings */}
          <div className="card card-pad">
            <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
              <Icon name="calendar" size={15} style={{ color: "var(--purple)" }} />
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Meetings</span>
              <Link href="/calendar" className="faint" style={{ marginLeft: "auto", fontSize: 11.5 }}>Calendar →</Link>
            </div>
            {meetings.length === 0 ? (
              <p className="faint" style={{ fontSize: 12.5 }}>No upcoming meetings.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {meetings.map((m) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <span style={{ width: 2, alignSelf: "stretch", borderRadius: 2, background: VAR.purple, opacity: 0.7 }} />
                    <div className="min-w-0 flex-1">
                      <p style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.35 }} className="truncate">{m.title}</p>
                      {m.project && <p className="faint" style={{ fontSize: 11 }}>{m.project.name}</p>}
                    </div>
                    <span className="faint" style={{ fontSize: 11, flexShrink: 0 }}>
                      {m.startAt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                      {" · "}
                      {m.startAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Team capacity */}
          {team.length > 0 && (
            <div className="card card-pad">
              <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                <Icon name="users" size={15} style={{ color: "var(--text-2)" }} />
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>Team capacity</span>
                <Link href="/team" className="faint" style={{ marginLeft: "auto", fontSize: 11.5 }}>Team →</Link>
              </div>
              <div className="flex flex-col gap-3">
                {team.map((m) => {
                  const cc = capacityColor(m.capacity);
                  return (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <Avatar name={m.name} color={m.color} size={26} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
                          <span className="truncate">{m.name}</span>
                          <span className="tech" style={{ color: VAR[cc], fontSize: 11 }}>{Math.round(m.capacity * 100)}%</span>
                        </div>
                        <Health value={m.capacity} color={cc} w={"100%"} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* From clients */}
          <div className="card card-pad">
            <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
              <Icon name="bell" size={15} style={{ color: "var(--blue)" }} />
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>From clients</span>
              {notifications.length > 0 && <Pill color="blue" style={{ marginLeft: "auto" }}>{notifications.length}</Pill>}
            </div>
            {notifications.length === 0 ? (
              <p className="faint" style={{ fontSize: 12.5 }}>No new client activity.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {notifications.slice(0, 6).map((n) => (
                  <Link key={n.key} href={n.href} className="flex items-start gap-2.5">
                    <span style={{ marginTop: 5, width: 7, height: 7, borderRadius: "50%", background: VAR[n.dot], flexShrink: 0 }} />
                    <div className="min-w-0">
                      <p style={{ fontSize: 12.5, lineHeight: 1.35 }}>{n.label}</p>
                      <p className="faint" style={{ fontSize: 11 }}>{n.projectName} · {timeAgo(n.at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming */}
          <div className="card card-pad">
            <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
              <Icon name="calendar" size={15} style={{ color: "var(--mint)" }} />
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>This week</span>
              <Link href="/calendar" className="faint" style={{ marginLeft: "auto", fontSize: 11.5 }}>Calendar →</Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="faint" style={{ fontSize: 12.5 }}>No events in the next 14 days.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {upcoming.slice(0, 6).map((ev) => (
                  <div key={ev.id} className="flex items-center gap-3">
                    <span style={{ width: 2, alignSelf: "stretch", borderRadius: 2, background: VAR[EVENT_DOT[ev.sourceType === "manual" ? ev.type : ev.sourceType] ?? "mint"], opacity: 0.7 }} />
                    <div className="min-w-0 flex-1">
                      <p style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.35 }} className="truncate">{ev.title}</p>
                      {ev.projectName && <p className="faint" style={{ fontSize: 11 }}>{ev.projectName}</p>}
                    </div>
                    <span className="faint" style={{ fontSize: 11, flexShrink: 0 }}>{formatUpcomingDate(ev.startAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="fade-up">
        <Eyebrow style={{ marginBottom: 14 }}>RECENT ACTIVITY</Eyebrow>
        {feed.length === 0 ? (
          <div className="card muted" style={{ padding: 20, fontSize: 13 }}>No recent activity recorded yet.</div>
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            {feed.map((item, i) => (
              <Link key={item.key} href={`/projects/${item.projectId}`} className="flex items-center gap-4" style={{ padding: "12px 18px", borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-4)", flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <span style={{ fontSize: 13 }}>{item.label}</span>
                  <span className="faint" style={{ fontSize: 13, marginLeft: 8 }}>· {item.projectName}</span>
                </div>
                <span className="faint" style={{ fontSize: 11.5, flexShrink: 0 }}>{timeAgo(item.at)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
