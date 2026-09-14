"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth/session";
import type { TaskStatus, TaskOwnerRole } from "@prisma/client";
import { STAGE_COUNT } from "@/lib/stages";
import { parseForm } from "@/lib/validation/form";
import { addTaskSchema, createCycleSchema } from "@/lib/validation/schemas";

const OWNER_ROLES: TaskOwnerRole[] = ["PROJECT_MANAGER", "DEV_TEAM", "DESIGN_TEAM", "CLIENT"];

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

// Create a lightweight task group / to-do list on any project (standard or
// ongoing). Reuses the Cycle model as the task container — the retainer-only
// fields (dates/focus) are auto-set and hidden in the "tasks" board variant.
export async function createTaskGroup(projectId: string, formData: FormData) {
  await requireTeam();
  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) throw new Error("Name required");
  await prisma.cycle.create({
    data: {
      projectId,
      name: name.trim(),
      startDate: new Date(),
      status: "ACTIVE",
    },
  });
  revalidateProject(projectId);
}

// ─── Cycles ──────────────────────────────────────────────────────────────────

export async function createCycle(projectId: string, formData: FormData) {
  await requireTeam();
  const parsed = parseForm(createCycleSchema, formData);
  if (!parsed.ok) throw new Error(parsed.error);
  const { name, focus, startDate, endDate } = parsed.data;

  await prisma.cycle.create({
    data: { projectId, name, focus, startDate, endDate, status: "ACTIVE" },
  });
  revalidateProject(projectId);
}

export async function updateCycle(
  cycleId: string,
  data: { name: string; startDate: string; endDate: string | null }
) {
  await requireTeam();
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return;
  if (!data.name.trim()) return { error: "Name required" };
  if (!data.startDate) return { error: "Start date required" };

  await prisma.cycle.update({
    where: { id: cycleId },
    data: {
      name: data.name.trim(),
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
    },
  });
  revalidateProject(cycle.projectId);
  return { success: true };
}

export async function updateCycleFocus(cycleId: string, focus: string) {
  await requireTeam();
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return;
  await prisma.cycle.update({
    where: { id: cycleId },
    data: { focus: focus.trim() || null },
  });
  revalidateProject(cycle.projectId);
}

// Close a cycle. Open (non-DONE) tasks either carry forward to another active
// cycle or stay in the closed cycle as an incomplete record.
export async function closeCycle(cycleId: string, carryForwardToCycleId?: string) {
  await requireTeam();
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return;

  if (carryForwardToCycleId) {
    await prisma.task.updateMany({
      where: { cycleId, status: { not: "DONE" } },
      data: { cycleId: carryForwardToCycleId },
    });
  }

  await prisma.cycle.update({
    where: { id: cycleId },
    data: { status: "CLOSED" },
  });
  revalidateProject(cycle.projectId);
}

export async function reopenCycle(cycleId: string) {
  await requireTeam();
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return;
  await prisma.cycle.update({
    where: { id: cycleId },
    data: { status: "ACTIVE" },
  });
  revalidateProject(cycle.projectId);
}

export async function deleteCycle(cycleId: string) {
  await requireTeam();
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return;
  await prisma.cycle.delete({ where: { id: cycleId } });
  revalidateProject(cycle.projectId);
}

// ─── Stages (retainers progress freely, no client gates) ─────────────────────

export async function setRetainerStage(projectId: string, stageNumber: number) {
  await requireTeam();
  if (stageNumber < 1 || stageNumber > STAGE_COUNT) return;

  const stages = await prisma.projectStage.findMany({
    where: { projectId },
    select: { stageNumber: true },
  });

  await prisma.$transaction([
    prisma.project.update({ where: { id: projectId }, data: { currentStage: stageNumber } }),
    // Stages before the current one are complete, the current is in progress,
    // later ones reset to not started.
    ...stages.map((s) =>
      prisma.projectStage.update({
        where: { projectId_stageNumber: { projectId, stageNumber: s.stageNumber } },
        data: {
          status:
            s.stageNumber < stageNumber
              ? "COMPLETE"
              : s.stageNumber === stageNumber
              ? "IN_PROGRESS"
              : "NOT_STARTED",
          completedAt: s.stageNumber < stageNumber ? new Date() : null,
        },
      })
    ),
  ]);

  revalidateProject(projectId);
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function addTask(
  cycleId: string,
  projectId: string,
  formData: FormData
): Promise<{ id: string }> {
  await requireTeam();
  const parsed = parseForm(addTaskSchema, formData);
  if (!parsed.ok) throw new Error(parsed.error);
  const d = parsed.data;

  const ownerRole: TaskOwnerRole | null = d.ownerRole ?? null;
  // Resolver defaults to the task owner when not explicitly chosen.
  const blockerResolver = d.isBlocker ? (d.blockerResolver ?? ownerRole) : null;

  // Internal tasks have no approval steps.
  const status: TaskStatus =
    d.type === "INTERNAL" && (d.status === "NEEDS_APPROVAL" || d.status === "WAITING_FINAL_APPROVAL")
      ? "PLANNING"
      : d.status;

  const task = await prisma.task.create({
    data: {
      cycleId,
      name: d.name,
      type: d.type,
      status,
      completedAt: status === "DONE" ? new Date() : null,
      description: d.description,
      dueDate: d.dueDate,
      assigneeId: d.assigneeId,
      ownerRole,
      isBlocker: d.isBlocker,
      blockerResolver,
      // Only deliverables can require client approval.
      requiresClientApproval: d.type === "DELIVERABLE" ? d.requiresClientApproval : false,
    },
    select: { id: true },
  });
  revalidateProject(projectId);
  return { id: task.id };
}

export async function setOwnerRole(
  taskId: string,
  projectId: string,
  ownerRole: TaskOwnerRole | null
) {
  await requireTeam();
  await prisma.task.update({
    where: { id: taskId },
    data: { ownerRole: ownerRole && OWNER_ROLES.includes(ownerRole) ? ownerRole : null },
  });
  revalidateProject(projectId);
}

export async function toggleBlocker(taskId: string, projectId: string, isBlocker: boolean) {
  await requireTeam();

  if (isBlocker) {
    // Default the resolver to the task owner if none is set yet.
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { ownerRole: true, blockerResolver: true },
    });
    await prisma.task.update({
      where: { id: taskId },
      data: {
        isBlocker: true,
        blockerResolver: task?.blockerResolver ?? task?.ownerRole ?? null,
      },
    });
  } else {
    // Clearing a blocker also clears its resolver.
    await prisma.task.update({
      where: { id: taskId },
      data: { isBlocker: false, blockerResolver: null },
    });
  }
  revalidateProject(projectId);
}

