// ─── Project workflow stages — single source of truth ───────────────────────
// The delivery workflow runs 1..7 starting at Strategy. Client intake, Client
// Data, and Suggested-Project selection all happen at the CLIENT level *before*
// a Project exists, so the old "Onboarding/Discovery" stage is no longer part of
// the Project workflow. Import from here — never hard-code stage numbers.

export const STAGE_COUNT = 7;
export const FINAL_STAGE = STAGE_COUNT;

export type StageInfo = { label: string; description: string; hasGate: boolean };

export const STAGE_INFO: Record<number, StageInfo> = {
  1: { label: "Strategy", description: "Research, scope of work, materials checklist", hasGate: false },
  2: { label: "Sketch", description: "Wireframes / first direction", hasGate: true },
  3: { label: "Make", description: "Full design / creative output", hasGate: true },
  4: { label: "Build", description: "Build, QA, dev handoff", hasGate: false },
  5: { label: "Client Review", description: "Final review and sign-off", hasGate: true },
  6: { label: "Launch / Delivery", description: "Go live, delivery checklist, handover", hasGate: false },
  7: { label: "Complete", description: "Archived — project record retained", hasGate: false },
};

export const STAGE_LABELS: Record<number, string> = Object.fromEntries(
  Object.entries(STAGE_INFO).map(([n, i]) => [Number(n), i.label])
);

// Stages that require client gate approval before the project can advance.
export const GATED_STAGES: number[] = Object.entries(STAGE_INFO)
  .filter(([, i]) => i.hasGate)
  .map(([n]) => Number(n));

// Stages with dedicated client-facing upload/feedback flows.
export const WIREFRAME_STAGE = 2; // Sketch
export const DESIGN_STAGE = 3; // Make

export function stageLabel(n: number): string {
  return STAGE_LABELS[n] ?? `Stage ${n}`;
}

export function isGatedStage(n: number): boolean {
  return GATED_STAGES.includes(n);
}
