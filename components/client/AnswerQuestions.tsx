"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerQuestion, respondConfirm } from "@/app/actions/questions";

export type ClientQuestion = {
  id: string;
  kind: "ANSWER" | "CONFIRM";
  questionText: string;
  proposedAnswer: string | null;
  projectName: string;
};

export default function AnswerQuestions({ questions }: { questions: ClientQuestion[] }) {
  if (questions.length === 0) return null;
  return (
    <section>
      <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
        Questions from your team
      </h2>
      <div className="space-y-3">
        {questions.map((q) => <QuestionItem key={q.id} q={q} />)}
      </div>
    </section>
  );
}

function QuestionItem({ q }: { q: ClientQuestion }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [answer, setAnswer] = useState("");
  const [changeMode, setChangeMode] = useState(false);
  const [note, setNote] = useState("");

  function submitAnswer() {
    if (!answer.trim()) return;
    start(async () => { await answerQuestion(q.id, answer); router.refresh(); });
  }
  function confirm() {
    start(async () => { await respondConfirm(q.id, "confirm"); router.refresh(); });
  }
  function requestChange() {
    start(async () => { await respondConfirm(q.id, "change", note); setChangeMode(false); router.refresh(); });
  }

  return (
    <div className="border border-neutral-200 rounded-lg bg-white px-5 py-4">
      <p className="text-xs text-neutral-500 mb-1">{q.projectName}</p>
      <p className="text-sm text-neutral-900">{q.questionText}</p>

      {q.kind === "CONFIRM" ? (
        <div className="mt-3">
          {q.proposedAnswer && (
            <p className="text-sm text-neutral-700 mb-3">
              <span className="text-neutral-500">Proposed answer: </span>{q.proposedAnswer}
            </p>
          )}
          {!changeMode ? (
            <div className="flex items-center gap-2">
              <button onClick={confirm} disabled={pending}
                className="text-sm px-3 py-1.5 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50">Confirm</button>
              <button onClick={() => setChangeMode(true)} disabled={pending}
                className="text-sm px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-50">Request a change</button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What should change?"
                className="w-full text-sm rounded border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-900" />
              <div className="flex items-center gap-2">
                <button onClick={requestChange} disabled={pending}
                  className="text-sm px-3 py-1.5 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50">Send</button>
                <button onClick={() => setChangeMode(false)} className="text-sm px-3 py-1.5 rounded-md border border-neutral-300">Cancel</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} placeholder="Your answer…"
            className="w-full text-sm rounded border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-900" />
          <button onClick={submitAnswer} disabled={pending || !answer.trim()}
            className="text-sm px-3 py-1.5 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50">Send answer</button>
        </div>
      )}
    </div>
  );
}
