"use client";

import { useState, useTransition } from "react";
import type { Template, Field } from "@/lib/templates/types";
import { saveDocument } from "@/app/actions/documents";
import { sendFormToClient } from "@/app/actions/onboarding";
import { getConfig, type FormConfig } from "@/lib/templates/config";
import { teamPrefill, getCollab, type FormContent } from "@/lib/forms/collab";

// Team-side "building blocks" editor for the full intake form: remove fields or
// whole sections, reorder sections, and pre-fill answers. Pre-filled answers are
// sent to the client to approve or change; empty ones the client fills.
export default function IntakeBuilder({
  documentId,
  template,
  initialContent,
}: {
  documentId: string;
  template: Template;
  initialContent: FormContent;
}) {
  const config = getConfig(initialContent);
  const defaultOrder = template.sections.map((s) => s.key);

  const [order, setOrder] = useState<string[]>(
    config.sectionOrder && config.sectionOrder.length
      ? // keep any sections not present in the saved order at the end
        [...config.sectionOrder.filter((k) => defaultOrder.includes(k)),
         ...defaultOrder.filter((k) => !(config.sectionOrder ?? []).includes(k))]
      : defaultOrder
  );
  const [removedSections, setRemovedSections] = useState<Set<string>>(
    new Set(config.removedSections ?? [])
  );
  const [removedFields, setRemovedFields] = useState<Set<string>>(
    new Set(config.removedFields ?? [])
  );
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    // Seed prefill values from any already-saved answers.
    const seed: Record<string, unknown> = {};
    for (const s of template.sections)
      for (const f of s.fields)
        if (initialContent[f.key] !== undefined) seed[f.key] = initialContent[f.key];
    return seed;
  });
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const sectionByKey = new Map(template.sections.map((s) => [s.key, s]));

  function toggleSection(key: string) {
    setRemovedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaved(false);
  }
  function toggleField(key: string) {
    setRemovedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaved(false);
  }
  function moveSection(key: string, dir: -1 | 1) {
    setOrder((prev) => {
      const i = prev.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSaved(false);
  }
  function setValue(key: string, v: unknown) {
    setValues((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  }

  function buildConfig(): FormConfig {
    return {
      sectionOrder: order,
      removedSections: [...removedSections],
      removedFields: [...removedFields],
    };
  }

  function buildContent(markPrefills: boolean): FormContent {
    let content: FormContent = { ...values, _config: buildConfig() };
    // Preserve any existing collab state.
    const existingCollab = getCollab(initialContent);
    if (Object.keys(existingCollab).length) content._collab = existingCollab;
    if (markPrefills) {
      for (const s of template.sections) {
        if (removedSections.has(s.key)) continue;
        for (const f of s.fields) {
          if (removedFields.has(f.key)) continue;
          const v = content[f.key];
          const empty =
            v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
          if (!empty) content = teamPrefill(content, f.key, v);
        }
      }
    }
    return content;
  }

  function saveDraft() {
    startTransition(async () => {
      await saveDocument(documentId, buildContent(false));
      setSaved(true);
    });
  }
  function send() {
    startTransition(async () => {
      await saveDocument(documentId, buildContent(true));
      await sendFormToClient(documentId);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        Configure the form below — untick questions to remove them, use ✕ to remove a
        whole section, and the arrows to reorder. Anything you fill in is sent to the
        client to approve or change; leave a field blank for the client to fill it in.
      </p>

      {order.map((key, idx) => {
        const section = sectionByKey.get(key);
        if (!section) return null;
        const removed = removedSections.has(key);
        return (
          <div
            key={key}
            className={`border rounded-lg bg-white ${removed ? "border-neutral-200 opacity-60" : "border-neutral-300"}`}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100">
              <p className="text-sm font-semibold text-neutral-900">{section.title}</p>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => moveSection(key, -1)} disabled={idx === 0}
                  className="w-6 h-6 rounded border border-neutral-300 text-neutral-600 disabled:opacity-30 hover:bg-neutral-50">↑</button>
                <button type="button" onClick={() => moveSection(key, 1)} disabled={idx === order.length - 1}
                  className="w-6 h-6 rounded border border-neutral-300 text-neutral-600 disabled:opacity-30 hover:bg-neutral-50">↓</button>
                <button type="button" onClick={() => toggleSection(key)}
                  className="text-xs px-2 py-1 rounded border border-neutral-300 text-neutral-600 hover:bg-neutral-50">
                  {removed ? "Restore section" : "✕ Remove section"}
                </button>
              </div>
            </div>
            {!removed && (
              <div className="px-4 py-3 space-y-4">
                {section.fields.map((field) => {
                  const included = !removedFields.has(field.key);
                  return (
                    <div key={field.key} className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={() => toggleField(field.key)}
                        className="mt-1 accent-neutral-900 w-4 h-4 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <label className="block text-sm font-medium text-neutral-800">
                          {field.label}
                          {field.showIf && (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-neutral-400">
                              {String(field.showIf.equals)} only
                            </span>
                          )}
                        </label>
                        {included && (
                          <div className="mt-1.5">
                            <PrefillInput
                              field={field}
                              value={values[field.key]}
                              onChange={(v) => setValue(field.key, v)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-1">
        <button type="button" onClick={saveDraft} disabled={isPending}
          className="px-4 py-2 rounded-md border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
          {isPending ? "Saving…" : "Save draft"}
        </button>
        <button type="button" onClick={send} disabled={isPending}
          className="px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50">
          Send intake form to client
        </button>
        {saved && !isPending && <span className="text-xs text-neutral-600">Saved</span>}
      </div>
    </div>
  );
}

// Minimal prefill input. Scalar types get a real editor; complex types (tables,
// checkbox groups, signatures) are include/remove only — the client fills them.
function PrefillInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const cls =
    "w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900";
  if (field.type === "textarea") {
    return (
      <textarea value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder} rows={field.rows ?? 3} className={`${cls} resize-y`} />
    );
  }
  if (field.type === "select" || field.type === "radio") {
    return (
      <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={`${cls} bg-white`}>
        <option value="">Leave for client…</option>
        {field.options?.filter((o) => o.value).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }
  if (field.type === "text" || field.type === "date") {
    return (
      <input type={field.type === "date" ? "date" : "text"} value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={cls} />
    );
  }
  return <p className="text-xs text-neutral-400 italic">The client will fill this in.</p>;
}
