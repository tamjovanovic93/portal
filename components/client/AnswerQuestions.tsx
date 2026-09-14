"use client";

import { useState, useTransition } from "react";
import { answerQuestion, respondConfirm } from "@/app/actions/questions";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";

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
      <h2 className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3">
        Questions from your team
      </h2>
      <div className="space-y-3">
        {questions.map((q) => <QuestionItem key={q.id} q={q} />)}
      </div>
    </section>
  );
}

function QuestionItem({ q }: { q: ClientQuestion }) {
  const [pending, start] = useTransition();
  const [answer, setAnswer] = useState("");
  const [changeMode, setChangeMode] = useState(false);
  const [note, setNote] = useState("");

  function submitAnswer() {
    if (!answer.trim()) return;
    start(async () => { await answerQuestion(q.id, answer); });
  }
  function confirm() {
    start(async () => { await respondConfirm(q.id, "confirm"); });
  }
  function requestChange() {
    start(async () => { await respondConfirm(q.id, "change", note); setChangeMode(false); });
  }

  return (
    <div className="border border-line rounded-lg bg-surface px-5 py-4">
      <p className="text-xs text-ink-3 mb-1">{q.projectName}</p>
      <p className="text-sm text-ink">{q.questionText}</p>

      {q.kind === "CONFIRM" ? (
        <div className="mt-3">
          {q.proposedAnswer && (
            <p className="text-sm text-ink-2 mb-3">
              <span className="text-ink-3">Proposed answer: </span>{q.proposedAnswer}
            </p>
          )}
          {!changeMode ? (
            <div className="flex items-center gap-2">
              <Button size="md" onClick={confirm} disabled={pending}
               >Confirm</Button>
              <Button variant="outline" size="md" onClick={() => setChangeMode(true)} disabled={pending}
               >Request a change</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What should change?"
                />
              <div className="flex items-center gap-2">
                <Button size="md" onClick={requestChange} disabled={pending}
                 >Send</Button>
                <Button variant="outline" size="md" onClick={() => setChangeMode(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} placeholder="Your answer…"
            />
          <Button size="md" onClick={submitAnswer} disabled={pending || !answer.trim()}
           >Send answer</Button>
        </div>
      )}
    </div>
  );
}
