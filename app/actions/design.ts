"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

async function getTeamUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role?.toLowerCase() === "client") throw new Error("Unauthorized");
  return user;
}

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function saveDesignLink(projectId: string, label: string, url: string) {
  const user = await getTeamUser();
  await prisma.projectAsset.create({
    data: {
      projectId,
      stageNumber: 4,
      storagePath: url.trim(),
      filename: label.trim() || url.trim(),
      mimeType: "text/uri-list",
      folder: "mockup",
      visibility: "SHARED",
      uploadedBy: user.id,
    },
  });
  revalidatePath(`/projects/${projectId}/stage/4`);
}

export async function deleteDesignAsset(assetId: string, projectId: string) {
  await getTeamUser();
  const asset = await prisma.projectAsset.findUnique({ where: { id: assetId } });
  if (!asset) return;

  // Delete the file from Supabase storage if it's a real upload (not a link)
  if (asset.mimeType !== "text/uri-list") {
    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await admin.storage.from("project-assets").remove([asset.storagePath]);
  }

  await prisma.projectAsset.delete({ where: { id: assetId } });
  revalidatePath(`/projects/${projectId}/stage/4`);
}

export async function saveDesignFeedback(documentId: string, content: Record<string, unknown>) {
  await getAuthUser();
  await prisma.document.update({
    where: { id: documentId },
    data: { content: content as Prisma.InputJsonValue },
  });
  revalidatePath("/portal");
}

export async function submitDesignFeedback(documentId: string, content: Record<string, unknown>) {
  await getAuthUser();
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { projectId: true },
  });
  if (!doc) throw new Error("Document not found");

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
  revalidatePath(`/projects/${doc.projectId}/stage/4`);
  revalidatePath("/dashboard");
  redirect("/portal");
}

export async function updateRevisionStatus(
  documentId: string,
  revisionIndex: string,
  status: string
) {
  await getTeamUser();

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

  revalidatePath(`/projects/${doc.projectId}/stage/4`);
}

export async function approveDesignAndSubmit(
  documentId: string,
  content: Record<string, unknown>,
  projectId: string
) {
  const user = await getAuthUser();
  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) throw new Error("Profile not found");

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
        stageNumber: 4,
        approvedById: profile.id,
        method: "PORTAL",
        notes: approvalNote,
      },
    }),
    prisma.projectStage.update({
      where: { projectId_stageNumber: { projectId, stageNumber: 4 } },
      data: {
        gateApproved: true,
        gateApprovedAt: now,
        gateApproverId: profile.id,
      },
    }),
  ]);

  revalidatePath("/portal");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/stage/4`);
  revalidatePath("/dashboard");
  redirect("/portal");
}
