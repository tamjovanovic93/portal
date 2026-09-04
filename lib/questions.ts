import { prisma } from "@/lib/prisma";
import type { QuestionContext, QuestionStatus } from "@prisma/client";

// Shared helpers for the generalized Question model. A question belongs to a
// context (project / task / brief / verification item) and is either an open
// ANSWER request or a CONFIRM (we proposed an answer). All reads go through
// Prisma. See app/actions/questions.ts.

// "Active" = still needs someone to act. Answered/resolved move to history.
export const ACTIVE_STATUSES: QuestionStatus[] = ["OPEN", "WAITING_CLIENT", "WAITING_TEAM", "WAITING_CONFIRMATION"];
export const HISTORY_STATUSES: QuestionStatus[] = ["ANSWERED", "RESOLVED"];
// Statuses that mean "we're waiting on the client".
export const WAITING_CLIENT_STATUSES: QuestionStatus[] = ["WAITING_CLIENT", "WAITING_CONFIRMATION"];

export function isActive(status: QuestionStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export type QuestionRow = {
  id: string;
  projectId: string | null;
  contextType: QuestionContext;
  contextId: string | null;
  kind: "ANSWER" | "CONFIRM";
  status: QuestionStatus;
  questionText: string;
  proposedAnswer: string | null;
  answerText: string | null;
  askedByName: string | null;
  recipientName: string | null;
  recipientRole: "TEAM" | "CLIENT" | null;
  createdAt: string;
  answeredAt: string | null;
  resolvedAt: string | null;
};

const SELECT = {
  id: true, projectId: true, contextType: true, contextId: true, kind: true, status: true,
  questionText: true, proposedAnswer: true, answerText: true, recipientRole: true,
  createdAt: true, answeredAt: true, resolvedAt: true,
  askedBy: { select: { name: true, email: true } },
  recipient: { select: { name: true, email: true } },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shape(q: any): QuestionRow {
  return {
    id: q.id, projectId: q.projectId, contextType: q.contextType, contextId: q.contextId,
    kind: q.kind, status: q.status, questionText: q.questionText,
    proposedAnswer: q.proposedAnswer, answerText: q.answerText,
    askedByName: q.askedBy ? (q.askedBy.name ?? q.askedBy.email) : null,
    recipientName: q.recipient ? (q.recipient.name ?? q.recipient.email) : null,
    recipientRole: q.recipientRole,
    createdAt: q.createdAt.toISOString(),
    answeredAt: q.answeredAt ? q.answeredAt.toISOString() : null,
    resolvedAt: q.resolvedAt ? q.resolvedAt.toISOString() : null,
  };
}

// All questions for a context (task / brief / verification item), newest first.
export async function listForContext(contextType: QuestionContext, contextId: string): Promise<QuestionRow[]> {
  const rows = await prisma.question.findMany({
    where: { contextType, contextId },
    orderBy: { createdAt: "desc" },
    select: SELECT,
  });
  return rows.map(shape);
}

// All questions for a whole project (e.g. the verification page), newest first.
export async function listForProject(projectId: string): Promise<QuestionRow[]> {
  const rows = await prisma.question.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: SELECT,
  });
  return rows.map(shape);
}

// All questions for a set of tasks, grouped by task id (single query — no N+1).
export async function listByTaskIds(taskIds: string[]): Promise<Map<string, QuestionRow[]>> {
  const out = new Map<string, QuestionRow[]>();
  if (taskIds.length === 0) return out;
  const rows = await prisma.question.findMany({
    where: { contextType: "TASK", contextId: { in: taskIds } },
    orderBy: { createdAt: "desc" },
    select: SELECT,
  });
  for (const r of rows) {
    const shaped = shape(r);
    const key = shaped.contextId ?? "";
    const arr = out.get(key) ?? [];
    arr.push(shaped);
    out.set(key, arr);
  }
  return out;
}

// Open-question badge counts per task id (single grouped query — no N+1).
export type TaskQuestionCounts = { client: number; team: number; confirm: number };

export async function openQuestionCountsByTask(taskIds: string[]): Promise<Map<string, TaskQuestionCounts>> {
  const out = new Map<string, TaskQuestionCounts>();
  if (taskIds.length === 0) return out;
  const rows = await prisma.question.groupBy({
    by: ["contextId", "status"],
    where: { contextType: "TASK", contextId: { in: taskIds }, status: { in: ACTIVE_STATUSES } },
    _count: { _all: true },
  });
  for (const r of rows) {
    if (!r.contextId) continue;
    const c = out.get(r.contextId) ?? { client: 0, team: 0, confirm: 0 };
    const n = r._count._all;
    if (r.status === "WAITING_CLIENT") c.client += n;
    else if (r.status === "WAITING_TEAM") c.team += n;
    else if (r.status === "WAITING_CONFIRMATION") c.confirm += n;
    else if (r.status === "OPEN") c.team += n;
    out.set(r.contextId, c);
  }
  return out;
}
