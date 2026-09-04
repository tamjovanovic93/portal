"use client";

import { useState, useTransition } from "react";
import type { Template } from "@/lib/templates/types";
import { saveDocument } from "@/app/actions/documents";
import { sendOffer } from "@/app/actions/onboarding";

// Team-side editor for the Project / Financial Offer. Fill the fields, then send
// to the client (which notifies them and awaits approval).
export default function OfferEditor({
  documentId,
  template,
  initialContent,
}: {
  documentId: string;
  template: Template;
  initialContent: Record<string, unknown>;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initialContent);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fields = template.sections[0].fields;

  function set(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  }

  return (
    <div className="space-y-6">
      <div className="border border-neutral-200 rounded-lg bg-white px-6 py-6 space-y-5">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-neutral-800 mb-1.5">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {field.type === "textarea" ? (
              <textarea
                value={(values[field.key] as string) ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={field.rows ?? 3}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-y"
              />
            ) : (
              <input
                type="text"
                value={(values[field.key] as string) ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              await saveDocument(documentId, values);
              setSaved(true);
            })
          }
          disabled={isPending}
          className="px-4 py-2 rounded-md border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              await saveDocument(documentId, values);
              await sendOffer(documentId);
            })
          }
          disabled={isPending}
          className="px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50"
        >
          Send offer to client
        </button>
        {saved && !isPending && <span className="text-xs text-neutral-600">Saved</span>}
      </div>
    </div>
  );
}
