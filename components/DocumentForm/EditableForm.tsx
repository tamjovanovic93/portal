"use client";

import { useState, useTransition } from "react";
import { isVisible } from "@/lib/templates/visibility";
import { saveDocument, submitDocument } from "@/app/actions/documents";
import { sendFormToClient } from "@/app/actions/onboarding";
import { teamPrefill, type FormContent } from "@/lib/forms/collab";
import { SectionRenderer } from "./fields";
import type { DocumentFormProps } from "./types";
import Button from "@/components/ui/Button";

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
          className="border border-line rounded-lg bg-surface px-6 py-6"
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
          <Button variant="outline"
            type="button"
            onClick={handleSave}
            disabled={isPending}
           
          >
            {isPending ? "Saving…" : "Save draft"}
          </Button>
          {mode === "prefill" ? (
            <Button
              type="button"
              onClick={handleSend}
              disabled={isPending}
             
            >
              {isPending ? "Sending…" : "Send to client"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
             
            >
              {isTeam ? "Save & mark complete" : "Submit"}
            </Button>
          )}
          {saved && !isPending && (
            <span className="text-xs text-ink-2">Saved</span>
          )}
        </div>
      )}
      {mode === "prefill" && (
        <p className="text-xs text-ink-3">
          Answers you fill in will be sent to the client to approve or change.
          Leave a field empty for the client to fill it in themselves.
        </p>
      )}
    </div>
  );
}
