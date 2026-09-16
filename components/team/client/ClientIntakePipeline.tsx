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
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";

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
          <Button variant="primary" size="sm"
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
           
          >
            {busy("intake") ? "Running…" : hasProfile ? "Re-run intake" : "Run intake"}
          </Button>
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
                ? "bg-mint-fill text-mint"
                : hasProfile
                ? "bg-amber-fill text-amber"
                : "bg-inset text-ink-3"
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
            <Button variant="primary" size="sm"
              onClick={() => run("verify", () => markProfileVerified(clientId))}
              disabled={anyBusy}
             
            >
              {busy("verify") ? "…" : "Mark verified"}
            </Button>
          )}
          {verified && (
            <Button variant="ghost" size="sm"
              onClick={() => run("unverify", () => markProfileDraft(clientId))}
              disabled={anyBusy}
             
            >
              {busy("unverify") ? "…" : "Re-open as draft"}
            </Button>
          )}
        </PipelineStep>

        <PipelineStep
          n={3}
          title="Generate strategy (Agent 2)"
          done={hasStrategy}
          desc="Builds the full strategy document from the verified profile."
        >
          <Button variant="primary" size="sm"
            onClick={() =>
              runJob(
                "strategy",
                () => runStrategyAgent(clientId),
                hasStrategy ? "This replaces the existing strategy. Continue?" : undefined
              )
            }
            disabled={!verified || anyBusy}
           
            title={!verified ? "Verify the profile first" : undefined}
          >
            {busy("strategy") ? "Generating…" : hasStrategy ? "Regenerate strategy" : "Generate strategy"}
          </Button>
        </PipelineStep>
      </ol>

      {hasStrategy && (
        <p className="text-xs text-ink-3 pl-8">
          Client Data is ready. Suggested Projects can be generated from it (next phase).
        </p>
      )}
      {job.running && (
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <Loader label={active === "strategy" ? "Building the strategy" : "Building Client Data"} />
          <p className="text-xs text-ink-3 mt-1.5">
            This runs in the background and can take a minute. You can leave this page.
          </p>
        </div>
      )}
      {shownError && <p style={{ fontSize: 12, color: "var(--rose)" }}>{shownError}</p>}
    </div>
  );
}

