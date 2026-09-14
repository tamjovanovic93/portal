"use client";

import { useState } from "react";
import { respondToDeliverableTask } from "@/app/actions/client-approvals";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";

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
      <div className="rounded-lg border border-green-200 bg-mint-fill px-4 py-3">
        <p className="text-sm font-medium text-mint">✓ Approved — thank you.</p>
        <p className="text-xs text-mint mt-0.5">{taskName}</p>
      </div>
    );
  }
  if (done === "changes") {
    return (
      <div className="rounded-lg border border-line bg-surface px-4 py-3">
        <p className="text-sm font-medium text-ink-2">Changes requested — we&apos;ll revise and come back to you.</p>
        <p className="text-xs text-ink-2 mt-0.5">{taskName}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-fill px-4 py-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-ink">{taskName}</p>
        {description && <p className="text-xs text-ink-3 mt-0.5">{description}</p>}
      </div>

      {mode === "idle" ? (
        <div className="flex gap-2">
          <Button
            onClick={approve}
            disabled={loading}
           
          >
            {loading ? "…" : "Approve"}
          </Button>
          <Button variant="outline"
            onClick={() => setMode("changes")}
            disabled={loading}
           
          >
            Request changes
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea resize="none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What would you like changed?"
            rows={3}
           
          />
          <div className="flex gap-2">
            <Button
              onClick={submitChanges}
              disabled={loading}
             
            >
              {loading ? "Sending…" : "Send request"}
            </Button>
            <Button variant="quiet" size="lg"
              onClick={() => setMode("idle")}
              disabled={loading}
             
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose">{error}</p>}
    </div>
  );
}
