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
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";

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
        <div className="border border-line rounded-lg bg-surface px-6 py-6 space-y-5">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-ink mb-1.5">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {field.type === "textarea" ? (
                <Textarea resize="y"
                  value={(values[field.key] as string) ?? ""}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={field.rows ?? 3}
                 
                />
              ) : (
                <Input
                  type="text"
                  value={(values[field.key] as string) ?? ""}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder}
                 
                />
              )}
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div className="border border-line rounded-lg bg-surface px-6 py-6 space-y-5">
          <p className="text-sm font-semibold text-ink">Pricing</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Currency</label>
              <Select
                value={currency}
                onChange={(e) => set("currency", e.target.value)}
               
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Price — one time</label>
              <Input
                type="text"
                value={(values.oneTimePrice as string) ?? ""}
                onChange={(e) => set("oneTimePrice", e.target.value)}
                placeholder="e.g. 5000"
               
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Price — monthly</label>
              <Input
                type="text"
                value={(values.monthlyPrice as string) ?? ""}
                onChange={(e) => set("monthlyPrice", e.target.value)}
                placeholder="e.g. 800"
               
              />
            </div>
          </div>
        </div>

        {/* Payment schedule */}
        <div className="border border-line rounded-lg bg-surface px-6 py-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Payment schedule</p>
            <button
              type="button"
              onClick={addMilestone}
              className="text-xs px-3 py-1.5 rounded-md border border-line-2 hover:bg-surface-2"
            >
              + Add milestone
            </button>
          </div>
          {milestones.length === 0 ? (
            <p className="text-xs text-ink-3">No milestones yet.</p>
          ) : (
            <div className="space-y-3">
              {milestones.map((m, i) => (
                <div key={m.id} className="grid grid-cols-1 sm:grid-cols-[1fr_150px_120px_auto] gap-2 items-end">
                  <div>
                    <label className="block text-[11px] text-ink-3 mb-1">Milestone {i + 1} — name</label>
                    <Input
                      type="text"
                      value={m.name}
                      onChange={(e) => updateMilestone(m.id, { name: e.target.value })}
                      placeholder="e.g. Kickoff / On delivery"
                     
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-ink-3 mb-1">Date (optional)</label>
                    <Input
                      type="date"
                      value={m.date ?? ""}
                      onChange={(e) => updateMilestone(m.id, { date: e.target.value || null })}
                     
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-ink-3 mb-1">Amount</label>
                    <Input
                      type="text"
                      value={m.amount ?? ""}
                      onChange={(e) => updateMilestone(m.id, { amount: e.target.value })}
                      placeholder="0"
                     
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMilestone(m.id)}
                    className="px-2 py-2 text-ink-4 hover:text-red-600"
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
          <Button variant="outline"
            type="button"
            onClick={() =>
              startTransition(async () => {
                await saveDocument(documentId, values);
                setSaved(true);
              })
            }
            disabled={isPending}
           
          >
            {isPending ? "Saving…" : "Save draft"}
          </Button>
          <Button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await saveDocument(documentId, values);
                await sendOffer(documentId);
              })
            }
            disabled={isPending}
           
          >
            Send offer to client
          </Button>
          {saved && !isPending && <span className="text-xs text-ink-2">Saved</span>}
        </div>
      </div>

      {/* Initial Form answers — reference while building the offer */}
      {initialFormAnswers.length > 0 && (
        <aside className="border border-line rounded-lg bg-page px-4 py-4 lg:sticky lg:top-6">
          <p className="text-xs font-semibold text-ink-2 uppercase tracking-wider mb-3">
            Initial form answers
          </p>
          <div className="space-y-3">
            {initialFormAnswers.map((a, i) => (
              <div key={i}>
                <p className="text-[11px] text-ink-3">{a.label}</p>
                <p className="text-sm text-ink whitespace-pre-wrap">{a.value}</p>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
