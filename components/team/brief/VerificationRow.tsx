"use client";

import { useState, useTransition } from "react";
import { resolveVerificationItem } from "@/app/actions/brief";

type Status = "pending" | "confirmed" | "rejected";

export default function VerificationRow({
  projectId,
  itemId,
  fieldPath,
  currentValue,
  question,
  source,
  status,
  resolvedValue,
}: {
  projectId: string;
  itemId: string;
  fieldPath: string;
  currentValue: string;
  question: string;
  source: string;
  status: Status;
  resolvedValue: string;
}) {
  const [current, setCurrent] = useState<Status>(status);
  const [answer, setAnswer] = useState(resolvedValue || currentValue || "");
  const [isPending, startTransition] = useTransition();

  function resolve(next: Status) {
    setCurrent(next);
    startTransition(async () => {
      await resolveVerificationItem(projectId, itemId, next, next === "confirmed" ? answer : undefined);
    });
  }

  const pillColor =
    current === "confirmed" ? "pill-mint" : current === "rejected" ? "pill-rose" : "pill-amber";

  return (
    <div className="card card-pad space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <code className="mono" style={{ fontSize: 11.5, background: "var(--surface-2)", color: "var(--text-2)", padding: "2px 7px", borderRadius: "var(--r-sm)" }}>
          {fieldPath || "—"}
        </code>
        {source && <span className="faint" style={{ fontSize: 11 }}>{source}</span>}
        <span className={`pill ${pillColor}`}>{current}</span>
      </div>

      <p style={{ fontSize: 13.5 }}>{question || "—"}</p>
      <p className="faint" style={{ fontSize: 12 }}>
        Current value: <span style={{ color: "var(--text-2)" }}>{currentValue || "—"}</span>
      </p>

      <div>
        <label className="zp-label">Your answer</label>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={2}
          placeholder="Type the confirmed value or answer…"
          className="zp-textarea"
        />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => resolve("confirmed")} disabled={isPending} className="btn btn-sm btn-primary">
          {isPending ? "Saving…" : "Confirm with this answer"}
        </button>
        <button onClick={() => resolve("rejected")} disabled={isPending} className="btn btn-sm">Reject</button>
        {current !== "pending" && (
          <button onClick={() => resolve("pending")} disabled={isPending} className="btn btn-sm btn-ghost">Reset</button>
        )}
      </div>
    </div>
  );
}
