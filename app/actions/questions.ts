"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeam, requireUser } from "@/lib/auth/session";
import { notifyTeam } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/lib/notification-types";
import { parseInput } from "@/lib/validation/form";
import { askAsClientSchema } from "@/lib/validation/schemas";
import { notifyClient, notify } from "@/lib/notifications";
import { mutateDoc } from "@/lib/intake/store";
import { VERIFICATION_DOC, type VerificationQueue } from "@/lib/intake/types";
import { parseVerificationContextId } from "@/lib/questions";
import type { QuestionContext } from "@prisma/client";

// Server actions for the generalized Question model. Team asks a client (open
// question or confirmation of a proposed answer) or another team member; the
// recipient answers / confirms; the team resolves. See lib/questions.ts.

function revalidateFor(projectId: string | null) {
  if (projectId) revalidatePath(`/projects/${projectId}`);
  // "layout" invalidates the whole /portal subtree — the dashboard, the project
  // detail pages and /portal/messages all read the same rows.
  revalidatePath("/portal", "layout");
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
    link: "/portal/messages",
  });
  revalidateFor(input.projectId);
  return { id: q.id };
}

// ─── Client asks their team ───────────────────────────────────────────────────
// The mirror of askClient. Addressed to the team as a whole (recipientId null,
// recipientRole TEAM) because no single member owns a client's question.
export async function askAsClient(input: {
  projectId?: string | null;
  questionText: string;
}): Promise<{ id?: string; error?: string }> {
  const user = await requireUser();
  if (user.role !== "CLIENT") return { error: "Unauthorized" };

  const parsed = parseInput(askAsClientSchema, input);
  if (!parsed.ok) return { error: parsed.error };
  const { projectId, questionText } = parsed.data;

  // Ownership, not just existence — a client must not ask about someone
  // else's project.
  let project: { id: string; name: string } | null = null;
  if (projectId) {
    project = await prisma.project.findFirst({
      where: { id: projectId, clientId: user.id, isArchived: false },
      select: { id: true, name: true },
    });
    if (!project) return { error: "Project not found." };
  }

  const q = await prisma.question.create({
    data: {
      projectId: project?.id ?? null,
      // QuestionContext has no GENERAL member and adding one would break the
      // deployed Prisma client mid-release (expand → deploy → contract).
      contextType: "PROJECT",
      kind: "ANSWER",
      askedById: user.id,
      recipientRole: "TEAM",
      questionText,
      status: "WAITING_TEAM",
    },
  });

  // The notification carries the question itself: no team screen lists
  // questions addressed to the team as a whole, so this is how the team sees it.
  const asker = user.name ?? user.email;
  const preview = questionText.length > 80 ? `${questionText.slice(0, 80)}…` : questionText;
  await notifyTeam({
    projectId: project?.id,
    type: NOTIFICATION_TYPES.clientQuestion,
    message: `${project ? `${project.name}: ` : ""}${asker} asked — "${preview}"`,
    link: project ? `/projects/${project.id}` : `/clients/${user.id}`,
  });

  revalidateFor(project?.id ?? null);
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
  if (user.role === "CLIENT" && q.recipientId !== user.id) return { error: "Unauthorized" };
  await prisma.question.update({
    where: { id: questionId },
    data: { answerText: text, status: "ANSWERED", answeredAt: new Date() },
  });

  // Verification questions: write the client's answer back onto the queue item so
  // it appears (with dates) in the Verification tab / Resolved history.
  const verification = q.contextType === "VERIFICATION" ? parseVerificationContextId(q.contextId, q.recipientId) : null;
  if (verification) {
    const { clientId, itemId } = verification;
    try {
      await mutateDoc<VerificationQueue>(clientId, VERIFICATION_DOC, (queue) => {
        const item = queue.items?.find((i) => i.item_id === itemId);
        if (!item) return;
        item.client_answer = text;
        item.client_answered_at = new Date().toISOString();
        if (!item.resolved_value) item.resolved_value = text;
      });
      revalidatePath(`/clients/${clientId}/data`);
    } catch (err) {
      console.error("answerQuestion: verification writeback failed", err);
    }
  }

  // Notify the team (asker) that it was answered.
  await notify({
    projectId: q.projectId ?? undefined,
    type: "question_answered",
    toRole: "TEAM",
    message:
      q.contextType === "VERIFICATION"
        ? `A client answered a verification question.`
        : `A question was answered.`,
    link: q.projectId ? `/projects/${q.projectId}` : verification ? `/clients/${verification.clientId}/data?tab=verify` : undefined,
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
  if (user.role === "CLIENT" && q.recipientId !== user.id) return { error: "Unauthorized" };
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
