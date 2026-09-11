"use client";

import { useState, useTransition } from "react";
import { answerQuestion } from "@/app/actions/questions";

export type OfferQuestion = {
  id: string;
  questionText: string;
  answerText: string | null;
  status: string;
};

// Team view of client questions about the offer — answer them inline.
export default function OfferQuestionsAdmin({ questions }: { questions: OfferQuestion[] }) {
  if (questions.length === 0) return null;
  return (
    <div className="border border-neutral-200 rounded-lg bg-white px-6 py-5 space-y-4">
      <p className="text-sm font-semibold text-neutral-900">Client questions about this offer</p>
      {questions.map((q) => (
        <QuestionRow key={q.id} q={q} />
      ))}
    </div>
  );
}

function QuestionRow({ q }: { q: OfferQuestion }) {
  const [answer, setAnswer] = useState(q.answerText ?? "");
  const [saved, setSaved] = useState(!!q.answerText);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-1.5">
      <p className="text-sm text-neutral-800">{q.questionText}</p>
      {saved && q.answerText ? (
        <p className="text-sm text-neutral-600">↳ {q.answerText}</p>
      ) : (
        <div className="flex items-start gap-2">
          <textarea
            value={answer}
            onChange={(e) => { setAnswer(e.target.value); setSaved(false); }}
            rows={2}
            placeholder="Reply to the client…"
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
          <button
            type="button"
            disabled={isPending || !answer.trim()}
            onClick={() =>
              startTransition(async () => {
                await answerQuestion(q.id, answer);
                setSaved(true);
              })
            }
            className="px-3 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 shrink-0"
          >
            {isPending ? "Sending…" : "Reply"}
          </button>
        </div>
      )}
    </div>
  );
}
