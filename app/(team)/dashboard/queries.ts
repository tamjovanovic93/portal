import { prisma } from "@/lib/prisma";
import type { ProjectMode, ProjectType, StageStatus } from "@prisma/client";
import { WAITING_CLIENT_STATUSES } from "@/lib/questions";
import { listNotifications } from "@/lib/notifications";
import { getTeamData } from "@/lib/team";
import { TEMPLATE_TYPES } from "@/lib/documents/types";
import type { WorkTask } from "@/components/team/MyWork";

// Dashboard data loading. Per-project material/document/task facts are
// aggregated in the database (groupBy) instead of loading every row — the
// numbers the page derives from them are unchanged.

const DAY = 86400000;

export type ProjectStats = {
  materials: { pending: number; submitted: number; received: number; total: number; overdue: number };
  draftDocs: number;
  tasks: { open: number; overdue: number; blockers: number; awaiting: number };
  activeCycleName: string | null;
};

export type DashboardProject = {
  id: string;
  name: string;
  type: ProjectType;
  mode: ProjectMode;
  currentStage: number;
  updatedAt: Date;
  client: { name: string | null; email: string };
  stages: { stageNumber: number; status: StageStatus; gateApproved: boolean }[];
  stats: ProjectStats;
};

export type WorkloadCounts = { active: number; overdue: number; dueSoon: number; blocked: number };

const emptyStats = (): ProjectStats => ({
  materials: { pending: 0, submitted: 0, received: 0, total: 0, overdue: 0 },
  draftDocs: 0,
  tasks: { open: 0, overdue: 0, blockers: 0, awaiting: 0 },
  activeCycleName: null,
});

