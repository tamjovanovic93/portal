import type { StageStatus } from "@prisma/client";
import { VAR } from "@/components/ui/kit";
import { STAGE_LABELS, STAGE_COUNT } from "@/lib/stages";

// Seven-dot stage progress strip. Two looks are in use and both are kept:
//  - "list"   — projects list: fixed-width Tailwind pips
//  - "stream" — client stream: token colours, flexible width, glow on current
export default function StagePips({
  currentStage,
  stageStatuses,
  variant = "list",
}: {
  currentStage: number;
  stageStatuses: { stageNumber: number; status: StageStatus }[];
  variant?: "list" | "stream";
}) {
  const statusMap = Object.fromEntries(stageStatuses.map((s) => [s.stageNumber, s.status]));

  return (
    <div className="flex items-center gap-1 mt-3">
      {Array.from({ length: STAGE_COUNT }, (_, i) => i + 1).map((n) => {
        const status = statusMap[n];
        const isCurrent = n === currentStage;
        const isDone = status === "COMPLETE";
        const isGate = status === "GATE_PENDING";
        const title = `Stage ${n} — ${STAGE_LABELS[n]}`;

        if (variant === "stream") {
          let bg = "var(--surface-3)";
          if (isDone) bg = "var(--mint)";
          else if (isGate) bg = "var(--amber)";
          else if (isCurrent) bg = "var(--mint)";
          return (
            <div
              key={n}
              title={title}
              className="h-1.5 flex-1 rounded-full"
              style={{ background: bg, boxShadow: isCurrent ? `0 0 8px ${VAR.mint}` : "none", opacity: isDone || isCurrent || isGate ? 1 : 0.6 }}
            />
          );
        }

        let bg = "bg-neutral-200";
        if (isDone) bg = "bg-neutral-900";
        else if (isGate) bg = "bg-amber-400";
        else if (isCurrent) bg = "bg-neutral-500";
        return <div key={n} title={title} className={`h-1.5 w-6 rounded-full ${bg}`} />;
      })}
    </div>
  );
}
