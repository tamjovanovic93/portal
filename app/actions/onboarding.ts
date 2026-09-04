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
// (change / ask-a-question) → Offer → (Phase 3 intake) → Brief. Built on the
// existing Document rows + the collab field-state in lib/forms/collab.ts.

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

async function loadDoc(documentId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { select: { id: true, clientId: true, name: true } } },
  });
  if (!doc) throw new Error("Document not found");
  return doc;
}

function teamLink(projectId: string, documentId: string) {
  return `/projects/${projectId}/stage/1/documents/${documentId}`;
}

async function persistContent(documentId: string, content: FormContent) {
  await prisma.document.update({
    where: { id: documentId },
    data: { content: content as Prisma.InputJsonValue },
  });
}

// ─── Send a form to the client (Initial Form / configured Intake) ────────────

export async function sendFormToClient(documentId: string) {
  await requireTeam();
  const doc = await loadDoc(documentId);
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "SENT", sentAt: new Date() },
  });
  await notifyClient(doc.project.clientId, {
    projectId: doc.projectId,
    type: "form_sent",
    message: `A new form is ready for you: ${doc.title}.`,
    link: `/portal/documents/${documentId}`,
  });
  revalidatePath(`/projects/${doc.projectId}`);
  revalidatePath(`/portal`);
}

// Called when the client finishes filling a sent form (status → APPROVED).
export async function completeForm(documentId: string) {
  const user = await requireUser();
  const doc = await loadDoc(documentId);
  if (doc.project.clientId !== user.id) throw new Error("Unauthorized");
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "APPROVED", completedAt: new Date() },
  });
  await notifyTeam({
    projectId: doc.projectId,
    type: "form_completed",
    message: `${doc.project.name}: client completed "${doc.title}".`,
    link: teamLink(doc.projectId, documentId),
  });
  revalidatePath(`/projects/${doc.projectId}`);
  revalidatePath(`/portal`);
}

// ─── Team review: change an answer / ask a question ──────────────────────────

export async function changeAnswer(documentId: string, fieldKey: string, value: unknown) {
  await requireTeam();
  const doc = await loadDoc(documentId);
  const next = teamEdit((doc.content ?? {}) as FormContent, fieldKey, value);
  await persistContent(documentId, next);
  await notifyClient(doc.project.clientId, {
    projectId: doc.projectId,
    type: "answer_changed",
    message: `${doc.project.name}: your team updated an answer and needs your approval.`,
    link: `/portal/documents/${documentId}`,
  });
  revalidatePath(`/projects/${doc.projectId}`);
  revalidatePath(`/portal/documents/${documentId}`);
  return { ok: true };
}

export async function askQuestion(documentId: string, fieldKey: string, text: string) {
  await requireTeam();
  const doc = await loadDoc(documentId);
  const next = teamAskQuestion((doc.content ?? {}) as FormContent, fieldKey, text);
  await persistContent(documentId, next);
  await notifyClient(doc.project.clientId, {
    projectId: doc.projectId,
    type: "question_asked",
    message: `${doc.project.name}: your team asked a question about one of your answers.`,
    link: `/portal/documents/${documentId}`,
  });
  revalidatePath(`/projects/${doc.projectId}`);
  revalidatePath(`/portal/documents/${documentId}`);
  return { ok: true };
}

// ─── Client responses to team edits / questions ──────────────────────────────

export async function approveEdit(documentId: string, fieldKey: string) {
  const user = await requireUser();
  const doc = await loadDoc(documentId);
  if (doc.project.clientId !== user.id) throw new Error("Unauthorized");
  const next = clientApproveEdit((doc.content ?? {}) as FormContent, fieldKey);
  await persistContent(documentId, next);
  await notifyTeam({
    projectId: doc.projectId,
    type: "edit_approved",
    message: `${doc.project.name}: client approved your change.`,
    link: teamLink(doc.projectId, documentId),
  });
  revalidatePath(`/portal/documents/${documentId}`);
  revalidatePath(`/projects/${doc.projectId}`);
  return { ok: true };
}

export async function answerQuestion(documentId: string, fieldKey: string, answer: string) {
  const user = await requireUser();
  const doc = await loadDoc(documentId);
  if (doc.project.clientId !== user.id) throw new Error("Unauthorized");
  const next = clientAnswerQuestion((doc.content ?? {}) as FormContent, fieldKey, answer);
  await persistContent(documentId, next);
  await notifyTeam({
    projectId: doc.projectId,
    type: "question_answered",
    message: `${doc.project.name}: client answered your question.`,
    link: teamLink(doc.projectId, documentId),
  });
  revalidatePath(`/portal/documents/${documentId}`);
  revalidatePath(`/projects/${doc.projectId}`);
  return { ok: true };
}

// ─── Publish Brief + Strategy to the client ──────────────────────────────────

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

// ─── Full Intake Form ────────────────────────────────────────────────────────

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
      content: {},
      status: "DRAFT",
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return { id: doc.id };
}

// ─── Project / Financial Offer ───────────────────────────────────────────────

export async function createOffer(projectId: string): Promise<{ id?: string; error?: string }> {
  await requireTeam();
  // Reuse an existing draft offer if present.
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
      content: {},
      status: "DRAFT",
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return { id: doc.id };
}

export async function sendOffer(documentId: string) {
  await requireTeam();
  const doc = await loadDoc(documentId);
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "SENT", sentAt: new Date() },
  });
  await notifyClient(doc.project.clientId, {
    projectId: doc.projectId,
    type: "offer_sent",
    message: `${doc.project.name}: your project offer is ready and needs your approval.`,
    link: `/portal/documents/${documentId}`,
  });
  revalidatePath(`/projects/${doc.projectId}`);
  revalidatePath(`/portal`);
}

export async function approveOffer(documentId: string) {
  const user = await requireUser();
  const doc = await loadDoc(documentId);
  if (doc.project.clientId !== user.id) throw new Error("Unauthorized");
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "APPROVED", completedAt: new Date() },
  });
  await notifyTeam({
    projectId: doc.projectId,
    type: "offer_approved",
    message: `${doc.project.name}: client approved the offer.`,
    link: `/projects/${doc.projectId}`,
  });
  revalidatePath(`/portal`);
  revalidatePath(`/projects/${doc.projectId}`);
  return { ok: true };
}
