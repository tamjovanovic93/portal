"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireDocumentAccess } from "@/lib/auth/access";
import { WIREFRAME_STAGE } from "@/lib/stages";

export async function saveWireframeFeedback(
  documentId: string,
  content: Record<string, unknown>
) {
  await requireDocumentAccess(documentId);
  await prisma.document.update({
    where: { id: documentId },
    data: { content: content as Prisma.InputJsonValue },
  });
  revalidatePath("/portal");
}

export async function submitWireframeFeedback(
  documentId: string,
  content: Record<string, unknown>
) {
  const { doc } = await requireDocumentAccess(documentId);

  await prisma.document.update({
    where: { id: documentId },
    data: {
      content: content as Prisma.InputJsonValue,
      status: "APPROVED",
      completedAt: new Date(),
    },
  });

  revalidatePath("/portal");
  revalidatePath(`/projects/${doc.projectId}`);
  revalidatePath(`/projects/${doc.projectId}/stage/${WIREFRAME_STAGE}`);
  revalidatePath("/dashboard");
  redirect("/portal");
}

// The project is taken from the document itself — the caller-supplied
// projectId is only accepted when it matches.
export async function approveWireframesAndSubmit(
  documentId: string,
  content: Record<string, unknown>,
  projectId: string
) {
  const { user, doc } = await requireDocumentAccess(documentId);
  if (!doc.projectId || doc.projectId !== projectId) throw new Error("Document does not belong to this project");

  const now = new Date();

  await prisma.$transaction([
    // Save and mark feedback as submitted
    prisma.document.update({
      where: { id: documentId },
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
