"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAiJob } from "@/app/actions/ai-jobs";

export type StartJob = () => Promise<{ jobId?: string; error?: string }>;

const POLL_MS = 4000;

// Starts a background AI job and polls it to completion. `initialJob` lets a
// page that reloads mid-run resume polling (button keeps showing "Running…").
export function useAiJob(options: { initialJobId?: string | null; onDone?: () => void } = {}) {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(options.initialJobId ?? null);
  const [running, setRunning] = useState<boolean>(!!options.initialJobId);
  const [error, setError] = useState<string | null>(null);
  const onDone = useRef(options.onDone);
  useEffect(() => {
    onDone.current = options.onDone;
  }, [options.onDone]);

  useEffect(() => {
    if (!jobId || !running) return;
    let cancelled = false;
    const tick = async () => {
      const job = await getAiJob(jobId).catch(() => null);
      if (cancelled) return;
      if (!job) {
        setRunning(false);
        setError("Job not found.");
        return;
      }
      if (job.status === "done") {
        setRunning(false);
        setJobId(null);
        onDone.current?.();
        // The job revalidated the affected paths in another request; pull them in.
        router.refresh();
      } else if (job.status === "failed") {
        setRunning(false);
        setJobId(null);
        setError(job.error ?? "The AI job failed.");
      }
    };
    const timer = setInterval(tick, POLL_MS);
    tick();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [jobId, running, router]);

  const start = useCallback(async (fn: StartJob) => {
    setError(null);
    setRunning(true);
    const res = await fn();
    if (res.error || !res.jobId) {
      setRunning(false);
      setError(res.error ?? "Could not start the job.");
      return false;
    }
    setJobId(res.jobId);
    return true;
  }, []);

  return { running, error, start, setError };
}
