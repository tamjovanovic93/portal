"use client";

import { useState } from "react";
import { respondToKeyMessage, respondToSlogan } from "@/app/actions/client-approvals";

const TYPE_LABELS: Record<string, string> = {
  headline: "Headline",
  hook: "Hook",
  body: "Body copy",
  cta: "Call to action",
  caption: "Caption",
  tagline: "Tagline",
  service_slogan: "Service slogan",
  campaign: "Campaign line",
  seasonal: "Seasonal copy",
};

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
      <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
        <p className={`text-sm font-medium ${state === "approved" ? "text-green-700" : "text-neutral-500"}`}>
          {state === "approved" ? "✓ Approved — thank you." : "Noted — we'll revise and come back to you."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {type && (
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">
              {TYPE_LABELS[type] ?? type}
            </p>
          )}
          <p className="text-sm text-neutral-900 leading-relaxed">{text}</p>
          {notes && (
            <p className="text-xs text-neutral-500 mt-1">{notes}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handle("yes")}
          disabled={loading}
          className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "…" : "Approve"}
        </button>
        <button
          onClick={() => handle("no")}
          disabled={loading}
          className="px-4 py-2 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-md hover:bg-white disabled:opacity-50 transition-colors"
        >
          Request changes
        </button>
      </div>
    </div>
  );
}
