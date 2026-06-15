"use client";

import { useState } from "react";
import { advanceStage } from "@/app/actions/stages";

export default function AdvanceStageButton({
  projectId,
  currentStage,
  hasGate,
  gateApproved,
}: {
  projectId: string;
  currentStage: number;
  hasGate: boolean;
  gateApproved: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = hasGate && !gateApproved;

  async function handleAdvance() {
    setLoading(true);
    setError(null);
    const result = await advanceStage(projectId);
    if (result?.error) {
      setError(result.error);
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleAdvance}
        disabled={loading || blocked}
        title={
          blocked
            ? "Waiting for client approval at this gate"
            : `Advance to stage ${currentStage + 1}`
        }
        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
          blocked
            ? "bg-neutral-100 text-neutral-600 cursor-not-allowed"
            : "bg-neutral-900 text-white hover:bg-neutral-800"
        } disabled:opacity-50`}
      >
        {loading
          ? "…"
          : blocked
          ? "Awaiting approval"
          : `Advance →`}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
