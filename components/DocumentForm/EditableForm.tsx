"use client";

import { useState, useTransition } from "react";
import { isVisible } from "@/lib/templates/visibility";
import { saveDocument, submitDocument } from "@/app/actions/documents";
import { sendFormToClient } from "@/app/actions/onboarding";
import { teamPrefill, type FormContent } from "@/lib/forms/collab";
import { SectionRenderer } from "./fields";
import type { DocumentFormProps } from "./types";

// ─── fill / prefill — a plain editable form ─────────────────────────────────

export default function EditableForm({
  documentId,
  template,
  initialContent,
  readOnly = false,
  isTeam = false,
  mode = "fill",
}: DocumentFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialContent);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleChangeField(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    startTransition(async () => {
      await saveDocument(documentId, values);
      setSaved(true);
    });
  }

  async function handleSubmit() {
    startTransition(async () => {
      await saveDocument(documentId, values);
      await submitDocument(documentId);
    });
  }

  // Prefill mode: mark every answered field as a pending prefill, then send.
  async function handleSend() {
    let content = { ...values } as FormContent;
    for (const section of template.sections) {
      for (const field of section.fields) {
        const v = content[field.key];
        const empty =
          v === undefined ||
          v === null ||
          v === "" ||
          (Array.isArray(v) && v.length === 0);
        if (!empty) content = teamPrefill(content, field.key, v);
      }
    }
    startTransition(async () => {
      await saveDocument(documentId, content);
      await sendFormToClient(documentId);
    });
  }

  const visibleSections = template.sections.filter(
    (s) => (!s.teamOnly || isTeam) && isVisible(s.showIf, values)
  );

  return (
    <div className="space-y-10">
      {visibleSections.map((section) => (
        <section
          key={section.key}
          className="border border-neutral-200 rounded-lg bg-white px-6 py-6"
        >
          <SectionRenderer
            section={section}
            values={values}
            onChangeField={handleChangeField}
            disabled={readOnly}
          />
        </section>
      ))}

      {!readOnly && (
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="px-4 py-2 rounded-md border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Saving…" : "Save draft"}
          </button>
          {mode === "prefill" ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending}
              className="px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Sending…" : "Send to client"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors"
            >
              {isTeam ? "Save & mark complete" : "Submit"}
            </button>
          )}
          {saved && !isPending && (
            <span className="text-xs text-neutral-600">Saved</span>
          )}
        </div>
      )}
      {mode === "prefill" && (
        <p className="text-xs text-neutral-500">
          Answers you fill in will be sent to the client to approve or change.
          Leave a field empty for the client to fill it in themselves.
        </p>
      )}
    </div>
  );
}
