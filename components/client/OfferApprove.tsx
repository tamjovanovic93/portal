"use client";

import { useState, useTransition } from "react";
import { approveOffer, askAboutOffer } from "@/app/actions/onboarding";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";

export type OfferQA = {
  id: string;
  questionText: string;
  answerText: string | null;
};

export default function OfferApprove({
  documentId,
  questions = [],
  approved = false,
}: {
  documentId: string;
  questions?: OfferQA[];
  approved?: boolean;
}) {
  const [done, setDone] = useState(approved);
  const [asking, setAsking] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function accept() {
    startTransition(async () => {
      await approveOffer(documentId);
      setDone(true);
    });
  }

  function submitQuestion() {
    if (!text.trim()) return;
    startTransition(async () => {
      await askAboutOffer(documentId, text);
      setText("");
      setAsking(false);
      setSent(true);
    });
  }

  return (
    <div className="space-y-4">
      {/* Prior Q&A about the offer */}
      {questions.length > 0 && (
        <div className="rounded-lg border border-line bg-surface px-5 py-4 space-y-3">
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider">Your questions</p>
          {questions.map((q) => (
            <div key={q.id}>
              <p className="text-sm text-ink">{q.questionText}</p>
              {q.answerText ? (
                <p className="text-sm text-ink-2 mt-0.5">↳ {q.answerText}</p>
              ) : (
                <p className="text-xs text-amber mt-0.5">Waiting for your team to reply…</p>
              )}
            </div>
          ))}
        </div>
      )}

      {done ? (
        <div className="rounded-lg border border-green-200 bg-mint-fill px-5 py-4">
          <p className="text-sm font-medium text-green-900">Offer accepted ✓</p>
          <p className="text-xs text-mint mt-0.5">
            Thanks — your team has been notified and will continue with the next step.
          </p>
          {sent && <p className="text-xs text-mint mt-2">Your question was sent — we&apos;ll get back to you.</p>}
          {asking ? (
            <div className="mt-3 space-y-2">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="Your question about the offer…"
               
              />
              <div className="flex items-center gap-2">
                <Button size="md" type="button" onClick={submitQuestion} disabled={isPending || !text.trim()}>
                  {isPending ? "Sending…" : "Send question"}
                </Button>
                <Button variant="quiet" size="md" type="button" onClick={() => { setAsking(false); setText(""); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAsking(true)} className="mt-3 text-sm text-ink-2 underline underline-offset-2 hover:text-ink">
              Additional questions
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-300 bg-amber-fill px-5 py-4">
          <p className="text-sm font-medium text-amber-900">
            Review the offer above. Accept it to continue, or send us any additional questions.
          </p>

          {sent && (
            <p className="text-xs text-mint mt-2">Your question was sent — we&apos;ll get back to you.</p>
          )}

          {asking ? (
            <div className="mt-3 space-y-2">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="Your question about the offer…"
               
              />
              <div className="flex items-center gap-2">
                <Button size="md"
                  type="button"
                  onClick={submitQuestion}
                  disabled={isPending || !text.trim()}
                 
                >
                  {isPending ? "Sending…" : "Send question"}
                </Button>
                <Button variant="quiet" size="md"
                  type="button"
                  onClick={() => { setAsking(false); setText(""); }}
                 
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-3">
              <Button
                type="button"
                onClick={accept}
                disabled={isPending}
               
              >
                {isPending ? "Working…" : "Accept offer"}
              </Button>
              <Button variant="outline"
                type="button"
                onClick={() => setAsking(true)}
                disabled={isPending}
               
              >
                Additional questions
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
