"use client";

import { useState } from "react";
import { respondToDeliverableTask } from "@/app/actions/client-approvals";

export default function DeliverableApproval({
  taskId,
  taskName,
  description,
}: {
  taskId: string;
  taskName: string;
  description: string | null;
}) {
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<"approved" | "changes" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setLoading(true);
    setError(null);
    const res = await respondToDeliverableTask(taskId, "approve");
    if (res?.success) setDone("approved");
    else { setError("Something went wrong. Please try again."); setLoading(false); }
  }

  async function submitChanges() {
    setLoading(true);
    setError(null);
    const res = await respondToDeliverableTask(taskId, "changes", notes);
    if (res?.success) setDone("changes");
    else { setError("Something went wrong. Please try again."); setLoading(false); }
  }

  if (done === "approved") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <p className="text-sm font-medium text-green-800">✓ Approved — thank you.</p>
        <p className="text-xs text-green-700 mt-0.5">{taskName}</p>
      </div>
    );
  }
  if (done === "changes") {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
        <p className="text-sm font-medium text-neutral-600">Changes requested — we&apos;ll revise and come back to you.</p>
        <p className="text-xs text-neutral-600 mt-0.5">{taskName}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-neutral-900">{taskName}</p>
        {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
      </div>

      {mode === "idle" ? (
        <div className="flex gap-2">
          <button
            onClick={approve}
            disabled={loading}
            className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "…" : "Approve"}
          </button>
          <button
            onClick={() => setMode("changes")}
            disabled={loading}
            className="px-4 py-2 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-md hover:bg-white disabled:opacity-50 transition-colors"
          >
            Request changes
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What would you like changed?"
            rows={3}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={submitChanges}
              disabled={loading}
              className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Sending…" : "Send request"}
            </button>
            <button
              onClick={() => setMode("idle")}
              disabled={loading}
              className="px-4 py-2 text-neutral-500 text-sm hover:text-neutral-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
