import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runIntakeJob, runStrategyJob } from "./jobs/intake";
import { runSuggestionsJob } from "./jobs/suggestions";
import { runBriefDraftJob } from "./jobs/briefDraft";
import type { AgentUsage } from "./client";

// ─── Job model ───────────────────────────────────────────────────────────────
// A job is a row in ai_jobs. The action that starts it enqueues the row and
// (after the response is sent) POSTs to /api/ai/run, which claims the row,
// responds 202 and executes the runner inside its own maxDuration. Polling
// (getAiJob) and the sweep cron re-dispatch anything that got stuck.

export const AI_JOB_TYPES = ["intake", "strategy", "suggestions", "brief_draft"] as const;
export type AiJobType = (typeof AI_JOB_TYPES)[number];
export type AiJobStatus = "queued" | "running" | "done" | "failed";

// A job that has been queued this long without being claimed is re-dispatched.
export const STALE_QUEUED_MS = 60 * 1000;
// A running job older than this is assumed killed by the platform.
export const STALE_RUNNING_MS = 15 * 60 * 1000;

export type AiJobView = {
  id: string;
  type: AiJobType;
  targetId: string;
  status: AiJobStatus;
  error: string | null;
  result: unknown;
  createdAt: string;
  finishedAt: string | null;
};

function toView(j: {
  id: string; type: string; targetId: string; status: string; error: string | null;
  result: Prisma.JsonValue | null; createdAt: Date; finishedAt: Date | null;
}): AiJobView {
  return {
    id: j.id,
    type: j.type as AiJobType,
    targetId: j.targetId,
    status: j.status as AiJobStatus,
    error: j.error,
    result: j.result,
    createdAt: j.createdAt.toISOString(),
    finishedAt: j.finishedAt ? j.finishedAt.toISOString() : null,
  };
}

// ─── Enqueue & dispatch ──────────────────────────────────────────────────────

async function requestOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Fire-and-forget POST to the run route. The route claims the job and returns
// 202 at once, so this resolves in milliseconds.
export async function dispatchJob(jobId: string, origin: string): Promise<void> {
  const secret = process.env.AI_JOB_SECRET;
  if (!secret) {
    console.error("AI_JOB_SECRET is not set — cannot dispatch AI jobs.");
    await prisma.aiJob.update({ where: { id: jobId }, data: { status: "failed", error: "AI_JOB_SECRET is not configured.", finishedAt: new Date() } }).catch(() => {});
    return;
  }
  try {
    const res = await fetch(`${origin}/api/ai/run`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ai-job-secret": secret },
      body: JSON.stringify({ jobId }),
      cache: "no-store",
    });
    if (!res.ok) console.error("dispatchJob: run route responded", res.status);
  } catch (err) {
    console.error("dispatchJob failed:", err);
  }
}

// Idempotent: an active job of the same type for the same target is reused.
export async function enqueueAiJob(type: AiJobType, targetId: string, createdBy: string): Promise<{ jobId: string }> {
  const active = await prisma.aiJob.findFirst({
    where: { type, targetId, status: { in: ["queued", "running"] } },
    select: { id: true },
  });
  if (active) return { jobId: active.id };

  const job = await prisma.aiJob.create({ data: { type, targetId, createdBy, status: "queued" } });
  const origin = await requestOrigin();
  after(() => dispatchJob(job.id, origin));
  return { jobId: job.id };
}

// ─── Execution (called from the run route inside after()) ────────────────────

export async function claimJob(jobId: string): Promise<boolean> {
  const claimed = await prisma.aiJob.updateMany({
    where: { id: jobId, status: "queued" },
    data: { status: "running", startedAt: new Date() },
  });
  return claimed.count === 1;
}

