"use client";

import { useState, useTransition } from "react";
import type { Field } from "@/lib/templates/types";
import { isVisible } from "@/lib/templates/visibility";
import { changeAnswer, askQuestion } from "@/app/actions/onboarding";
import { getCollab, type FormContent, type CollabMap } from "@/lib/forms/collab";
import { displayValue } from "./fields";
import type { DocumentFormProps } from "./types";

// ─── review — team reviews a completed form (change / ask a question) ────────

export default function ReviewForm({ documentId, template, initialContent }: DocumentFormProps) {
  const content = initialContent as FormContent;
  const collab = getCollab(content);
  const visibleSections = template.sections.filter((s) =>
    isVisible(s.showIf, content)
  );

  return (
    <div className="space-y-10">
      {visibleSections.map((section) => (
        <section
          key={section.key}
          className="border border-line rounded-lg bg-surface px-6 py-6 space-y-5"
        >
          <h3 className="text-base font-semibold text-ink">{section.title}</h3>
          <div className="divide-y divide-line">
            {section.fields
              .filter((field) => isVisible(field.showIf, content))
              .map((field) => (
                <ReviewField
                  key={field.key}
                  documentId={documentId}
                  field={field}
                  value={content[field.key]}
                  collab={collab[field.key]}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ReviewField({
  documentId,
  field,
  value,
  collab,
}: {
  documentId: string;
  field: Field;
  value: unknown;
  collab: CollabMap[string] | undefined;
}) {
  const [open, setOpen] = useState<null | "edit" | "ask">(null);
  const [editValue, setEditValue] = useState(typeof value === "string" ? value : "");
  const [question, setQuestion] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitEdit() {
    startTransition(async () => {
      await changeAnswer(documentId, field.key, editValue);
      setOpen(null);
      setDone("Change sent — awaiting client approval.");
    });
  }
  function submitAsk() {
    if (!question.trim()) return;
    startTransition(async () => {
      await askQuestion(documentId, field.key, question.trim());
      setOpen(null);
      setQuestion("");
      setDone("Question sent to the client.");
    });
  }

  const edit = collab?.edit;
  const q = collab?.question;

  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{field.label}</p>
          <p className="text-sm text-ink mt-0.5 whitespace-pre-wrap">
            {displayValue(field, value)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setOpen(open === "edit" ? null : "edit")}
            className="text-xs px-2.5 py-1 rounded border border-line-2 text-ink-2 hover:bg-surface-2"
          >
            Change
          </button>
          <button
            type="button"
            onClick={() => setOpen(open === "ask" ? null : "ask")}
            className="text-xs px-2.5 py-1 rounded border border-line-2 text-ink-2 hover:bg-surface-2"
          >
            Ask a question
          </button>
        </div>
      </div>

      {/* Existing collab status */}
      {edit && (
        <p className="text-xs mt-1.5 text-amber">
          {edit.status === "pending"
            ? "Your change is awaiting client approval."
            : "Client approved your change ✓"}
        </p>
      )}
      {q && (
        <p className="text-xs mt-1.5 text-ink-2">
          <span className="font-medium">Q:</span> {q.text}
          {q.status === "answered" ? (
            <>
              {" "}
              <span className="font-medium text-ink">A:</span> {q.answer}
            </>
          ) : (
            <span className="text-amber"> — awaiting client answer</span>
          )}
        </p>
      )}

      {open === "edit" && (
        <div className="mt-2 flex gap-2">
          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 rounded-md border border-line-2 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="New answer…"
          />
          <button
            type="button"
            onClick={submitEdit}
            disabled={isPending}
            className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-medium disabled:opacity-50"
          >
            Send change
          </button>
        </div>
      )}
      {open === "ask" && (
        <div className="mt-2 flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="flex-1 rounded-md border border-line-2 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="Ask the client about this answer…"
          />
          <button
            type="button"
            onClick={submitAsk}
            disabled={isPending}
            className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-medium disabled:opacity-50"
          >
            Send question
          </button>
        </div>
      )}
      {done && <p className="text-xs text-mint mt-1.5">{done}</p>}
    </div>
  );
}
