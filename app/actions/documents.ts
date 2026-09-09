"use server";

import { revalidatePath } from "next/cache";
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

// A document is owned by a client either directly (clientId, client-scoped) or
// through its project (legacy project-scoped). Revalidate whichever surface it
// lives on.
type OwnedDoc = {
  id: string;
  projectId: string | null;
  clientId: string | null;
  stageNumber: number;
  project?: { clientId: string } | null;
};

function ownerClientId(doc: OwnedDoc): string | null {
  return doc.clientId ?? doc.project?.clientId ?? null;
}

function revalidateDoc(doc: OwnedDoc) {
  if (doc.projectId) {
    revalidatePath(`/projects/${doc.projectId}/stage/${doc.stageNumber}`);
  } else if (doc.clientId) {
    revalidatePath(`/clients/${doc.clientId}`);
    revalidatePath(`/clients/${doc.clientId}/documents/${doc.id}`);
  }
  revalidatePath(`/portal/documents/${doc.id}`);
  revalidatePath(`/portal`);
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
    include: { project: { select: { clientId: true } } },
  });
  if (!doc) throw new Error("Document not found");

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) throw new Error("Profile not found");

  const isTeam = profile.role === "TEAM";
  const isOwner = ownerClientId(doc) === profile.id;
  if (!isTeam && !isOwner) throw new Error("Unauthorized");

  await prisma.document.update({
    where: { id: documentId },
    data: { content: content as Prisma.InputJsonValue, updatedAt: new Date() },
  });

  revalidateDoc(doc);
}

export async function submitDocument(documentId: string) {
  const user = await getAuthUser();

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { select: { clientId: true } } },
  });
  if (!doc) throw new Error("Document not found");

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) throw new Error("Profile not found");

  const isTeam = profile.role === "TEAM";
  const isOwner = ownerClientId(doc) === profile.id;
  if (!isTeam && !isOwner) throw new Error("Unauthorized");

  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: isTeam ? "SENT" : "APPROVED",
      ...(isTeam ? { sentAt: new Date() } : { completedAt: new Date() }),
    },
  });

  revalidateDoc(doc);
}

export async function sendDocumentToClient(documentId: string) {
  await getTeamUser();

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found");

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "SENT", sentAt: new Date() },
  });

  revalidateDoc(doc);
}

export async function deleteDocument(documentId: string) {
  await getTeamUser();

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found");

  await prisma.document.delete({ where: { id: documentId } });

  revalidateDoc(doc);
}

// Team marks a client-submitted document as reviewed/handled — moves it out of
// "Action Required" into completed/history.
export async function markDocumentHandled(documentId: string) {
  await getTeamUser();
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found");
  await prisma.document.update({
    where: { id: documentId },
    data: { handledAt: new Date() },
  });
  revalidateDoc(doc);
  revalidatePath("/dashboard");
}

export async function unmarkDocumentHandled(documentId: string) {
  await getTeamUser();
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found");
  await prisma.document.update({
    where: { id: documentId },
    data: { handledAt: null },
  });
  revalidateDoc(doc);
  revalidatePath("/dashboard");
}
