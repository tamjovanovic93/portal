"use client";

import { useTransition } from "react";
import { setRetainerStage } from "@/app/actions/retainer";

const STAGE_LABELS: Record<number, string> = {
  1: "Onboarding",
  2: "Strategy",
  3: "Sketch",
  4: "Make",
  5: "Build",
  6: "Client Review",
  7: "Launch",
  8: "Complete",
};

const STAGE_DESCRIPTIONS: Record<number, string> = {
  1: "Intake form, client database, brief.",
  2: "Research, strategy and scope.",
  3: "Wireframes / first structural direction.",
  4: "Full design / creative output.",
  5: "Build, QA, development.",
  6: "Client review and sign-off.",
  7: "Launch / delivery.",
  8: "Complete.",
};

export default function RetainerStageBar({
  projectId,
  currentStage,
}: {
  projectId: string;
  currentStage: number;
}) {
  const [isPending, startTransition] = useTransition();

  function go(stage: number) {
    if (stage === currentStage) return;
    startTransition(async () => {
      await setRetainerStage(projectId, stage);
    });
  }

  return (
    <section className={`rounded-lg border border-neutral-200 bg-white px-5 py-4 ${isPending ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
          Current stage
        </p>
        <p className="text-sm font-semibold text-neutral-900">
          Stage {currentStage} — {STAGE_LABELS[currentStage]}
        </p>
      </div>

      {/* Clickable pips */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => {
          const done = n < currentStage;
          const current = n === currentStage;
          let bg = "bg-neutral-200 hover:bg-neutral-300";
          if (done) bg = "bg-neutral-900";
          else if (current) bg = "bg-blue-500";
          return (
            <button
              key={n}
              type="button"
              onClick={() => go(n)}
              disabled={isPending}
              title={`Stage ${n} — ${STAGE_LABELS[n]}`}
              className="group flex-1 flex flex-col items-center gap-1"
            >
              <span className={`h-1.5 w-full rounded-full transition-colors ${bg}`} />
              <span
                className={`text-xs transition-colors ${
                  current ? "text-neutral-900 font-medium" : "text-neutral-600 group-hover:text-neutral-600"
                }`}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-neutral-500 mt-2">{STAGE_DESCRIPTIONS[currentStage]}</p>
    </section>
  );
}
