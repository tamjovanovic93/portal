"use client";

import { useState } from "react";
import { recordApproval } from "@/app/actions/stages";

export default function ApproveButton({
  projectId,
  stageNumber,
}: {
  projectId: string;
  stageNumber: number;
}) {
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setLoading(true);
    setError(null);
    const result = await recordApproval(projectId, stageNumber, "PORTAL");
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setApproved(true);
    }
  }

  if (approved) {
    return (
      <p className="mt-3 text-sm font-medium text-green-700">
        ✓ Approved — thank you.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <button
        onClick={handleApprove}
        disabled={loading}
        className="px-4 py-2 bg-amber-900 text-white text-sm font-medium rounded-md hover:bg-amber-800 disabled:opacity-50 transition-colors"
      >
        {loading ? "Recording…" : "Approve and continue"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
