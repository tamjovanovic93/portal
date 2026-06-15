"use client";

import { useState } from "react";
import { updateRevisionStatus } from "@/app/actions/design";

type Revision = { pageScreen: string; whatToChange: string };

const STATUS_OPTIONS = [
  { value: "", label: "Mark as…" },
  { value: "seen", label: "Seen" },
  { value: "in_progress", label: "Working on it" },
  { value: "done", label: "Done" },
  { value: "wont_fix", label: "Won't change" },
] as const;

// Static class strings so Tailwind always includes them
function selectClass(status: string) {
  if (status === "seen") return "border-blue-300 bg-blue-50 text-blue-700";
  if (status === "in_progress") return "border-amber-300 bg-amber-50 text-amber-700";
  if (status === "done") return "border-green-300 bg-green-50 text-green-700";
  if (status === "wont_fix") return "border-neutral-300 bg-neutral-100 text-neutral-500";
  return "border-neutral-300 bg-white text-neutral-500";
}

export default function RevisionTracker({
  documentId,
  revisions,
  initialStatuses,
}: {
  documentId: string;
  revisions: Revision[];
  initialStatuses: Record<string, string>;
}) {
  const [statuses, setStatuses] = useState<Record<string, string>>(initialStatuses);
  const [saving, setSaving] = useState<string | null>(null);

  const activeRevisions = revisions
    .map((r, i) => ({ ...r, i }))
    .filter(({ i, whatToChange }) => whatToChange && statuses[i] !== "done" && statuses[i] !== "wont_fix");

  const resolvedRevisions = revisions
    .map((r, i) => ({ ...r, i }))
    .filter(({ i, whatToChange }) => whatToChange && (statuses[i] === "done" || statuses[i] === "wont_fix"));

  async function handleChange(index: number, status: string) {
    setSaving(String(index));
    setStatuses((prev) => ({ ...prev, [String(index)]: status }));
    await updateRevisionStatus(documentId, String(index), status);
    setSaving(null);
  }

  function StatusSelect({ index, status }: { index: number; status: string }) {
    return (
      <select
        value={status}
        onChange={(e) => handleChange(index, e.target.value)}
        disabled={saving === String(index)}
        className={`shrink-0 text-xs border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer disabled:opacity-50 transition-colors ${selectClass(status)}`}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active revisions */}
      {activeRevisions.length > 0 ? (
        <div className="space-y-2">
          {activeRevisions.map(({ i, pageScreen, whatToChange }) => (
            <div
              key={i}
              className="flex items-start gap-4 bg-white border border-neutral-200 rounded-lg px-5 py-4"
            >
              <div className="flex-1 min-w-0">
                {pageScreen && (
                  <p className="text-xs text-neutral-600 mb-0.5">{pageScreen}</p>
                )}
                <p className="text-sm text-neutral-900">{whatToChange}</p>
              </div>
              <StatusSelect index={i} status={statuses[i] ?? ""} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-600">All revisions resolved.</p>
      )}

      {/* Resolved revisions */}
      {resolvedRevisions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide mb-2">
            Resolved — {resolvedRevisions.length}
          </p>
          <div className="space-y-1.5">
            {resolvedRevisions.map(({ i, pageScreen, whatToChange }) => (
              <div
                key={i}
                className="flex items-center gap-4 bg-neutral-50 border border-neutral-100 rounded-lg px-5 py-3"
              >
                <div className="flex-1 min-w-0">
                  {pageScreen && (
                    <span className="text-xs text-neutral-600 mr-2">{pageScreen}</span>
                  )}
                  <span className="text-sm text-neutral-600 line-through">{whatToChange}</span>
                </div>
                <StatusSelect index={i} status={statuses[i] ?? ""} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
