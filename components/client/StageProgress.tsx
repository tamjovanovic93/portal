import { STAGE_COUNT, clientStageLabel } from "@/lib/stages";

// The 7-segment delivery progress bar. Clients see "Step 2 of 7 · Wireframes",
// never "Stage 2" or the internal stage names — clientStageLabel enforces that.

export default function StageProgress({
  current,
  className,
}: {
  current: number;
  className?: string;
}) {
  const next = current < STAGE_COUNT ? clientStageLabel(current + 1) : null;

  return (
    <div className={className}>
      <p className="eyebrow" style={{ color: "var(--mint)" }}>
        Step {current} of {STAGE_COUNT} · {clientStageLabel(current)}
      </p>
      <div className="flex items-center gap-1 mt-2 max-w-[200px]">
        {Array.from({ length: STAGE_COUNT }, (_, i) => (
          <span
            key={i}
            className="flex-1 h-1 rounded-full"
            style={{ background: i < current ? "var(--mint)" : "var(--border-2)" }}
          />
        ))}
      </div>
      {next ? <p className="text-xs text-ink-3 mt-2">Next: {next}</p> : null}
    </div>
  );
}
