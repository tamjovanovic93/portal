"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireTeam } from "@/lib/auth/session";
import { requireDocumentAccess } from "@/lib/auth/access";
import { TEMPLATES } from "@/lib/templates/registry";

// A document is owned by a client either directly (clientId, client-scoped) or
// through its project (legacy project-scoped). Revalidate whichever surface it
// lives on.
type OwnedDoc = {
  id: string;
  projectId: string | null;
  clientId: string | null;
  stageNumber: number;
};

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
  await requireTeam();

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
  const { doc } = await requireDocumentAccess(documentId);

  await prisma.document.update({
    where: { id: documentId },
    data: { content: content as Prisma.InputJsonValue, updatedAt: new Date() },
  });

  revalidateDoc(doc);
}

export async function submitDocument(documentId: string) {
  const { user, doc } = await requireDocumentAccess(documentId);
  const isTeam = user.role === "TEAM";

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
  await requireTeam();

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found");

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "SENT", sentAt: new Date() },
  });

  revalidateDoc(doc);
}

export async function deleteDocument(documentId: string) {
  await requireTeam();

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found");

  // Questions and notifications point at the document by id only (no FK).
  await prisma.$transaction([
    prisma.question.deleteMany({ where: { contextType: "BRIEF", contextId: documentId } }),
    prisma.notification.deleteMany({ where: { link: { contains: documentId } } }),
    prisma.document.delete({ where: { id: documentId } }),
  ]);

  revalidateDoc(doc);
}

// Team marks a client-submitted document as reviewed/handled — moves it out of
// "Action Required" into completed/history.
export async function markDocumentHandled(documentId: string) {
  await requireTeam();
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
  await requireTeam();
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found");
  await prisma.document.update({
    where: { id: documentId },
    data: { handledAt: null },
  });
  revalidateDoc(doc);
  revalidatePath("/dashboard");
}
