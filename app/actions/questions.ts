"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { notifyClient, notify } from "@/lib/notifications";
import type { QuestionContext } from "@prisma/client";

// Server actions for the generalized Question model. Team asks a client (open
// question or confirmation of a proposed answer) or another team member; the
// recipient answers / confirms; the team resolves. See lib/questions.ts.

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

function revalidateFor(projectId: string | null) {
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/brief`);
    revalidatePath(`/portal`);
  }
  revalidatePath("/dashboard");
}

// ─── Team asks the client ─────────────────────────────────────────────────────
// kind ANSWER  → open question (status WAITING_CLIENT)
// kind CONFIRM → proposed answer to confirm (status WAITING_CONFIRMATION)
export async function askClient(input: {
  projectId: string;
  contextType: QuestionContext;
  contextId?: string;
  questionText: string;
  proposedAnswer?: string;
}): Promise<{ id?: string; error?: string }> {
  const user = await requireTeam();
  const text = input.questionText.trim();
  if (!text) return { error: "Question required." };
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { clientId: true, name: true },
  });
  if (!project) return { error: "Project not found." };

  const kind = input.proposedAnswer && input.proposedAnswer.trim() ? "CONFIRM" : "ANSWER";
  const q = await prisma.question.create({
    data: {
      projectId: input.projectId,
      contextType: input.contextType,
      contextId: input.contextId ?? null,
      kind,
      askedById: user.id,
      recipientId: project.clientId,
      recipientRole: "CLIENT",
      questionText: text,
      proposedAnswer: kind === "CONFIRM" ? input.proposedAnswer!.trim() : null,
      status: kind === "CONFIRM" ? "WAITING_CONFIRMATION" : "WAITING_CLIENT",
    },
  });
  await notifyClient(project.clientId, {
    projectId: input.projectId,
    type: kind === "CONFIRM" ? "question_confirm" : "question_asked",
    message: kind === "CONFIRM"
      ? `${project.name}: your team needs you to confirm something.`
      : `${project.name}: your team asked you a question.`,
    link: `/portal`,
  });
  revalidateFor(input.projectId);
  return { id: q.id };
}

// ─── Team asks another team member ────────────────────────────────────────────
export async function askTeam(input: {
  projectId: string;
  contextType: QuestionContext;
  contextId?: string;
  recipientId: string;
  questionText: string;
}): Promise<{ id?: string; error?: string }> {
  const user = await requireTeam();
  const text = input.questionText.trim();
  if (!text) return { error: "Question required." };
  const q = await prisma.question.create({
    data: {
      projectId: input.projectId,
      contextType: input.contextType,
      contextId: input.contextId ?? null,
      kind: "ANSWER",
      askedById: user.id,
      recipientId: input.recipientId,
      recipientRole: "TEAM",
      questionText: text,
      status: "WAITING_TEAM",
    },
  });
  await notify({
    projectId: input.projectId,
    type: "team_question",
    toProfileId: input.recipientId,
    message: `You have a new question from a teammate.`,
    link: `/projects/${input.projectId}`,
  });
  revalidateFor(input.projectId);
  return { id: q.id };
}

// ─── Recipient answers an open question ───────────────────────────────────────
export async function answerQuestion(questionId: string, answer: string): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  const text = answer.trim();
  if (!text) return { error: "Answer required." };
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) return { error: "Question not found." };
  // Only the recipient (or a team member) may answer.
  if (q.recipientId && q.recipientId !== user.id) {
    if (user.user_metadata?.role?.toLowerCase() === "client") return { error: "Unauthorized" };
  }
  await prisma.question.update({
    where: { id: questionId },
    data: { answerText: text, status: "ANSWERED", answeredAt: new Date() },
  });
  // Notify the team (asker) that it was answered.
  await notify({
    projectId: q.projectId ?? undefined,
    type: "question_answered",
    toRole: "TEAM",
    message: `A question was answered.`,
    link: q.projectId ? `/projects/${q.projectId}` : undefined,
  });
  revalidateFor(q.projectId);
  return { ok: true };
}

// ─── Client confirms / requests change on a CONFIRM question ──────────────────
export async function respondConfirm(
  questionId: string,
  decision: "confirm" | "change",
  note?: string
): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) return { error: "Question not found." };
  if (q.recipientId && q.recipientId !== user.id && user.user_metadata?.role?.toLowerCase() === "client") {
    return { error: "Unauthorized" };
  }
  const answerText =
    decision === "confirm"
      ? `Confirmed: ${q.proposedAnswer ?? ""}`.trim()
      : `Change requested${note && note.trim() ? `: ${note.trim()}` : ""}`;
  await prisma.question.update({
    where: { id: questionId },
    data: { answerText, status: "ANSWERED", answeredAt: new Date() },
  });
  await notify({
    projectId: q.projectId ?? undefined,
    type: decision === "confirm" ? "question_confirmed" : "question_change_requested",
    toRole: "TEAM",
    message: decision === "confirm" ? `Client confirmed a proposed answer.` : `Client requested a change.`,
    link: q.projectId ? `/projects/${q.projectId}` : undefined,
  });
  revalidateFor(q.projectId);
  return { ok: true };
}

// ─── Team resolves / reopens / deletes ────────────────────────────────────────
export async function resolveQuestion(questionId: string): Promise<{ ok?: boolean }> {
  await requireTeam();
  const q = await prisma.question.update({
    where: { id: questionId },
    data: { status: "RESOLVED", resolvedAt: new Date() },
    select: { projectId: true },
  });
  revalidateFor(q.projectId);
  return { ok: true };
}

export async function reopenQuestion(questionId: string): Promise<{ ok?: boolean }> {
  await requireTeam();
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) return { ok: false };
  // Reopen into the state implied by the recipient/kind.
  const status = q.recipientRole === "CLIENT"
    ? (q.kind === "CONFIRM" ? "WAITING_CONFIRMATION" : "WAITING_CLIENT")
    : "WAITING_TEAM";
  await prisma.question.update({
    where: { id: questionId },
    data: { status, resolvedAt: null },
  });
  revalidateFor(q.projectId);
  return { ok: true };
}

export async function deleteQuestion(questionId: string): Promise<{ ok?: boolean }> {
  await requireTeam();
  const q = await prisma.question.findUnique({ where: { id: questionId }, select: { projectId: true } });
  await prisma.question.delete({ where: { id: questionId } });
  revalidateFor(q?.projectId ?? null);
  return { ok: true };
}
