"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { notifyTeam, notifyClient } from "@/lib/notifications";
import {
  teamEdit,
  teamAskQuestion,
  clientApproveEdit,
  clientAnswerQuestion,
  type FormContent,
} from "@/lib/forms/collab";

// Server actions for the staged onboarding flow: Initial Client Form → review
// (change / ask-a-question) → Offer → Intake. Onboarding now happens at the
// CLIENT level (documents scoped by clientId, projectId null) — a Project is not
// required. Legacy project-scoped docs still resolve via their project's client.

// ─── Auth ────────────────────────────────────────────────────────────────────

async function requireTeam() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (user.user_metadata?.role?.toLowerCase() === "client") throw new Error("Unauthorized");
  return user;
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

// Load a document and resolve its owning client — from the document's own
// clientId (client-scoped) or, for legacy docs, via its project.
async function loadDoc(documentId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      project: { select: { id: true, clientId: true, name: true } },
      client: { select: { id: true, name: true, email: true } },
    },
  });
  const clientId = doc?.clientId ?? doc?.project?.clientId ?? null;
  if (!doc || !clientId) throw new Error("Document not found");
  const clientLabel =
    doc.client?.name ?? doc.client?.email ?? doc.project?.name ?? "Client";
  return { ...doc, clientId, projectId: doc.projectId ?? null, clientLabel };
}

// Where the team edits a document. Client-scoped docs live under the client;
// legacy project-scoped docs keep their project route.
function teamDocLink(doc: { id: string; projectId: string | null; clientId: string | null }) {
  return doc.projectId
    ? `/projects/${doc.projectId}/stage/1/documents/${doc.id}`
    : `/clients/${doc.clientId}/documents/${doc.id}`;
}

// Revalidate the relevant team surface(s) for a document.
function revalidateDoc(doc: { id: string; projectId: string | null; clientId: string | null }) {
  if (doc.projectId) {
    revalidatePath(`/projects/${doc.projectId}`);
    revalidatePath(`/projects/${doc.projectId}/stage/1/documents/${doc.id}`);
  } else {
    revalidatePath(`/clients/${doc.clientId}`);
    revalidatePath(`/clients/${doc.clientId}/documents/${doc.id}`);
  }
}

async function persistContent(documentId: string, content: FormContent) {
  await prisma.document.update({
    where: { id: documentId },
    data: { content: content as Prisma.InputJsonValue },
  });
}

// ─── Client-level onboarding document creation ───────────────────────────────

export async function createClientIntakeForm(
  clientId: string
): Promise<{ id?: string; error?: string }> {
  await requireTeam();
  const existing = await prisma.document.findFirst({
    where: { clientId, templateType: "intake_form" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { id: existing.id };
  const doc = await prisma.document.create({
    data: {
      clientId,
      stageNumber: 1,
      templateType: "intake_form",
      title: "Client Intake Form",
      content: {} as Prisma.InputJsonValue,
      status: "DRAFT",
    },
  });
  revalidatePath(`/clients/${clientId}`);
  return { id: doc.id };
}

export async function createClientOffer(
  clientId: string
): Promise<{ id?: string; error?: string }> {
  await requireTeam();
  const existing = await prisma.document.findFirst({
    where: { clientId, templateType: "financial_offer" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { id: existing.id };
  const doc = await prisma.document.create({
    data: {
      clientId,
      stageNumber: 1,
      templateType: "financial_offer",
      title: "Project / Financial Offer",
      content: {} as Prisma.InputJsonValue,
      status: "DRAFT",
    },
  });
  revalidatePath(`/clients/${clientId}`);
  return { id: doc.id };
}

// ─── Send a form to the client (Initial Form / configured Intake) ────────────

export async function sendFormToClient(documentId: string) {
  await requireTeam();
  const doc = await loadDoc(documentId);
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "SENT", sentAt: new Date() },
  });
  await notifyClient(doc.clientId, {
    projectId: doc.projectId ?? undefined,
    type: "form_sent",
    message: `A new form is ready for you: ${doc.title}.`,
    link: `/portal/documents/${documentId}`,
  });
  revalidateDoc(doc);
  revalidatePath(`/portal`);
}

// Called when the client finishes filling a sent form (status → APPROVED).
export async function completeForm(documentId: string) {
  const user = await requireUser();
  const doc = await loadDoc(documentId);
  if (doc.clientId !== user.id) throw new Error("Unauthorized");
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "APPROVED", completedAt: new Date() },
  });
  await notifyTeam({
    projectId: doc.projectId ?? undefined,
    type: "form_completed",
    message: `${doc.clientLabel}: completed "${doc.title}".`,
    link: teamDocLink(doc),
  });
  revalidateDoc(doc);
  revalidatePath(`/portal`);
}

// ─── Team review: change an answer / ask a question ──────────────────────────

export async function changeAnswer(documentId: string, fieldKey: string, value: unknown) {
  await requireTeam();
  const doc = await loadDoc(documentId);
  const next = teamEdit((doc.content ?? {}) as FormContent, fieldKey, value);
  await persistContent(documentId, next);
  await notifyClient(doc.clientId, {
    projectId: doc.projectId ?? undefined,
    type: "answer_changed",
    message: `${doc.clientLabel}: your team updated an answer and needs your approval.`,
    link: `/portal/documents/${documentId}`,
  });
  revalidateDoc(doc);
  revalidatePath(`/portal/documents/${documentId}`);
  return { ok: true };
}

