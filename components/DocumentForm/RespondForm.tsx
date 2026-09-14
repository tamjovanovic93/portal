"use client";

import { useState, useTransition } from "react";
import type { Field } from "@/lib/templates/types";
import { isVisible } from "@/lib/templates/visibility";
import { saveDocument } from "@/app/actions/documents";
import { completeForm } from "@/app/actions/onboarding";
import { getCollab, clientApprovePrefill, clientReplace, type FormContent, type CollabMap } from "@/lib/forms/collab";
import { FieldRenderer, displayValue } from "./fields";
import type { DocumentFormProps } from "./types";

// ─── respond — client approves/changes pre-filled answers, fills the rest ────

export default function RespondForm({
  documentId,
  template,
  initialContent,
  stepped = false,
}: DocumentFormProps) {
  const [content, setContent] = useState<FormContent>(initialContent as FormContent);
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [unresolvedList, setUnresolvedList] = useState<{ key: string; label: string }[]>([]);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const collab: CollabMap = getCollab(content);

  function setValue(key: string, v: unknown) {
    setContent((prev) => ({ ...prev, [key]: v }));
  }
  function approve(key: string) {
    setContent((prev) => clientApprovePrefill(prev, key));
    setUnresolvedList((prev) => prev.filter((u) => u.key !== key));
  }
  function beginChange(key: string) {
    setEditing((prev) => new Set(prev).add(key));
    setContent((prev) => clientReplace(prev, key, prev[key] ?? ""));
    setUnresolvedList((prev) => prev.filter((u) => u.key !== key));
  }
  function replaceValue(key: string, v: unknown) {
    setContent((prev) => clientReplace(prev, key, v));
  }

  const visibleSections = template.sections.filter(
    (s) => !s.teamOnly && isVisible(s.showIf, content)
  );

  // Fields still awaiting the client's approval, in form order (with labels).
  function computeUnresolved(): { key: string; label: string }[] {
    const collabNow = getCollab(content);
    const out: { key: string; label: string }[] = [];
    for (const section of visibleSections) {
      for (const field of section.fields) {
        if (!isVisible(field.showIf, content)) continue;
        const c = collabNow[field.key];
        if (c?.prefill?.status === "pending" && !editing.has(field.key)) {
          out.push({ key: field.key, label: field.label });
        }
      }
    }
    return out;
  }

  // How many suggested answers are still pending the client's approval.
  const pendingPrefillCount = Object.entries(collab).filter(
    ([k, c]) => c.prefill?.status === "pending" && !editing.has(k)
  ).length;

  // Approve every currently-pending suggested answer in one action. Does NOT
  // submit the form — the client still reviews the rest and submits normally.
  function approveAll() {
    setContent((prev) => {
      let next = prev;
      for (const [key, c] of Object.entries(getCollab(prev))) {
        if (c.prefill?.status === "pending" && !editing.has(key)) {
          next = clientApprovePrefill(next, key);
        }
      }
      return next;
    });
    setUnresolvedList([]);
    setError(null);
  }

  // Map each field to the wizard step that contains it (stepped mode), so the
  // "needs approval" list can jump straight to the right step.
  const stepSections = visibleSections.filter((s) =>
    s.fields.some((f) => isVisible(f.showIf, content))
  );
  const fieldStep = new Map<string, number>();
  stepSections.forEach((s, i) =>
    s.fields.forEach((f) => {
      if (isVisible(f.showIf, content)) fieldStep.set(f.key, i);
    })
  );

  function goToField(key: string) {
    if (stepped && fieldStep.has(key)) setStep(fieldStep.get(key)!);
    setTimeout(() => {
      const el = document.getElementById(`field-${key}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }

  function submit() {
    const unresolved = computeUnresolved();
    if (unresolved.length > 0) {
      setUnresolvedList(unresolved);
      setError(null);
      return;
    }
    setUnresolvedList([]);
    setError(null);
    startTransition(async () => {
      await saveDocument(documentId, content);
      await completeForm(documentId);
      setSubmitted(true);
    });
  }

  // Banner offering to approve all still-pending suggested answers at once.
  const approveAllBar =
    pendingPrefillCount > 0 ? (
      <div className="flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-fill px-4 py-3">
        <p className="text-sm text-blue-900">
          Your team pre-filled{" "}
          <span className="font-semibold">
            {pendingPrefillCount} answer{pendingPrefillCount !== 1 ? "s" : ""}
          </span>{" "}
          for you to approve.
        </p>
        <button
          type="button"
          onClick={approveAll}
          className="shrink-0 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-700 transition-colors"
        >
          Approve all
        </button>
      </div>
    ) : null;

  // List of the specific questions still needing approval before submit, each
  // clickable to jump straight to it.
  const unresolvedNotice =
    unresolvedList.length > 0 ? (
      <div className="rounded-md border border-amber-300 bg-amber-fill px-4 py-3">
        <p className="text-sm font-medium text-amber-900 mb-2">
          Before finalizing, please approve the following answers:
        </p>
        <ul className="space-y-1">
          {unresolvedList.map((u) => (
            <li key={u.key}>
              <button
                type="button"
                onClick={() => goToField(u.key)}
                className="text-sm text-amber-900 underline underline-offset-2 hover:text-amber-700 text-left"
              >
                {u.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  // ── Render a single field with its collab controls ──
  function renderField(field: Field) {
    const c = collab[field.key];
    const status = c?.prefill?.status;
    const isEditing = editing.has(field.key) || status === "replaced";

    if (c?.prefill && status === "pending" && !isEditing) {
      return (
        <div key={field.key} id={`field-${field.key}`} className="scroll-mt-24 rounded-md border border-blue-200 bg-blue-50/50 px-4 py-3">
          <p className="text-sm font-medium text-ink mb-1">{field.label}</p>
          <p className="text-xs text-ink-3 mb-2">Your team suggested:</p>
          <p className="text-sm text-ink mb-3 whitespace-pre-wrap">
            {displayValue(field, content[field.key])}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => approve(field.key)}
              className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-700 transition-colors">
              Approve
            </button>
            <button type="button" onClick={() => beginChange(field.key)}
              className="px-3 py-1.5 rounded-md border border-line-2 text-xs font-medium text-ink-2 hover:bg-surface-2 transition-colors">
              Change my answer
            </button>
          </div>
        </div>
      );
    }

    if (c?.prefill && status === "approved") {
      return (
        <div key={field.key} className="rounded-md border border-green-200 bg-green-50/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink">{field.label}</p>
            <button type="button" onClick={() => beginChange(field.key)}
              className="text-xs text-ink-3 hover:text-neutral-800">
              Change
            </button>
          </div>
          <p className="text-sm text-ink mt-1 whitespace-pre-wrap">
            {displayValue(field, content[field.key])}
          </p>
          <p className="text-xs text-mint mt-1">Approved ✓</p>
        </div>
      );
    }

    const onChange = isEditing
      ? (v: unknown) => replaceValue(field.key, v)
      : (v: unknown) => setValue(field.key, v);
    return (
      <FieldRenderer key={field.key} field={field} value={content[field.key]} onChange={onChange} disabled={false} />
    );
  }

  // ── Success confirmation (after submit) ──
  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-mint-fill px-6 py-8 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h3 className="text-lg font-semibold text-green-900">
          Thank you — your intake form has been submitted.
        </h3>
        <p className="text-sm text-mint max-w-md mx-auto">
          Our team is reviewing your answers and preparing the next stage of your project.
          You&apos;ll be notified here when your Project Brief is ready for review.
        </p>
        <a href="/portal" className="inline-block mt-2 text-sm text-ink underline underline-offset-2">
          Back to portal
        </a>
      </div>
    );
  }

  // ── Stepped (guided) wizard ──
  if (stepped) {
    // Build steps from the visible sections/fields (respecting conditionals).
    type Wizard = { key: string; title: string; description?: string; fields: Field[] };
    const steps: Wizard[] = [];
    // One wizard step per section — sections are never split into parts, so
    // small sections like Brand Identity and Goals & Strategy stay together.
    for (const section of visibleSections) {
      const fields = section.fields.filter((f) => isVisible(f.showIf, content));
      if (fields.length === 0) continue;
      steps.push({
        key: section.key,
        title: section.title,
        description: section.description,
        fields,
      });
    }

    if (steps.length === 0) {
      return <p className="text-sm text-ink-3">This form has no questions to complete.</p>;
    }

    const idx = Math.min(step, steps.length - 1);
    const current = steps[idx];
    const isLast = idx === steps.length - 1;
    const pct = Math.round(((idx + 1) / steps.length) * 100);

    return (
      <div className="space-y-6">
        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-ink-2">
              Step {idx + 1} of {steps.length}
            </span>
            <span className="text-xs font-medium text-ink-2">{pct}% complete</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-neutral-200 overflow-hidden">
            <div className="h-full rounded-full bg-neutral-900 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {approveAllBar}

        <section className="border border-line rounded-lg bg-surface px-6 py-6 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-ink">{current.title}</h3>
            {current.description && (
              <p className="text-sm text-ink-3 mt-1">{current.description}</p>
            )}
          </div>
          <div className="space-y-5">{current.fields.map(renderField)}</div>
        </section>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => { setError(null); setStep(idx - 1); }}
            disabled={idx === 0 || isPending}
            className="px-4 py-2 rounded-md border border-line-2 text-sm font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-40 transition-colors"
          >
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => startTransition(async () => { await saveDocument(documentId, content); })}
              disabled={isPending}
              className="px-3 py-2 rounded-md text-sm font-medium text-ink-3 hover:text-neutral-800 disabled:opacity-50"
            >
              Save &amp; finish later
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="px-5 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Submitting…" : "Submit Intake Form"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setError(null); setStep(idx + 1); }}
                disabled={isPending}
                className="px-5 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors"
              >
                Next →
              </button>
            )}
          </div>
        </div>
        {unresolvedNotice}
        {error && <p className="text-sm text-rose">{error}</p>}
      </div>
    );
  }

  // ── Single-page (Initial Form) ──
  return (
    <div className="space-y-10">
      {approveAllBar}
      {visibleSections.map((section) => (
        <section key={section.key} className="border border-line rounded-lg bg-surface px-6 py-6 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-ink">{section.title}</h3>
            {section.description && (
              <p className="text-sm text-ink-3 mt-1">{section.description}</p>
            )}
          </div>
          <div className="space-y-5">
            {section.fields.filter((field) => isVisible(field.showIf, content)).map(renderField)}
          </div>
        </section>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => startTransition(async () => { await saveDocument(documentId, content); })}
          disabled={isPending}
          className="px-4 py-2 rounded-md border border-line-2 text-sm font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        >
          Submit
        </button>
      </div>
      {unresolvedNotice}
      {error && <p className="text-sm text-rose">{error}</p>}
    </div>
  );
}
