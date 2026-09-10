"use client";

import { useState, useTransition } from "react";
import type { Template } from "@/lib/templates/types";
import { saveDocument } from "@/app/actions/documents";
import { sendOffer } from "@/app/actions/onboarding";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  type Currency,
  type Milestone,
  newMilestoneId,
} from "@/lib/offer";

// Team-side editor for the Project / Financial Offer. Fill the fields + pricing,
// then send to the client. The client's Initial Form answers are shown alongside
// for reference while building the offer.
export default function OfferEditor({
  documentId,
  template,
  initialContent,
  initialFormAnswers = [],
}: {
  documentId: string;
  template: Template;
  initialContent: Record<string, unknown>;
  initialFormAnswers?: { label: string; value: string }[];
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initialContent);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fields = template.sections[0].fields;
  const currency = (values.currency as Currency) ?? DEFAULT_CURRENCY;
  const milestones = (Array.isArray(values.paymentSchedule) ? values.paymentSchedule : []) as Milestone[];

  function set(key: string, v: unknown) {
    setValues((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  }

  function setMilestones(next: Milestone[]) {
    set("paymentSchedule", next);
  }
  function addMilestone() {
    setMilestones([...milestones, { id: newMilestoneId(), name: "", date: null, amount: "" }]);
  }
  function updateMilestone(id: string, patch: Partial<Milestone>) {
    setMilestones(milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  function removeMilestone(id: string) {
    setMilestones(milestones.filter((m) => m.id !== id));
  }

  return (
    <div className={initialFormAnswers.length > 0 ? "grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start" : ""}>
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

        {/* Pricing */}
        <div className="border border-neutral-200 rounded-lg bg-white px-6 py-6 space-y-5">
          <p className="text-sm font-semibold text-neutral-900">Pricing</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-800 mb-1.5">Currency</label>
              <select
                value={currency}
                onChange={(e) => set("currency", e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-800 mb-1.5">Price — one time</label>
              <input
                type="text"
                value={(values.oneTimePrice as string) ?? ""}
                onChange={(e) => set("oneTimePrice", e.target.value)}
                placeholder="e.g. 5000"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-800 mb-1.5">Price — monthly</label>
              <input
                type="text"
                value={(values.monthlyPrice as string) ?? ""}
                onChange={(e) => set("monthlyPrice", e.target.value)}
                placeholder="e.g. 800"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
          </div>
        </div>

        {/* Payment schedule */}
        <div className="border border-neutral-200 rounded-lg bg-white px-6 py-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-900">Payment schedule</p>
            <button
              type="button"
              onClick={addMilestone}
              className="text-xs px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-50"
            >
              + Add milestone
            </button>
          </div>
          {milestones.length === 0 ? (
            <p className="text-xs text-neutral-500">No milestones yet.</p>
          ) : (
            <div className="space-y-3">
              {milestones.map((m, i) => (
                <div key={m.id} className="grid grid-cols-1 sm:grid-cols-[1fr_150px_120px_auto] gap-2 items-end">
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">Milestone {i + 1} — name</label>
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => updateMilestone(m.id, { name: e.target.value })}
                      placeholder="e.g. Kickoff / On delivery"
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">Date (optional)</label>
                    <input
                      type="date"
                      value={m.date ?? ""}
                      onChange={(e) => updateMilestone(m.id, { date: e.target.value || null })}
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">Amount</label>
                    <input
                      type="text"
                      value={m.amount ?? ""}
                      onChange={(e) => updateMilestone(m.id, { amount: e.target.value })}
                      placeholder="0"
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMilestone(m.id)}
                    className="px-2 py-2 text-neutral-400 hover:text-red-600"
                    aria-label="Remove milestone"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
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

      {/* Initial Form answers — reference while building the offer */}
      {initialFormAnswers.length > 0 && (
        <aside className="border border-neutral-200 rounded-lg bg-neutral-50 px-4 py-4 lg:sticky lg:top-6">
          <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-3">
            Initial form answers
          </p>
          <div className="space-y-3">
            {initialFormAnswers.map((a, i) => (
              <div key={i}>
                <p className="text-[11px] text-neutral-500">{a.label}</p>
                <p className="text-sm text-neutral-800 whitespace-pre-wrap">{a.value}</p>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
