"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { WIREFRAME_STAGE, DESIGN_STAGE } from "@/lib/stages";

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function saveWireframeFeedback(
  documentId: string,
  content: Record<string, unknown>
) {
  await getAuthUser();
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
  revalidatePath(`/projects/${doc.projectId}/stage/${WIREFRAME_STAGE}`);
  revalidatePath("/dashboard");
  redirect("/portal");
}

export async function approveWireframesAndSubmit(
  documentId: string,
  content: Record<string, unknown>,
  projectId: string
) {
  const user = await getAuthUser();

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) throw new Error("Profile not found");

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
        approvedById: profile.id,
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
        gateApproverId: profile.id,
      },
    }),
  ]);

  revalidatePath("/portal");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/stage/${WIREFRAME_STAGE}`);
  revalidatePath("/dashboard");
  redirect("/portal");
}