function revalidateForJob(type: AiJobType, targetId: string, result: unknown) {
  if (type === "brief_draft") {
    const projectId = (result as { projectId?: string } | null)?.projectId;
    if (projectId) {
      revalidatePath(`/projects/${projectId}`);
      revalidatePath(`/portal/brief/${projectId}`);
    }
    return;
  }
  revalidatePath(`/clients/${targetId}`);
  revalidatePath(`/clients/${targetId}/data`);
}

export async function executeJob(jobId: string): Promise<void> {
  const job = await prisma.aiJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "running") return;
  const type = job.type as AiJobType;

  try {
    let out: { result: unknown; usage: AgentUsage };
    switch (type) {
      case "intake": out = await runIntakeJob(job.targetId); break;
      case "strategy": out = await runStrategyJob(job.targetId); break;
      case "suggestions": out = await runSuggestionsJob(job.targetId); break;
      case "brief_draft": out = await runBriefDraftJob(job.targetId); break;
      default: throw new Error(`Unknown job type: ${job.type}`);
    }
    await prisma.aiJob.update({
      where: { id: jobId },
      data: {
        status: "done",
        result: (out.result ?? {}) as Prisma.InputJsonValue,
        inputTokens: out.usage.inputTokens,
        outputTokens: out.usage.outputTokens,
        finishedAt: new Date(),
      },
    });
    revalidateForJob(type, job.targetId, out.result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI job failed.";
    console.error(`AI job ${jobId} (${type}) failed:`, err);
    await prisma.aiJob.update({
      where: { id: jobId },
      data: { status: "failed", error: message, finishedAt: new Date() },
    }).catch(() => {});
  }
}

// ─── Read / self-heal ────────────────────────────────────────────────────────

export async function getAiJobView(jobId: string): Promise<AiJobView | null> {
  const job = await prisma.aiJob.findUnique({ where: { id: jobId } });
  if (!job) return null;
  const now = Date.now();
  // Self-heal without a cron: a job nobody claimed gets re-dispatched; a job
  // the platform killed is marked failed so the UI stops waiting.
  if (job.status === "queued" && now - job.createdAt.getTime() > STALE_QUEUED_MS) {
    const origin = await requestOrigin();
    await prisma.aiJob.update({ where: { id: jobId }, data: { createdAt: new Date() } });
    after(() => dispatchJob(jobId, origin));
  } else if (job.status === "running" && job.startedAt && now - job.startedAt.getTime() > STALE_RUNNING_MS) {
    await prisma.aiJob.update({
      where: { id: jobId },
      data: { status: "failed", error: "The job did not finish in time. Please run it again.", finishedAt: new Date() },
    });
    job.status = "failed";
    job.error = "The job did not finish in time. Please run it again.";
  }
  return toView(job);
}

export async function findActiveJob(type: AiJobType | AiJobType[], targetId: string): Promise<AiJobView | null> {
  const job = await prisma.aiJob.findFirst({
    where: { targetId, type: Array.isArray(type) ? { in: type } : type, status: { in: ["queued", "running"] } },
    orderBy: { createdAt: "desc" },
  });
  return job ? toView(job) : null;
}

// Cron sweep: re-dispatch unclaimed jobs, fail the ones the platform killed.
export async function sweepJobs(origin: string): Promise<{ redispatched: number; failed: number }> {
  const now = new Date();
  const stuck = await prisma.aiJob.updateMany({
    where: { status: "running", startedAt: { lt: new Date(now.getTime() - STALE_RUNNING_MS) } },
    data: { status: "failed", error: "The job did not finish in time. Please run it again.", finishedAt: now },
  });
  const queued = await prisma.aiJob.findMany({
    where: { status: "queued", createdAt: { lt: new Date(now.getTime() - STALE_QUEUED_MS) } },
    select: { id: true },
    take: 20,
  });
  for (const j of queued) {
    await prisma.aiJob.update({ where: { id: j.id }, data: { createdAt: now } });
    await dispatchJob(j.id, origin);
  }
  return { redispatched: queued.length, failed: stuck.count };
}