// Mark a blocker cleared (with the date it was unblocked), or re-open it (null).
export async function markUnblocked(
  taskId: string,
  projectId: string,
  date: string | null
) {
  await requireTeam();
  await prisma.task.update({
    where: { id: taskId },
    data: { unblockedAt: date ? new Date(date) : null },
  });
  revalidateProject(projectId);
}

export async function setBlockerResolver(
  taskId: string,
  projectId: string,
  resolver: TaskOwnerRole | null
) {
  await requireTeam();
  await prisma.task.update({
    where: { id: taskId },
    data: { blockerResolver: resolver && OWNER_ROLES.includes(resolver) ? resolver : null },
  });
  revalidateProject(projectId);
}

export async function assignTask(
  taskId: string,
  projectId: string,
  assigneeId: string | null
) {
  await requireTeam();
  await prisma.task.update({
    where: { id: taskId },
    data: { assigneeId: assigneeId || null },
  });
  revalidateProject(projectId);
}

export async function updateTaskStatus(
  taskId: string,
  projectId: string,
  status: TaskStatus
) {
  await requireTeam();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { approvals: { where: { taskId: { not: null } } } },
  });
  if (!task) return;

  // A deliverable that needs client approval can't be force-closed by the team
  // while waiting on final approval — the client gate must clear first.
  if (
    status === "DONE" &&
    task.status === "WAITING_FINAL_APPROVAL" &&
    task.type === "DELIVERABLE" &&
    task.requiresClientApproval &&
    task.approvals.length === 0
  ) {
    return { error: "This deliverable needs client approval before it can be closed." };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      completedAt: status === "DONE" ? new Date() : null,
    },
  });
  revalidateProject(projectId);
  return { success: true };
}

export async function toggleRequiresApproval(
  taskId: string,
  projectId: string,
  requires: boolean
) {
  await requireTeam();
  await prisma.task.update({
    where: { id: taskId },
    data: { requiresClientApproval: requires },
  });
  revalidateProject(projectId);
}

export async function deleteTask(taskId: string, projectId: string) {
  await requireTeam();
  await prisma.$transaction([
    // Task questions reference the task by id only (no FK).
    prisma.question.deleteMany({ where: { contextType: "TASK", contextId: taskId } }),
    prisma.task.delete({ where: { id: taskId } }),
  ]);
  revalidateProject(projectId);
}

// ─── Staged (PROJECT-mode) task fields ───────────────────────────────────────

// Move a task to a different delivery stage (in case the agent placed it wrong).
export async function moveTaskToStage(taskId: string, projectId: string, stageNumber: number | null) {
  await requireTeam();
  const valid = stageNumber === null || (stageNumber >= 1 && stageNumber <= STAGE_COUNT);
  await prisma.task.update({
    where: { id: taskId },
    data: { stageNumber: valid ? stageNumber : null },
  });
  revalidateProject(projectId);
}

export async function updateTaskNotes(taskId: string, projectId: string, notes: string) {
  await requireTeam();
  await prisma.task.update({
    where: { id: taskId },
    data: { notes: notes.trim() || null },
  });
  revalidateProject(projectId);
}

export async function updateTaskEstimate(taskId: string, projectId: string, date: string | null) {
  await requireTeam();
  await prisma.task.update({
    where: { id: taskId },
    data: { estimateDate: date ? new Date(date) : null },
  });
  revalidateProject(projectId);
}

export async function updateTaskWorkLink(taskId: string, projectId: string, link: string) {
  await requireTeam();
  await prisma.task.update({
    where: { id: taskId },
    data: { workLink: link.trim() || null },
  });
  revalidateProject(projectId);
}
