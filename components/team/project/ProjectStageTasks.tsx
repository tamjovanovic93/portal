"use client";

import { useState } from "react";
import StageTasks, { type StageTask } from "@/components/team/project/StageTasks";
import type { RosterMember } from "@/lib/team";
import { STAGE_LABELS, STAGE_COUNT } from "@/lib/stages";

// Stage-tabbed task board on the project page:
//   Stage 1  = planning overview of every synced task (grouped by scope-item
//              list, no statuses).
//   Stage 2+ = the Kanban board (Planning / In Progress / Waiting Approval /
//              Done) showing only the tasks placed in that stage.
export default function ProjectStageTasks({
  projectId,
  tasks,
  roster,
  initialStage = 1,
}: {
  projectId: string;
  tasks: StageTask[];
  roster: RosterMember[];
  initialStage?: number;
}) {
  const [stage, setStage] = useState(initialStage);

  const countFor = (n: number) =>
    n === 1 ? tasks.length : tasks.filter((t) => t.stageNumber === n).length;

  const shown = stage === 1 ? tasks : tasks.filter((t) => t.stageNumber === stage);

  return (
    <div className="space-y-3">
      {/* Stage tabs */}
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: STAGE_COUNT }, (_, i) => i + 1).map((n) => {
          const active = n === stage;
          const count = countFor(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => setStage(n)}
              className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                active
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
              }`}
              title={STAGE_LABELS[n]}
            >
              {n === 1 ? "1 · Planning" : `${n} · ${STAGE_LABELS[n]}`}
              {count > 0 && (
                <span className={`ml-1.5 ${active ? "text-neutral-300" : "text-neutral-400"}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-neutral-500">
        {stage === 1
          ? "Every scope item and its tasks — the full planning overview. Statuses start from Stage 2."
          : `Only the tasks placed in Stage ${stage}. Update status, assign people, add estimates and links, or move a task to another stage.`}
      </p>

      <StageTasks projectId={projectId} tasks={shown} roster={roster} planning={stage === 1} />
    </div>
  );
}
