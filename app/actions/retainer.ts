"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { TaskStatus, TaskOwnerRole } from "@prisma/client";

const OWNER_ROLES: TaskOwnerRole[] = ["PROJECT_MANAGER", "DEV_TEAM", "DESIGN_TEAM", "CLIENT"];

async function requireTeam() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (user.user_metadata?.role?.toLowerCase() === "client") throw new Error("Unauthorized");
}

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
  const name = formData.get("name");
  const focus = formData.get("focus");
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");
  if (typeof name !== "string" || !name.trim()) throw new Error("Name required");
  if (typeof startDate !== "string" || !startDate) throw new Error("Start date required");

  await prisma.cycle.create({
    data: {
      projectId,
      name: name.trim(),
      focus: typeof focus === "string" && focus.trim() ? focus.trim() : null,
      startDate: new Date(startDate),
      endDate: endDate && typeof endDate === "string" && endDate ? new Date(endDate) : null,
      status: "ACTIVE",
    },
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
  if (stageNumber < 1 || stageNumber > 8) return;

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
) {
  await requireTeam();
  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) throw new Error("Name required");

  const type = formData.get("type");
  const description = formData.get("description");
  const dueDate = formData.get("dueDate");
  const ownerRoleRaw = formData.get("ownerRole");
  const statusRaw = formData.get("status");
  const resolverRaw = formData.get("blockerResolver");
  const requiresClientApproval = formData.get("requiresClientApproval") === "on";
  const isBlocker = formData.get("isBlocker") === "on";

  const taskType =
    typeof type === "string" && ["DELIVERABLE", "INTERNAL", "FIX_UPDATE"].includes(type)
      ? (type as "DELIVERABLE" | "INTERNAL" | "FIX_UPDATE")
      : "DELIVERABLE";

  const ownerRole =
    typeof ownerRoleRaw === "string" && OWNER_ROLES.includes(ownerRoleRaw as TaskOwnerRole)
      ? (ownerRoleRaw as TaskOwnerRole)
      : null;

  // Resolver defaults to the task owner when not explicitly chosen.
  const blockerResolver = isBlocker
    ? typeof resolverRaw === "string" && OWNER_ROLES.includes(resolverRaw as TaskOwnerRole)
      ? (resolverRaw as TaskOwnerRole)
      : ownerRole
    : null;

  const ALL_STATUSES: TaskStatus[] = ["PLANNING", "NEEDS_APPROVAL", "IN_PROGRESS", "WAITING_FINAL_APPROVAL", "DONE"];
  // Internal tasks have no approval steps.
  const allowedStatuses =
    taskType === "INTERNAL"
      ? ALL_STATUSES.filter((s) => s !== "NEEDS_APPROVAL" && s !== "WAITING_FINAL_APPROVAL")
      : ALL_STATUSES;
  const status =
    typeof statusRaw === "string" && allowedStatuses.includes(statusRaw as TaskStatus)
      ? (statusRaw as TaskStatus)
      : "PLANNING";

  await prisma.task.create({
    data: {
      cycleId,
      name: name.trim(),
      type: taskType,
      status,
      completedAt: status === "DONE" ? new Date() : null,
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      dueDate: dueDate && typeof dueDate === "string" && dueDate ? new Date(dueDate) : null,
      ownerRole,
      isBlocker,
      blockerResolver,
      // Only deliverables can require client approval.
      requiresClientApproval: taskType === "DELIVERABLE" ? requiresClientApproval : false,
    },
  });
  revalidateProject(projectId);
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
  await prisma.task.delete({ where: { id: taskId } });
  revalidateProject(projectId);
}
