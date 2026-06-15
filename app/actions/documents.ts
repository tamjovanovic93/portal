"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { TEMPLATES } from "@/lib/templates/registry";

async function getTeamUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (user.user_metadata?.role?.toLowerCase() === "client") throw new Error("Unauthorized");
  return user;
}

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function createDocument(
  projectId: string,
  stageNumber: number,
  templateType: string
): Promise<string> {
  await getTeamUser();

  const template = TEMPLATES[templateType];
  if (!template) throw new Error("Unknown template");

  const doc = await prisma.document.create({
    data: {
      projectId,
      stageNumber,
      templateType,
      title: template.title,
      content: {} as Prisma.InputJsonValue,
      status: "DRAFT",
    },
  });

  return doc.id;
}

export async function saveDocument(
  documentId: string,
  content: Record<string, unknown>
) {
  const user = await getAuthUser();

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: true },
  });
  if (!doc) throw new Error("Document not found");

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) throw new Error("Profile not found");

  const isTeam = profile.role === "TEAM";
  const isOwner = doc.project.clientId === profile.id;
  if (!isTeam && !isOwner) throw new Error("Unauthorized");

  await prisma.document.update({
    where: { id: documentId },
    data: { content: content as Prisma.InputJsonValue, updatedAt: new Date() },
  });

  revalidatePath(`/projects/${doc.projectId}/stage/${doc.stageNumber}`);
  revalidatePath(`/portal/documents/${documentId}`);
}

export async function submitDocument(documentId: string) {
  const user = await getAuthUser();

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: true },
  });
  if (!doc) throw new Error("Document not found");

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) throw new Error("Profile not found");

  const isTeam = profile.role === "TEAM";
  const isOwner = doc.project.clientId === profile.id;
  if (!isTeam && !isOwner) throw new Error("Unauthorized");

  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: isTeam ? "SENT" : "APPROVED",
      ...(isTeam ? { sentAt: new Date() } : { completedAt: new Date() }),
    },
  });

  revalidatePath(`/projects/${doc.projectId}/stage/${doc.stageNumber}`);
  revalidatePath(`/portal`);
}

export async function sendDocumentToClient(documentId: string) {
  await getTeamUser();

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found");

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "SENT", sentAt: new Date() },
  });

  revalidatePath(`/projects/${doc.projectId}/stage/${doc.stageNumber}`);
}

export async function deleteDocument(documentId: string) {
  await getTeamUser();

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found");

  await prisma.document.delete({ where: { id: documentId } });

  revalidatePath(`/projects/${doc.projectId}/stage/${doc.stageNumber}`);
}
