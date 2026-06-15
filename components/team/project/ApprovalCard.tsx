"use client";

import { useState } from "react";
import { acknowledgeApprovalItem } from "@/app/actions/client-approvals";

type Variant = "pending" | "approved" | "revise";

const STYLES: Record<Variant, { bg: string; border: string; title: string; badge: string; badgeText: string }> = {
  pending: {
    bg: "bg-blue-50", border: "border-blue-200",
    title: "text-blue-900", badge: "bg-blue-200", badgeText: "text-blue-800",
  },
  approved: {
    bg: "bg-green-50", border: "border-green-200",
    title: "text-green-900", badge: "bg-green-200", badgeText: "text-green-800",
  },
  revise: {
    bg: "bg-amber-50", border: "border-amber-200",
    title: "text-amber-900", badge: "bg-amber-200", badgeText: "text-amber-800",
  },
};

const BADGE_LABELS: Record<Variant, string> = {
  pending: "Pending",
  approved: "Approved ✓",
  revise: "Revise",
};

export default function ApprovalCard({
  projectId,
  id,
  kind,
  variant,
  headline,
  text,
}: {
  projectId: string;
  id: string;
  kind: "message" | "slogan";
  variant: Variant;
  headline: string;
  text: string;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  async function handleClick() {
    setDismissed(true);
    await acknowledgeApprovalItem(projectId, id, kind);
  }

  const s = STYLES[variant];

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left flex items-center justify-between ${s.bg} border ${s.border} rounded-lg px-4 py-3 hover:opacity-80 transition-opacity cursor-pointer`}
      title="Click to dismiss"
    >
      <div className="min-w-0 flex-1 mr-3">
        <p className={`text-sm font-medium ${s.title}`}>{headline}</p>
        <p className={`text-xs mt-0.5 truncate ${s.title} opacity-75`}>{text}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${s.badge} ${s.badgeText}`}>
        {BADGE_LABELS[variant]}
      </span>
    </button>
  );
}
