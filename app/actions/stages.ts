"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth/session";
import { requireProjectAccess } from "@/lib/auth/access";
import { FINAL_STAGE, GATED_STAGES } from "@/lib/stages";

export async function advanceStage(projectId: string) {
  try {
    await requireTeam();
  } catch {
    return { error: "Unauthorized" };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { stages: true },
  });

  if (!project) return { error: "Project not found" };
  if (project.currentStage >= FINAL_STAGE) return { error: "Already at final stage" };

  const currentStageRow = project.stages.find(
    (s) => s.stageNumber === project.currentStage
  );

  // Gated stages require client approval before advancing (see lib/stages.ts).
  if (
    GATED_STAGES.includes(project.currentStage) &&
    !currentStageRow?.gateApproved
  ) {
    return { error: "Client approval required before advancing this stage." };
  }

  const nextStage = project.currentStage + 1;

  await prisma.$transaction([
    // Mark current stage complete
    prisma.projectStage.update({
      where: {
        projectId_stageNumber: {
          projectId,
          stageNumber: project.currentStage,
        },
      },
      data: { status: "COMPLETE", completedAt: new Date() },
    }),
    // Set next stage to in-progress
    prisma.projectStage.update({
      where: {
        projectId_stageNumber: { projectId, stageNumber: nextStage },
      },
      data: { status: "IN_PROGRESS" },
    }),
    // Advance project's current stage
    prisma.project.update({
      where: { id: projectId },
      data: { currentStage: nextStage },
    }),
  ]);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function recordApproval(
  projectId: string,
  stageNumber: number,
  method: "PORTAL" | "EMAIL" | "VERBAL" | "OTHER",
  notes?: string
) {
  let user;
  try {
    ({ user } = await requireProjectAccess(projectId));
  } catch {
    return { error: "Unauthorized" };
  }

  // Client can only approve via PORTAL
  if (user.role === "CLIENT" && method !== "PORTAL") return { error: "Unauthorized" };

  await prisma.$transaction([
    prisma.approval.create({
      data: {
        projectId,
        stageNumber,
        approvedById: user.id,
        method,
        notes,
      },
    }),
    prisma.projectStage.update({
      where: {
        projectId_stageNumber: { projectId, stageNumber },
      },
      data: { gateApproved: true, gateApprovedAt: new Date(), gateApproverId: user.id },
    }),
  ]);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/portal", "layout");
  return { success: true };
}
