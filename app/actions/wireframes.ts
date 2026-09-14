"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireProjectAccess } from "@/lib/auth/access";
import { getOrCreateFeedbackDoc } from "@/lib/documents/feedback";
import { WIREFRAME_STAGE } from "@/lib/stages";

export async function saveWireframeFeedback(
  projectId: string,
  content: Record<string, unknown>
) {
  await requireProjectAccess(projectId);
  const doc = await getOrCreateFeedbackDoc(projectId, "wireframe_feedback");
  await prisma.document.update({
    where: { id: doc.id },
    data: { content: content as Prisma.InputJsonValue },
  });
  revalidatePath("/portal");
}

export async function submitWireframeFeedback(
  projectId: string,
  content: Record<string, unknown>
) {
  await requireProjectAccess(projectId);
  const doc = await getOrCreateFeedbackDoc(projectId, "wireframe_feedback");

  await prisma.document.update({
    where: { id: doc.id },
    data: {
      content: content as Prisma.InputJsonValue,
      status: "APPROVED",
      completedAt: new Date(),
    },
  });

  revalidatePath("/portal");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/stage/${WIREFRAME_STAGE}`);
  revalidatePath("/dashboard");
  redirect("/portal");
}

export async function approveWireframesAndSubmit(
  projectId: string,
  content: Record<string, unknown>
) {
  const { user } = await requireProjectAccess(projectId);
  const doc = await getOrCreateFeedbackDoc(projectId, "wireframe_feedback");

  const now = new Date();

  await prisma.$transaction([
    // Save and mark feedback as submitted
    prisma.document.update({
      where: { id: doc.id },
      data: {
        content: content as Prisma.InputJsonValue,
        status: "APPROVED",
        completedAt: now,
      },
    }),
    // Record formal gate approval for the Sketch stage
    prisma.approval.create({
      data: {
        projectId,
        stageNumber: WIREFRAME_STAGE,
        approvedById: user.id,
        method: "PORTAL",
        notes: "Client approved wireframes via portal — authorised to proceed to the design stage.",
      },
    }),
    // Unlock the Sketch-stage gate
    prisma.projectStage.update({
      where: { projectId_stageNumber: { projectId, stageNumber: WIREFRAME_STAGE } },
      data: {
        gateApproved: true,
        gateApprovedAt: now,
        gateApproverId: user.id,
      },
    }),
  ]);

  revalidatePath("/portal");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/stage/${WIREFRAME_STAGE}`);
  revalidatePath("/dashboard");
  redirect("/portal");
}
