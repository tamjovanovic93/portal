"use client";

import { useState } from "react";
import { respondToKeyMessage, respondToSlogan } from "@/app/actions/client-approvals";
import { MESSAGE_TYPE_LABELS } from "@/lib/constants/approvals";
import Button from "@/components/ui/Button";

export default function BriefApprovalItem({
  projectId,
  id,
  kind,
  text,
  type,
  notes,
}: {
  projectId: string;
  id: string;
  kind: "message" | "slogan";
  text: string;
  type: string | null;
  notes: string | null;
}) {
  const [state, setState] = useState<"pending" | "approved" | "rejected">("pending");
  const [loading, setLoading] = useState(false);

  async function handle(decision: "yes" | "no") {
    setLoading(true);
    if (kind === "message") {
      await respondToKeyMessage(projectId, id, decision);
    } else {
      await respondToSlogan(projectId, id, decision);
    }
    setState(decision === "yes" ? "approved" : "rejected");
    setLoading(false);
  }

  if (state !== "pending") {
    return (
      <div className="rounded-lg border border-line bg-surface px-4 py-3">
        <p className={`text-sm font-medium ${state === "approved" ? "text-mint" : "text-ink-3"}`}>
          {state === "approved" ? "✓ Approved — thank you." : "Noted — we'll revise and come back to you."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-fill px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {type && (
            <p className="text-xs font-medium text-amber uppercase tracking-wide mb-1">
              {MESSAGE_TYPE_LABELS[type] ?? type}
            </p>
          )}
          <p className="text-sm text-ink leading-relaxed">{text}</p>
          {notes && (
            <p className="text-xs text-ink-3 mt-1">{notes}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => handle("yes")}
          disabled={loading}
         
        >
          {loading ? "…" : "Approve"}
        </Button>
        <Button variant="outline"
          onClick={() => handle("no")}
          disabled={loading}
         
        >
          Request changes
        </Button>
      </div>
    </div>
  );
}
