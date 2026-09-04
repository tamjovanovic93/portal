"use client";

import { useState, useTransition } from "react";
import { approveEdit, answerQuestion } from "@/app/actions/onboarding";

export type Followup = {
  fieldKey: string;
  label: string;
  kind: "edit" | "question";
  // For edits: the new value the team proposes.
  value?: string;
  // For questions: the team's question text.
  question?: string;
};

// Shown on the client's document view when the team has changed an answer
// (needs re-approval) or asked a question (needs an answer) after submission.
export default function AnswerFollowups({
  documentId,
  followups,
}: {
  documentId: string;
  followups: Followup[];
}) {
  if (followups.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-amber-900">Your team needs you</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Please respond to the items below.
        </p>
      </div>
      <div className="space-y-3">
        {followups.map((f) =>
          f.kind === "edit" ? (
            <EditRow key={f.fieldKey} documentId={documentId} followup={f} />
          ) : (
            <QuestionRow key={f.fieldKey} documentId={documentId} followup={f} />
          )
        )}
      </div>
    </div>
  );
}

function EditRow({ documentId, followup }: { documentId: string; followup: Followup }) {
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="rounded-md bg-white border border-neutral-200 px-4 py-3">
        <p className="text-sm text-neutral-700">{followup.label}</p>
        <p className="text-xs text-green-700 mt-1">Approved ✓</p>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-white border border-neutral-200 px-4 py-3">
      <p className="text-sm font-medium text-neutral-800">{followup.label}</p>
      <p className="text-xs text-neutral-500 mt-1">Your team changed this to:</p>
      <p className="text-sm text-neutral-900 mt-0.5 whitespace-pre-wrap">{followup.value || "—"}</p>
      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            await approveEdit(documentId, followup.fieldKey);
            setDone(true);
          })
        }
        disabled={isPending}
        className="mt-2 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-700 disabled:opacity-50"
      >
        {isPending ? "…" : "Approve change"}
      </button>
    </div>
  );
}

function QuestionRow({ documentId, followup }: { documentId: string; followup: Followup }) {
  const [answer, setAnswer] = useState("");
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="rounded-md bg-white border border-neutral-200 px-4 py-3">
        <p className="text-sm text-neutral-700">{followup.question}</p>
        <p className="text-xs text-green-700 mt-1">Answer sent ✓</p>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-white border border-neutral-200 px-4 py-3">
      <p className="text-xs text-neutral-500">About: {followup.label}</p>
      <p className="text-sm font-medium text-neutral-800 mt-0.5">{followup.question}</p>
      <div className="mt-2 flex gap-2">
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Your answer…"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              if (!answer.trim()) return;
              await answerQuestion(documentId, followup.fieldKey, answer.trim());
              setDone(true);
            })
          }
          disabled={isPending}
          className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
