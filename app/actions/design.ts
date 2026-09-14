"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireTeam } from "@/lib/auth/session";
import { requireDocumentAccess } from "@/lib/auth/access";
import { createAdminClient, STORAGE_BUCKET } from "@/lib/supabase/admin";
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
  revalidatePath(`/projects/${projectId}/stage/${DESIGN_STAGE}`);
}

export async function deleteDesignAsset(assetId: string, projectId: string) {
  await requireTeam();
  const asset = await prisma.projectAsset.findUnique({ where: { id: assetId } });
  if (!asset) return;

  // Delete the file from Supabase storage if it's a real upload (not a link)
  if (asset.mimeType !== "text/uri-list") {
    const admin = createAdminClient();
    await admin.storage.from(STORAGE_BUCKET).remove([asset.storagePath]);
  }

  await prisma.projectAsset.delete({ where: { id: assetId } });
  revalidatePath(`/projects/${projectId}/stage/${DESIGN_STAGE}`);
}

export async function saveDesignFeedback(documentId: string, content: Record<string, unknown>) {
  await requireDocumentAccess(documentId);
  await prisma.document.update({
    where: { id: documentId },
    data: { content: content as Prisma.InputJsonValue },
  });
  revalidatePath("/portal");
}

export async function submitDesignFeedback(documentId: string, content: Record<string, unknown>) {
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
  revalidatePath(`/projects/${doc.projectId}/stage/${DESIGN_STAGE}`);
  revalidatePath("/dashboard");
  redirect("/portal");
}

export async function updateRevisionStatus(
  documentId: string,
  revisionIndex: string,
  status: string
) {
  await requireTeam();

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { content: true, projectId: true },
  });
  if (!doc) throw new Error("Document not found");

  const content = (doc.content ?? {}) as Record<string, unknown>;
  const revisionStatuses = { ...((content.revisionStatuses ?? {}) as Record<string, string>) };

  if (status === "") {
    delete revisionStatuses[revisionIndex];
  } else {
    revisionStatuses[revisionIndex] = status;
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      content: { ...content, revisionStatuses } as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/projects/${doc.projectId}/stage/${DESIGN_STAGE}`);
}

// The project is taken from the document itself — the caller-supplied
// projectId is only accepted when it matches.
export async function approveDesignAndSubmit(
  documentId: string,
  content: Record<string, unknown>,
  projectId: string
) {
  const { user, doc } = await requireDocumentAccess(documentId);
  if (!doc.projectId || doc.projectId !== projectId) throw new Error("Document does not belong to this project");

  const now = new Date();
  const verdict = content.verdict as string;
  const approvalNote =
    verdict === "approved"
      ? "Client approved designs — no changes needed. Authorised to proceed to build."
      : "Client approved designs with minor revisions — authorised to proceed after changes.";

  await prisma.$transaction([
    prisma.document.update({
      where: { id: documentId },
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

  revalidatePath("/portal");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/stage/${DESIGN_STAGE}`);
  revalidatePath("/dashboard");
  redirect("/portal");
}
