"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  runIntakeAgent,
  markProfileVerified,
  markProfileDraft,
  runStrategyAgent,
} from "@/app/actions/intake";

// Client-level Client Data pipeline: Agent 1 (profile + verification) →
// verify gate → Agent 2 (strategy). All keyed by clientId. Publishing to the
// client's portal belongs to a project's brief, not here.
type ProfileStatus = "draft" | "verified" | null;

export default function ClientIntakePipeline({
  clientId,
  hasApprovedIntake,
  profileStatus,
  hasStrategy,
}: {
  clientId: string;
  hasApprovedIntake: boolean;
  profileStatus: ProfileStatus;
  hasStrategy: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasProfile = profileStatus !== null;
  const verified = profileStatus === "verified";

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

  const busy = (key: string) => isPending && active === key;

  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        <Step
          n={1}
          title="Run intake (Agent 1)"
          done={hasProfile}
          desc="Builds the client profile + verification queue from the intake form, researching gaps."
        >
          <button
            onClick={() =>
              run(
                "intake",
                () => runIntakeAgent(clientId),
                hasProfile
                  ? "This replaces the existing client profile and verification queue. Continue?"
                  : undefined
              )
            }
            disabled={!hasApprovedIntake || isPending}
            className="btn btn-sm btn-primary"
          >
            {busy("intake") ? "Running…" : hasProfile ? "Re-run intake" : "Run intake"}
          </button>
        </Step>

        <Step
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
              disabled={isPending}
              className="btn btn-sm btn-primary"
            >
              {busy("verify") ? "…" : "Mark verified"}
            </button>
          )}
          {verified && (
            <button
              onClick={() => run("unverify", () => markProfileDraft(clientId))}
              disabled={isPending}
              className="btn btn-sm btn-ghost"
            >
              {busy("unverify") ? "…" : "Re-open as draft"}
            </button>
          )}
        </Step>

        <Step
          n={3}
          title="Generate strategy (Agent 2)"
          done={hasStrategy}
          desc="Builds the full strategy document from the verified profile."
        >
          <button
            onClick={() =>
              run(
                "strategy",
                () => runStrategyAgent(clientId),
                hasStrategy ? "This replaces the existing strategy. Continue?" : undefined
              )
            }
            disabled={!verified || isPending}
            className="btn btn-sm btn-primary"
            title={!verified ? "Verify the profile first" : undefined}
          >
            {busy("strategy") ? "Generating…" : hasStrategy ? "Regenerate strategy" : "Generate strategy"}
          </button>
        </Step>
      </ol>

      {hasStrategy && (
        <p className="text-xs text-neutral-500 pl-8">
          Client Data is ready. Suggested Projects can be generated from it (next phase).
        </p>
      )}
      {error && <p style={{ fontSize: 12, color: "var(--rose)" }}>{error}</p>}
    </div>
  );
}

function Step({
  n,
  title,
  desc,
  done,
  children,
}: {
  n: number;
  title: string;
  desc: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 shrink-0 w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center ${
          done ? "bg-green-600 text-white" : "bg-neutral-200 text-neutral-600"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900">{title}</p>
        <p className="text-xs text-neutral-600 mt-0.5">{desc}</p>
        <div className="flex items-center gap-2 mt-2">{children}</div>
      </div>
    </li>
  );
}
