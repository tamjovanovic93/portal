"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function advanceStage(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role === "client") {
    return { error: "Unauthorized" };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { stages: true },
  });

  if (!project) return { error: "Project not found" };
  if (project.currentStage >= 8) return { error: "Already at final stage" };

  const currentStageRow = project.stages.find(
    (s) => s.stageNumber === project.currentStage
  );

  // Stages 3, 4, 6 require gate approval before advancing
  const GATED_STAGES = [3, 4, 6];
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Client can only approve via PORTAL
  const isClient = user.user_metadata?.role === "client";
  if (isClient && method !== "PORTAL") return { error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) return { error: "Profile not found" };

  await prisma.$transaction([
    prisma.approval.create({
      data: {
        projectId,
        stageNumber,
        approvedById: profile.id,
        method,
        notes,
      },
    }),
    prisma.projectStage.update({
      where: {
        projectId_stageNumber: { projectId, stageNumber },
      },
      data: { gateApproved: true, gateApprovedAt: new Date(), gateApproverId: profile.id },
    }),
  ]);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/portal");
  return { success: true };
}
