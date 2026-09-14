"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  runIntakeAgent,
  markProfileVerified,
  markProfileDraft,
  runStrategyAgent,
} from "@/app/actions/intake";
import { useAiJob } from "@/components/ai/useAiJob";
import PipelineStep from "@/components/team/PipelineStep";

// Client-level Client Data pipeline: Agent 1 (profile + verification) →
// verify gate → Agent 2 (strategy). All keyed by clientId. The two agents run
// as background jobs; this component polls until they finish. Publishing to
// the client's portal belongs to a project's brief, not here.
type ProfileStatus = "draft" | "verified" | null;

export type ActiveJob = { id: string; type: string } | null;

export default function ClientIntakePipeline({
  clientId,
  hasApprovedIntake,
  profileStatus,
  hasStrategy,
  activeJob = null,
}: {
  clientId: string;
  hasApprovedIntake: boolean;
  profileStatus: ProfileStatus;
  hasStrategy: boolean;
  activeJob?: ActiveJob;
}) {
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState<string | null>(activeJob?.type ?? null);
  const [error, setError] = useState<string | null>(null);
  const job = useAiJob({ initialJobId: activeJob?.id, onDone: () => setActive(null) });

  const hasProfile = profileStatus !== null;
  const verified = profileStatus === "verified";

  // Synchronous actions (verify / re-open).
  function run(key: string, action: () => Promise<{ error?: string }>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setError(null);
    setActive(key);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
      setActive(null);
    });
  }

  // Background jobs (intake / strategy).
  async function runJob(key: "intake" | "strategy", start: () => Promise<{ jobId?: string; error?: string }>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setError(null);
    setActive(key);
    const ok = await job.start(start);
    if (!ok) setActive(null);
  }

  const anyBusy = isPending || job.running;
  const busy = (key: string) => anyBusy && active === key;
  const shownError = error ?? job.error;

  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        <PipelineStep
          n={1}
          title="Run intake (Agent 1)"
          done={hasProfile}
          desc="Builds the client profile + verification queue from the intake form, researching gaps."
        >
          <button
            onClick={() =>
              runJob(
                "intake",
                () => runIntakeAgent(clientId),
                hasProfile
                  ? "This replaces the existing client profile and verification queue. Continue?"
                  : undefined
              )
            }
            disabled={!hasApprovedIntake || anyBusy}
            className="btn btn-sm btn-primary"
          >
            {busy("intake") ? "Running…" : hasProfile ? "Re-run intake" : "Run intake"}
          </button>
        </PipelineStep>

        <PipelineStep
          n={2}
          title="Verify the profile"
          done={verified}
          desc="Review and correct the profile in Client Data, then mark it verified to unlock strategy."
        >
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              verified
                ? "bg-green-100 text-green-800"
                : hasProfile
                ? "bg-amber-100 text-amber-800"
                : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {verified ? "Verified" : hasProfile ? "Draft" : "—"}
          </span>
          {hasProfile && (
            <Link href={`/clients/${clientId}/data?tab=verify`} className="btn btn-sm btn-ghost">
              Review &amp; verification queue →
            </Link>
          )}
          {hasProfile && !verified && (
            <button
              onClick={() => run("verify", () => markProfileVerified(clientId))}
              disabled={anyBusy}
              className="btn btn-sm btn-primary"
            >
              {busy("verify") ? "…" : "Mark verified"}
            </button>
          )}
          {verified && (
            <button
              onClick={() => run("unverify", () => markProfileDraft(clientId))}
              disabled={anyBusy}
              className="btn btn-sm btn-ghost"
            >
              {busy("unverify") ? "…" : "Re-open as draft"}
            </button>
          )}
        </PipelineStep>

        <PipelineStep
          n={3}
          title="Generate strategy (Agent 2)"
          done={hasStrategy}
          desc="Builds the full strategy document from the verified profile."
        >
          <button
            onClick={() =>
              runJob(
                "strategy",
                () => runStrategyAgent(clientId),
                hasStrategy ? "This replaces the existing strategy. Continue?" : undefined
              )
            }
            disabled={!verified || anyBusy}
            className="btn btn-sm btn-primary"
            title={!verified ? "Verify the profile first" : undefined}
          >
            {busy("strategy") ? "Generating…" : hasStrategy ? "Regenerate strategy" : "Generate strategy"}
          </button>
        </PipelineStep>
      </ol>

      {hasStrategy && (
        <p className="text-xs text-neutral-500 pl-8">
          Client Data is ready. Suggested Projects can be generated from it (next phase).
        </p>
      )}
      {shownError && <p style={{ fontSize: 12, color: "var(--rose)" }}>{shownError}</p>}
    </div>
  );
}

