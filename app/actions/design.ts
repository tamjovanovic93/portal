"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireTeam } from "@/lib/auth/session";
import { requireProjectAccess } from "@/lib/auth/access";
import { getOrCreateFeedbackDoc, resetFeedbackIfSubmitted } from "@/lib/documents/feedback";
import { mutateDocumentContent } from "@/lib/documents/mutate";
import { removeStorageObjects } from "@/lib/storage";
import { DESIGN_STAGE } from "@/lib/stages";

export async function saveDesignLink(projectId: string, label: string, url: string) {
  const user = await requireTeam();
  await prisma.projectAsset.create({
    data: {
      projectId,
      stageNumber: DESIGN_STAGE,
      storagePath: url.trim(),
      filename: label.trim() || url.trim(),
      mimeType: "text/uri-list",
      folder: "mockup",
      visibility: "SHARED",
      uploadedBy: user.id,
    },
  });
  // A new design after a submitted review reopens the review round.
  await resetFeedbackIfSubmitted(projectId, "design_feedback");
  revalidatePath(`/projects/${projectId}/stage/${DESIGN_STAGE}`);
  revalidatePath("/portal", "layout");
}

export async function deleteDesignAsset(assetId: string, projectId: string) {
  await requireTeam();
  const asset = await prisma.projectAsset.findUnique({ where: { id: assetId } });
  if (!asset) return;

  await prisma.projectAsset.delete({ where: { id: assetId } });
  // Real uploads only (links are not storage objects).
  if (asset.mimeType !== "text/uri-list") await removeStorageObjects([asset.storagePath]);
  revalidatePath(`/projects/${projectId}/stage/${DESIGN_STAGE}`);
}

export async function saveDesignFeedback(projectId: string, content: Record<string, unknown>) {
  await requireProjectAccess(projectId);
  const doc = await getOrCreateFeedbackDoc(projectId, "design_feedback");
  await prisma.document.update({
    where: { id: doc.id },
    data: { content: content as Prisma.InputJsonValue },
  });
  revalidatePath("/portal", "layout");
}

export async function submitDesignFeedback(projectId: string, content: Record<string, unknown>) {
  await requireProjectAccess(projectId);
  const doc = await getOrCreateFeedbackDoc(projectId, "design_feedback");

  await prisma.document.update({
    where: { id: doc.id },
    data: {
      content: content as Prisma.InputJsonValue,
      status: "APPROVED",
      completedAt: new Date(),
    },
  });

  revalidatePath("/portal", "layout");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/stage/${DESIGN_STAGE}`);
  revalidatePath("/dashboard");
  redirect("/portal");
}

export async function updateRevisionStatus(
  documentId: string,
  revisionIndex: string,
  status: string
) {
  await requireTeam();

  const doc = await mutateDocumentContent<Record<string, unknown>>(documentId, (content) => {
    const revisionStatuses = { ...((content.revisionStatuses ?? {}) as Record<string, string>) };
    if (status === "") delete revisionStatuses[revisionIndex];
    else revisionStatuses[revisionIndex] = status;
    return { ...content, revisionStatuses };
  });

  revalidatePath(`/projects/${doc.projectId}/stage/${DESIGN_STAGE}`);
}

export async function approveDesignAndSubmit(
  projectId: string,
  content: Record<string, unknown>
) {
  const { user } = await requireProjectAccess(projectId);
  const doc = await getOrCreateFeedbackDoc(projectId, "design_feedback");

  const now = new Date();
  const verdict = content.verdict as string;
  const approvalNote =
    verdict === "approved"
      ? "Client approved designs — no changes needed. Authorised to proceed to build."
      : "Client approved designs with minor revisions — authorised to proceed after changes.";

  await prisma.$transaction([
    prisma.document.update({
      where: { id: doc.id },
      data: {
        content: content as Prisma.InputJsonValue,
        status: "APPROVED",
        completedAt: now,
      },
    }),
    prisma.approval.create({
      data: {
        projectId,
        stageNumber: DESIGN_STAGE,
        approvedById: user.id,
        method: "PORTAL",
        notes: approvalNote,
      },
    }),
    prisma.projectStage.update({
      where: { projectId_stageNumber: { projectId, stageNumber: DESIGN_STAGE } },
      data: {
        gateApproved: true,
        gateApprovedAt: now,
        gateApproverId: user.id,
      },
    }),
  ]);

  revalidatePath("/portal", "layout");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/stage/${DESIGN_STAGE}`);
  revalidatePath("/dashboard");
  redirect("/portal");
}
