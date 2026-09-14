"use server";

import { requireTeam } from "@/lib/auth/session";
import { getAiJobView, type AiJobView } from "@/lib/ai/jobs";

// Polled by the UI while a job is queued/running.
export async function getAiJob(jobId: string): Promise<AiJobView | null> {
  await requireTeam();
  return getAiJobView(jobId);
}