async function loadProjects(now: Date): Promise<DashboardProject[]> {
  // One wave. Filtering the aggregates by the project relation rather than by a
  // list of ids means none of them has to wait for the project query, so the
  // whole loader costs a single database round trip instead of two. At the
  // latency of a cross-region connection that is the difference between ~250ms
  // and ~500ms before any work is done.
  const activeProject = { project: { isArchived: false } };
  const inActiveProjects = activeProject;
  const openInActiveCycle = { cycle: { status: "ACTIVE" as const, ...activeProject }, status: { not: "DONE" as const } };

  const [rows, materials, overdueMaterials, draftDocs, cycles, openTasks, overdueTasks, blockerTasks, awaitingTasks] =
    await Promise.all([
      prisma.project.findMany({
        where: { isArchived: false },
        select: {
          id: true, name: true, type: true, mode: true, currentStage: true, updatedAt: true,
          client: { select: { name: true, email: true } },
          stages: { select: { stageNumber: true, status: true, gateApproved: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.materialItem.groupBy({ by: ["projectId", "status"], where: inActiveProjects, _count: { _all: true } }),
      prisma.materialItem.groupBy({
        by: ["projectId"],
        where: { ...inActiveProjects, dueDate: { lt: now }, status: { in: ["pending", "submitted"] } },
        _count: { _all: true },
      }),
      prisma.document.groupBy({ by: ["projectId"], where: { ...inActiveProjects, status: "DRAFT" }, _count: { _all: true } }),
      prisma.cycle.findMany({
        where: { ...inActiveProjects, status: "ACTIVE" },
        select: { id: true, projectId: true, name: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.task.groupBy({ by: ["cycleId"], where: openInActiveCycle, _count: { _all: true } }),
      prisma.task.groupBy({ by: ["cycleId"], where: { ...openInActiveCycle, dueDate: { lt: now } }, _count: { _all: true } }),
      prisma.task.groupBy({ by: ["cycleId"], where: { ...openInActiveCycle, isBlocker: true, unblockedAt: null }, _count: { _all: true } }),
      prisma.task.groupBy({
        by: ["cycleId"],
        where: {
          cycle: { status: "ACTIVE", ...activeProject },
          type: "DELIVERABLE",
          requiresClientApproval: true,
          status: "WAITING_FINAL_APPROVAL",
          approvals: { none: {} },
        },
        _count: { _all: true },
      }),
    ]);

  const ids = rows.map((p) => p.id);
  if (ids.length === 0) return [];

  const stats = new Map<string, ProjectStats>(ids.map((id) => [id, emptyStats()]));
  const cycleProject = new Map(cycles.map((c) => [c.id, c.projectId]));
  for (const c of cycles) {
    const s = stats.get(c.projectId)!;
    if (s.activeCycleName === null) s.activeCycleName = c.name;
  }
  for (const m of materials) {
    const s = stats.get(m.projectId)!;
    const n = m._count._all;
    s.materials.total += n;
    if (m.status === "pending") s.materials.pending += n;
    else if (m.status === "submitted") s.materials.submitted += n;
    else s.materials.received += n; // received | verified
  }
  for (const m of overdueMaterials) stats.get(m.projectId)!.materials.overdue = m._count._all;
  for (const d of draftDocs) if (d.projectId) stats.get(d.projectId)!.draftDocs = d._count._all;
  const addTask = (rows: { cycleId: string; _count: { _all: number } }[], key: keyof ProjectStats["tasks"]) => {
    for (const r of rows) {
      const pid = cycleProject.get(r.cycleId);
      if (pid) stats.get(pid)!.tasks[key] += r._count._all;
    }
  };
  addTask(openTasks, "open");
  addTask(overdueTasks, "overdue");
  addTask(blockerTasks, "blockers");
  addTask(awaitingTasks, "awaiting");

  return rows.map((p) => ({ ...p, stats: stats.get(p.id)! }));
}

// Per-member workload counts (same classification as MyWork's classify()).
async function loadWorkload(now: Date): Promise<Record<string, WorkloadCounts>> {
  const base = { assigneeId: { not: null }, cycle: { project: { isArchived: false } } };
  const notDone = { ...base, status: { not: "DONE" as const } };
  const [active, overdue, dueSoon, blocked] = await Promise.all([
    prisma.task.groupBy({ by: ["assigneeId"], where: notDone, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["assigneeId"], where: { ...notDone, dueDate: { lt: now } }, _count: { _all: true } }),
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: { ...notDone, dueDate: { gte: now, lte: new Date(now.getTime() + 3 * DAY) } },
      _count: { _all: true },
    }),
    prisma.task.groupBy({ by: ["assigneeId"], where: { ...notDone, isBlocker: true }, _count: { _all: true } }),
  ]);
  const out: Record<string, WorkloadCounts> = {};
  const put = (rows: { assigneeId: string | null; _count: { _all: number } }[], key: keyof WorkloadCounts) => {
    for (const r of rows) {
      if (!r.assigneeId) continue;
      out[r.assigneeId] ??= { active: 0, overdue: 0, dueSoon: 0, blocked: 0 };
      out[r.assigneeId][key] = r._count._all;
    }
  };
  put(active, "active");
  put(overdue, "overdue");
  put(dueSoon, "dueSoon");
  put(blocked, "blocked");
  return out;
}

export async function loadWorkTasks(assigneeId: string | "all"): Promise<WorkTask[]> {
  const rows = await prisma.task.findMany({
    where: {
      cycle: { project: { isArchived: false } },
      ...(assigneeId === "all" ? {} : { assigneeId }),
    },
    select: {
      id: true, name: true, status: true, dueDate: true, isBlocker: true, assigneeId: true,
      assignee: { select: { name: true, email: true } },
      cycle: { select: { project: { select: { id: true, name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return rows.map((t) => ({
    id: t.id, name: t.name, status: t.status,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    isBlocker: t.isBlocker, assigneeId: t.assigneeId,
    assigneeName: t.assignee ? (t.assignee.name ?? t.assignee.email) : null,
    projectId: t.cycle.project.id, projectName: t.cycle.project.name,
  }));
}

export async function loadDashboard(currentUserId: string) {
  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * DAY);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY);
  const fourteenDaysOut = new Date(now.getTime() + 14 * DAY);

  const [
    projects,
    team,
    workload,
    myTasks,
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
    blockerCount,
    blockerTasks,
    waitingQuestions,
    waitingDocs,
    memberQuestionsRaw,
    teamNotificationsRaw,
  ] = await Promise.all([
    loadProjects(now),
    getTeamData(),
    loadWorkload(now),
    currentUserId ? loadWorkTasks(currentUserId) : Promise.resolve([] as WorkTask[]),
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
        templateType: { not: TEMPLATE_TYPES.wireframeFeedback },
        handledAt: null, // reviewed items move to project history, off the action feed
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
    prisma.document.findMany({
      where: {
        templateType: TEMPLATE_TYPES.wireframeFeedback,
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
    prisma.task.count({
      where: { isBlocker: true, unblockedAt: null, status: { not: "DONE" }, cycle: { project: { isArchived: false } } },
    }),
    prisma.task.findMany({
      where: { isBlocker: true, unblockedAt: null, status: { not: "DONE" }, cycle: { project: { isArchived: false } } },
      select: {
        id: true, name: true, blockerResolver: true, dueDate: true,
        cycle: { select: { project: { select: { id: true, name: true, client: { select: { name: true, email: true } } } } } },
      },
      orderBy: { dueDate: "asc" },
      take: 7,
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
    // Client-facing forms/offers sent but not yet returned — we're waiting on the
    // client to fill/approve them (covers intake, initial form, offer). Both
    // project-scoped and client-scoped (onboarding) docs.
    prisma.document.findMany({
      where: {
        status: "SENT",
        templateType: { in: [TEMPLATE_TYPES.intakeForm, TEMPLATE_TYPES.initialClientForm, TEMPLATE_TYPES.financialOffer] },
      },
      select: {
        id: true, title: true, templateType: true, sentAt: true, projectId: true, clientId: true,
        project: { select: { id: true, name: true } },
        client: { select: { id: true, name: true, email: true } },
      },
      orderBy: { sentAt: "asc" },
      take: 30,
    }),
    // Questions addressed to a specific team member and awaiting their answer
    // (e.g. a question asked under a task) — surfaced under that member.
    prisma.question.findMany({
      where: { recipientRole: "TEAM", recipientId: { not: null }, status: "WAITING_TEAM" },
      select: {
        id: true, questionText: true, contextType: true, contextId: true, recipientId: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    // Team notification inbox (client → team actions) for the top-of-dashboard feed.
    listNotifications(currentUserId, "TEAM", 20),
  ]);

  // Resolve task names for member-directed task questions (Question.contextId is
  // polymorphic, so there's no relation to follow).
  const taskQuestionIds = memberQuestionsRaw
    .filter((q) => q.contextType === "TASK" && q.contextId)
    .map((q) => q.contextId!);
  const questionTasks = taskQuestionIds.length
    ? await prisma.task.findMany({ where: { id: { in: taskQuestionIds } }, select: { id: true, name: true } })
    : [];

  return {
    now, fiveDaysAgo, sevenDaysAgo,
    projects, team, workload, myTasks,
    recentApprovals, recentUploads, recentStageCompletions,
    upcomingEvents, upcomingTasks, upcomingMaterials,
    clientSubmittedDocs, wireframeFeedbackDocs, clientSubmittedMaterials, recentTaskApprovals,
    blockerCount, blockerTasks, waitingQuestions, waitingDocs, memberQuestionsRaw, teamNotificationsRaw,
    questionTasks,
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
