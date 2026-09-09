"use client";

import { useState } from "react";
import Link from "next/link";
import AdvanceStageButton from "@/components/team/AdvanceStageButton";
import { STAGE_LABELS, STAGE_INFO, STAGE_COUNT, isGatedStage } from "@/lib/stages";

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  GATE_PENDING: "Gate pending",
  COMPLETE: "Complete",
};

const STATUS_STYLE: Record<string, string> = {
  NOT_STARTED: "text-neutral-600",
  IN_PROGRESS: "text-blue-600",
  GATE_PENDING: "text-amber-600",
  COMPLETE: "text-neutral-900",
};

type StageRow = {
  stageNumber: number;
  status: string;
  gateApproved: boolean;
};

function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5.5" width="7" height="5" rx="1" />
      <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6.5l2.5 2.5 4.5-5" />
    </svg>
  );
}

export default function StageProgressBar({
  stages,
  currentStage,
  projectId,
}: {
  stages: StageRow[];
  currentStage: number;
  projectId: string;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const statusMap = Object.fromEntries(stages.map((s) => [s.stageNumber, s]));

  const currentStatus = statusMap[currentStage]?.status;
  const currentHasGate = isGatedStage(currentStage);
  const currentGateApproved = statusMap[currentStage]?.gateApproved ?? false;
  const gateLocked = currentHasGate && !currentGateApproved && currentStatus !== "COMPLETE";

  return (
    <div>
      <div className="flex gap-1">
        {Array.from({ length: STAGE_COUNT }, (_, i) => i + 1).map((n) => {
          const stage = statusMap[n];
          const isCurrent = n === currentStage;
          const isDone = stage?.status === "COMPLETE";
          const isGate = stage?.status === "GATE_PENDING";
          const isExpanded = expanded === n;
          const hasGate = isGatedStage(n);
          // Gate stages show a lock until the client signs off; once passed, a check.
          const gateUnresolved = hasGate && !stage?.gateApproved && stage?.status !== "COMPLETE";
          const gatePassed = hasGate && (stage?.gateApproved || stage?.status === "COMPLETE");

          let pipBg = "bg-neutral-200"; // not started — muted/empty
          if (isDone) pipBg = "bg-neutral-900"; // completed — solid
          else if (isGate) pipBg = "bg-amber-400"; // gate-pending — amber
          else if (isCurrent) pipBg = "bg-blue-500"; // current — highlighted

          return (
            <button
              key={n}
              onClick={() => setExpanded(isExpanded ? null : n)}
              className="flex-1 flex flex-col items-center gap-1 group py-1"
              title={STAGE_LABELS[n]}
            >
              <div className="h-3.5 flex items-center justify-center">
                {gateUnresolved && (
                  <LockIcon className={`w-3 h-3 ${isGate ? "text-amber-500" : "text-neutral-600"}`} />
                )}
                {gatePassed && <CheckIcon className="w-3 h-3 text-neutral-900" />}
              </div>
              <div
                className={`h-2 w-full rounded-full transition-opacity ${pipBg} ${
                  isCurrent ? "ring-2 ring-offset-1 ring-blue-200" : ""
                } ${
                  isExpanded ? "ring-2 ring-offset-1 ring-neutral-400" : "group-hover:opacity-80"
                }`}
              />
              <span
                className={`text-xs transition-colors ${
                  isCurrent
                    ? "text-neutral-900 font-semibold"
                    : isDone
                    ? "text-neutral-700"
                    : "text-neutral-600 group-hover:text-neutral-600"
                }`}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* Current-stage caption — name always visible, with gate status */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-neutral-900">
          Stage {currentStage} · {STAGE_LABELS[currentStage]}
        </span>
        {gateLocked ? (
          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700">
            <LockIcon className="w-3 h-3" />
            {currentStatus === "GATE_PENDING" ? "Gate pending" : "Gate ahead"}
          </span>
        ) : currentHasGate && currentGateApproved ? (
          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700">
            <CheckIcon className="w-3 h-3" />
            Gate approved
          </span>
        ) : null}
      </div>

      {expanded !== null && (
        <div className="mt-2 border border-neutral-200 rounded-lg p-4 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-neutral-600">
                  {String(expanded).padStart(2, "0")}
                </span>
                <h3 className="text-sm font-semibold text-neutral-900">
                  {STAGE_LABELS[expanded]}
                </h3>
                {isGatedStage(expanded) && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                    gate
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-700 mt-0.5">
                {STAGE_INFO[expanded]?.description}
              </p>
              {statusMap[expanded] && (
                <p
                  className={`text-xs mt-1 font-medium ${
                    STATUS_STYLE[statusMap[expanded].status] ?? "text-neutral-600"
                  }`}
                >
                  {STATUS_LABEL[statusMap[expanded].status] ?? statusMap[expanded].status}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/projects/${projectId}/stage/${expanded}`}
                className="text-xs text-neutral-700 hover:text-neutral-900 border border-neutral-200 px-2.5 py-1 rounded-md transition-colors"
              >
                Docs →
              </Link>
              {expanded === currentStage &&
                statusMap[expanded]?.status !== "COMPLETE" && (
                  <AdvanceStageButton
                    projectId={projectId}
                    currentStage={currentStage}
                    hasGate={isGatedStage(expanded)}
                    gateApproved={statusMap[expanded]?.gateApproved ?? false}
                  />
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
