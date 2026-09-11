"use client";

import { useTransition } from "react";
import { setProjectHealth } from "@/app/actions/projects";
import type { ProjectHealth } from "@prisma/client";

const LABELS: Record<ProjectHealth, string> = {
  ON_TRACK: "On track",
  NEEDS_ATTENTION: "Needs attention",
  AT_RISK: "At risk",
};

const STYLE: Record<ProjectHealth, string> = {
  ON_TRACK: "bg-green-50 text-green-700 border-green-200",
  NEEDS_ATTENTION: "bg-amber-50 text-amber-700 border-amber-200",
  AT_RISK: "bg-red-50 text-red-700 border-red-200",
};

export default function ProjectHealthControl({
  projectId,
  health,
}: {
  projectId: string;
  health: ProjectHealth;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      value={health}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as ProjectHealth;
        start(async () => {
          await setProjectHealth(projectId, next);
        });
      }}
      className={`text-xs font-medium rounded-full border px-2 py-1 outline-none disabled:opacity-50 ${STYLE[health]}`}
    >
      {(Object.keys(LABELS) as ProjectHealth[]).map((h) => (
        <option key={h} value={h}>
          {LABELS[h]}
        </option>
      ))}
    </select>
  );
}