export async function askQuestion(documentId: string, fieldKey: string, text: string) {
  await requireTeam();
  const doc = await loadDoc(documentId);
  const next = teamAskQuestion((doc.content ?? {}) as FormContent, fieldKey, text);
  await persistContent(documentId, next);
  await notifyClient(doc.clientId, {
    projectId: doc.projectId ?? undefined,
    type: "question_asked",
    message: `${doc.clientLabel}: your team asked a question about one of your answers.`,
    link: `/portal/documents/${documentId}`,
  });
  revalidateDoc(doc);
  revalidatePath(`/portal/documents/${documentId}`);
  return { ok: true };
}

// ─── Client responses to team edits / questions ──────────────────────────────

export async function approveEdit(documentId: string, fieldKey: string) {
  const user = await requireUser();
  const doc = await loadDoc(documentId);
  if (doc.clientId !== user.id) throw new Error("Unauthorized");
  const next = clientApproveEdit((doc.content ?? {}) as FormContent, fieldKey);
  await persistContent(documentId, next);
  await notifyTeam({
    projectId: doc.projectId ?? undefined,
    type: "edit_approved",
    message: `${doc.clientLabel}: approved your change.`,
    link: teamDocLink(doc),
  });
  revalidatePath(`/portal/documents/${documentId}`);
  revalidateDoc(doc);
  return { ok: true };
}

export async function answerQuestion(documentId: string, fieldKey: string, answer: string) {
  const user = await requireUser();
  const doc = await loadDoc(documentId);
  if (doc.clientId !== user.id) throw new Error("Unauthorized");
  const next = clientAnswerQuestion((doc.content ?? {}) as FormContent, fieldKey, answer);
  await persistContent(documentId, next);
  await notifyTeam({
    projectId: doc.projectId ?? undefined,
    type: "question_answered",
    message: `${doc.clientLabel}: answered your question.`,
    link: teamDocLink(doc),
  });
  revalidatePath(`/portal/documents/${documentId}`);
  revalidateDoc(doc);
  return { ok: true };
}

// ─── Project / Financial Offer send + approve ────────────────────────────────

export async function sendOffer(documentId: string) {
  await requireTeam();
  const doc = await loadDoc(documentId);
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "SENT", sentAt: new Date() },
  });
  await notifyClient(doc.clientId, {
    projectId: doc.projectId ?? undefined,
    type: "offer_sent",
    message: `${doc.clientLabel}: your project offer is ready and needs your approval.`,
    link: `/portal/documents/${documentId}`,
  });
  revalidateDoc(doc);
  revalidatePath(`/portal`);
}

export async function approveOffer(documentId: string) {
  const user = await requireUser();
  const doc = await loadDoc(documentId);
  if (doc.clientId !== user.id) throw new Error("Unauthorized");
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "APPROVED", completedAt: new Date() },
  });
  await notifyTeam({
    projectId: doc.projectId ?? undefined,
    type: "offer_approved",
    message: `${doc.clientLabel}: approved the offer.`,
    link: teamDocLink(doc),
  });
  revalidatePath(`/portal`);
  revalidateDoc(doc);
  return { ok: true };
}

// ─── Legacy project-scoped helpers (still used by the project brief pipeline) ──

export async function createIntakeForm(
  projectId: string
): Promise<{ id?: string; error?: string }> {
  await requireTeam();
  const existing = await prisma.document.findFirst({
    where: { projectId, templateType: "intake_form" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { id: existing.id };
  const doc = await prisma.document.create({
    data: {
      projectId,
      stageNumber: 1,
      templateType: "intake_form",
      title: "Client Intake Form",
      content: {} as Prisma.InputJsonValue,
      status: "DRAFT",
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return { id: doc.id };
}

export async function createOffer(projectId: string): Promise<{ id?: string; error?: string }> {
  await requireTeam();
  const existing = await prisma.document.findFirst({
    where: { projectId, templateType: "financial_offer" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { id: existing.id };
  const doc = await prisma.document.create({
    data: {
      projectId,
      stageNumber: 1,
      templateType: "financial_offer",
      title: "Project / Financial Offer",
      content: {} as Prisma.InputJsonValue,
      status: "DRAFT",
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return { id: doc.id };
}

export async function publishBrief(
  projectId: string
): Promise<{ ok?: boolean; error?: string }> {
  await requireTeam();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { clientId: true, name: true },
  });
  if (!project) return { error: "Project not found." };
  await prisma.project.update({
    where: { id: projectId },
    data: { briefPublishedAt: new Date() },
  });
  await notifyClient(project.clientId, {
    projectId,
    type: "brief_published",
    message: `${project.name}: your brief and strategy are ready to view.`,
    link: `/portal/brief/${projectId}`,
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/portal`);
  return { ok: true };
}

export async function unpublishBrief(
  projectId: string
): Promise<{ ok?: boolean; error?: string }> {
  await requireTeam();
  await prisma.project.update({
    where: { id: projectId },
    data: { briefPublishedAt: null },
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/portal`);
  return { ok: true };
}
