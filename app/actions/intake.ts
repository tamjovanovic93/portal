"use server";

import { revalidatePath } from "next/cache";
import { requireTeam } from "@/lib/auth/session";
import { PROFILE_DOC, type ClientProfile } from "@/lib/intake/types";
import { mutateDoc } from "@/lib/intake/store";
import { enqueueAiJob } from "@/lib/ai/jobs";
import { checkIntakePreconditions, checkStrategyPreconditions } from "@/lib/ai/jobs/intake";

// The two-agent intake pipeline. Agent 1 turns the approved intake form into a
// client_profile + verification_queue (status: draft). A human verifies the
// profile (markProfileVerified). Agent 2 then builds the strategy — but only if
// the profile is verified (hard gate). Both agents run as background jobs
// (lib/ai/jobs); these actions validate, enqueue and return a job id the UI polls.

export type StartJobResult = { jobId?: string; error?: string };

export async function runIntakeAgent(clientId: string): Promise<StartJobResult> {
  const user = await requireTeam();
  const pre = await checkIntakePreconditions(clientId);
  if (pre.error) return { error: pre.error };
  return enqueueAiJob("intake", clientId, user.id);
}

export async function runStrategyAgent(clientId: string): Promise<StartJobResult> {
  const user = await requireTeam();
  const pre = await checkStrategyPreconditions(clientId);
  if (pre.error) return { error: pre.error };
  return enqueueAiJob("strategy", clientId, user.id);
}

// ─── Verification gate ─────────────────────────────────────────────────────────

export async function markProfileVerified(
  clientId: string
): Promise<{ success?: boolean; error?: string }> {
  await requireTeam();
  try {
    await mutateDoc<ClientProfile>(clientId, PROFILE_DOC, (profile) => {
      profile._meta.status = "verified";
    });
  } catch {
    return { error: "No client profile to verify. Run intake first." };
  }
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/data`);
  return { success: true };
}

export async function markProfileDraft(
  clientId: string
): Promise<{ success?: boolean; error?: string }> {
  await requireTeam();
  try {
    await mutateDoc<ClientProfile>(clientId, PROFILE_DOC, (profile) => {
      profile._meta.status = "draft";
    });
  } catch {
    return { error: "No client profile found." };
  }
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/data`);
  return { success: true };
}
