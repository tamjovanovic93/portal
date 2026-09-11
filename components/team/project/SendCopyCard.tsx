"use client";

import { useState, useTransition } from "react";
import { requestClientApprovalForItem } from "@/app/actions/client-approvals";

// Generated copy stays internal until a team member explicitly sends it to the
// client for approval. This card exposes that one deliberate action — agents
// never send anything themselves.
export default function SendCopyCard({
  projectId,
  id,
  kind,
  label,
  text,
}: {
  projectId: string;
  id: string;
  kind: "message" | "slogan";
  label: string;
  text: string;
}) {
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      await requestClientApprovalForItem(projectId, id, kind);
      setSent(true);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-white border border-neutral-200 rounded-lg px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-800">
          {label} <span className="text-xs text-neutral-500 font-normal">· internal draft</span>
        </p>
        <p className="text-xs mt-0.5 truncate text-neutral-600">{text}</p>
      </div>
      <button
        type="button"
        onClick={send}
        disabled={isPending || sent}
        className="shrink-0 text-xs px-3 py-1.5 rounded-md bg-neutral-900 text-white font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors"
      >
        {sent ? "Sent ✓" : isPending ? "Sending…" : "Send to client for approval"}
      </button>
    </div>
  );
}
