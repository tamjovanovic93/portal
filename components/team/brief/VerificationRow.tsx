"use client";

import { useState, useTransition } from "react";
import { resolveVerificationItem, sendVerificationToClient } from "@/app/actions/brief";

type Status = "pending" | "confirmed" | "rejected";

export default function VerificationRow({
  clientId,
  itemId,
  currentValue,
  question,
  status,
  resolvedValue,
  sentToClientAt = null,
  clientAnswer = null,
  clientAnsweredAt = null,
  dateResolved = null,
}: {
  clientId: string;
  itemId: string;
  fieldPath?: string;
  currentValue: string;
  question: string;
  source?: string;
  status: Status;
  resolvedValue: string;
  sentToClientAt?: string | null;
  clientAnswer?: string | null;
  clientAnsweredAt?: string | null;
  dateResolved?: string | null;
}) {
  const [current, setCurrent] = useState<Status>(status);
  const [answer, setAnswer] = useState(resolvedValue || clientAnswer || currentValue || "");
  const [sent, setSent] = useState<boolean>(!!sentToClientAt);
  const [isPending, startTransition] = useTransition();

  function resolve(next: Status) {
    setCurrent(next);
    startTransition(async () => {
      await resolveVerificationItem(clientId, itemId, next, next === "confirmed" ? answer : undefined);
    });
  }

  function send() {
    setSent(true);
    startTransition(async () => {
      await sendVerificationToClient(clientId, itemId);
    });
  }

  const pillColor =
    current === "confirmed" ? "pill-mint" : current === "rejected" ? "pill-rose" : "pill-amber";

  // Never expose internal/agent wording to the admin. Hide values that are
  // clearly template placeholders or internal markers (legacy data), and the
  // raw field path / source-document names entirely.
  const cleanCurrent = (currentValue || "")
    .replace(/^\s*\*?\[?UNVERIFIED\]?\s*/i, "")
    .trim();
  const looksInternal = /^(synthesized|inferred|current value|scale points|unverified)\b/i.test(cleanCurrent) || cleanCurrent.includes("|");
  const showCurrent = cleanCurrent && !looksInternal;
  const statusLabel = current === "confirmed" ? "verified" : current === "rejected" ? "not correct" : "needs review";

  return (
    <div className="card card-pad space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`pill ${pillColor}`}>{statusLabel}</span>
        {clientAnswer ? (
          <span className="pill pill-mint">client answered</span>
        ) : sent ? (
          <span className="pill pill-blue">sent — waiting on client</span>
        ) : null}
      </div>

      <p style={{ fontSize: 13.5 }}>{question || "Please review this detail and confirm it's correct."}</p>
      {showCurrent && (
        <p className="faint" style={{ fontSize: 12 }}>
          Currently on file: <span style={{ color: "var(--text-2)" }}>{cleanCurrent}</span>
        </p>
      )}

      {clientAnswer && (
        <p style={{ fontSize: 12.5 }}>
          Client answered: <span style={{ color: "var(--text-1)" }}>{clientAnswer}</span>
          {clientAnsweredAt && (
            <span className="faint" style={{ fontSize: 11, marginLeft: 6 }}>
              {new Date(clientAnsweredAt).toLocaleDateString()}
            </span>
          )}
        </p>
      )}

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

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => resolve("confirmed")} disabled={isPending} className="btn btn-sm btn-primary">
          {isPending ? "Saving…" : "Confirm with this answer"}
        </button>
        <button onClick={() => resolve("rejected")} disabled={isPending} className="btn btn-sm">Reject</button>
        {current === "pending" && !sent && (
          <button onClick={send} disabled={isPending} className="btn btn-sm btn-ghost">
            Send to client for verification
          </button>
        )}
        {current !== "pending" && (
          <button onClick={() => resolve("pending")} disabled={isPending} className="btn btn-sm btn-ghost">Reset</button>
        )}
        {dateResolved && current !== "pending" && (
          <span className="faint" style={{ fontSize: 11, marginLeft: "auto" }}>
            Resolved {new Date(dateResolved).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
