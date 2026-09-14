"use client";

import { useState } from "react";
import {
  saveWireframeFeedback,
  submitWireframeFeedback,
  approveWireframesAndSubmit,
} from "@/app/actions/wireframes";
import { labelFromFilename } from "@/lib/format";
import Button from "@/components/ui/Button";

type Asset = { id: string; filename: string; mimeType: string | null; previewUrl?: string | null };
type Reaction = "happy" | "tweaks" | "rethink" | "";
type PageFeedback = { reaction: Reaction; comment: string };
type Content = {
  overall: string;
  pages: Record<string, PageFeedback>;
  finalNotes: string;
};

const REACTIONS: {
  value: Reaction;
  label: string;
  active: string;
  inactive: string;
}[] = [
  {
    value: "happy",
    label: "Happy with this",
    active: "bg-green-600 border-green-600 text-white",
    inactive:
      "border-line-2 text-ink-2 hover:border-green-500 hover:text-green-700 hover:bg-green-50",
  },
  {
    value: "tweaks",
    label: "Minor tweaks",
    active: "bg-amber-500 border-amber-500 text-white",
    inactive:
      "border-line-2 text-ink-2 hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50",
  },
  {
    value: "rethink",
    label: "Needs rethinking",
    active: "bg-red-600 border-red-600 text-white",
    inactive:
      "border-line-2 text-ink-2 hover:border-red-400 hover:text-red-700 hover:bg-red-50",
  },
];

function FilePreview({ asset, label }: { asset: Asset; label: string }) {
  const isImage = asset.mimeType?.startsWith("image/") ?? false;
  const downloadUrl = `/api/download?id=${asset.id}`;
  const previewUrl = asset.previewUrl ?? downloadUrl;

  if (isImage) {
    return (
      <div className="relative group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={label}
          className="w-full rounded-md object-contain bg-inset"
        />
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-surface border border-line-2 shadow-sm rounded-md px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:border-line-3 transition-colors opacity-0 group-hover:opacity-100"
        >
          Open full size
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 9L9 2M9 2H5M9 2V6" />
          </svg>
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center bg-page border border-line rounded-md px-6 py-12 text-center gap-4">
      <svg className="w-10 h-10 text-ink-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <p className="text-sm text-ink-3 max-w-[200px] break-words">{asset.filename}</p>
      <a
        href={downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-neutral-900 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-neutral-700 transition-colors"
      >
        Open file
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 10L10 2M10 2H6M10 2V6" />
        </svg>
      </a>
    </div>
  );
}

export default function WireframeFeedbackForm({
  projectId,
  assets,
  initialContent,
  readOnly,
}: {
  projectId: string;
  assets: Asset[];
  initialContent: Record<string, unknown>;
  readOnly: boolean;
}) {
  const initPages: Record<string, PageFeedback> = {};
  const saved = (initialContent.pages ?? {}) as Record<string, PageFeedback>;
  for (const asset of assets) {
    initPages[asset.id] = saved[asset.id] ?? { reaction: "", comment: "" };
  }

  const [overall, setOverall] = useState((initialContent.overall as string) ?? "");
  const [pages, setPages] = useState<Record<string, PageFeedback>>(initPages);
  const [finalNotes, setFinalNotes] = useState(
    (initialContent.finalNotes as string) ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);

  const allHappy =
    assets.length > 0 &&
    assets.every((a) => (pages[a.id]?.reaction ?? "") === "happy");

  function buildContent(): Content {
    return { overall, pages, finalNotes };
  }

  function updatePage(assetId: string, update: Partial<PageFeedback>) {
    setPages((prev) => ({ ...prev, [assetId]: { ...prev[assetId], ...update } }));
    setSavedDraft(false);
  }

  async function handleSave() {
    setSaving(true);
    await saveWireframeFeedback(projectId, buildContent());
    setSavedDraft(true);
    setSaving(false);
  }

  async function handleSubmit() {
    setSubmitting(true);
    if (allHappy) {
      await approveWireframesAndSubmit(projectId, buildContent());
    } else {
      await submitWireframeFeedback(projectId, buildContent());
    }
    // Both actions redirect server-side
  }

  return (
    <div className="space-y-6">
      {/* Overall direction */}
      <div className="bg-surface border border-line rounded-lg p-5">
        <p className="text-sm font-semibold text-ink mb-1">Overall direction</p>
        <p className="text-xs text-ink-3 mb-4">
          Before the detail — how does the overall direction feel?
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "love_it", label: "Love it — let's go" },
            { value: "on_track", label: "On the right track" },
            { value: "not_there", label: "Not quite there yet" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={readOnly}
              onClick={() => {
                setOverall(opt.value);
                setSavedDraft(false);
              }}
              className={`px-4 py-2 rounded-full text-sm border transition-colors disabled:opacity-60 ${
                overall === opt.value
                  ? "bg-neutral-900 border-neutral-900 text-white"
                  : "border-line-2 text-ink-2 hover:border-neutral-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Per-wireframe cards */}
      {assets.map((asset, i) => {
        const page = pages[asset.id] ?? { reaction: "", comment: "" };
        const label = labelFromFilename(asset.filename);

        return (
          <div
            key={asset.id}
            className="bg-surface border border-line rounded-lg overflow-hidden"
          >
            {/* Card title row */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-line">
              <span className="text-xs font-mono text-ink-2 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-semibold text-ink">{label}</span>
              {page.reaction && (
                <span
                  className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    page.reaction === "happy"
                      ? "bg-mint-fill text-mint"
                      : page.reaction === "tweaks"
                      ? "bg-amber-fill text-amber"
                      : "bg-rose-fill text-rose"
                  }`}
                >
                  {page.reaction === "happy"
                    ? "Happy with this"
                    : page.reaction === "tweaks"
                    ? "Minor tweaks"
                    : "Needs rethinking"}
                </span>
              )}
            </div>

            {/* Two-column layout: preview left, feedback right */}
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr]">
              {/* Left — wireframe preview */}
              <div className="border-b lg:border-b-0 lg:border-r border-line p-4 bg-page">
                <FilePreview asset={asset} label={label} />
              </div>

              {/* Right — feedback controls */}
              <div className="p-5 flex flex-col gap-5 lg:sticky lg:top-0 lg:self-start">
                <div>
                  <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-3">
                    How does this look?
                  </p>
                  <div className="flex flex-col gap-2">
                    {REACTIONS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        disabled={readOnly}
                        onClick={() => updatePage(asset.id, { reaction: r.value })}
                        className={`w-full px-4 py-2.5 rounded-md text-sm font-medium border transition-colors disabled:opacity-60 text-left ${
                          page.reaction === r.value ? r.active : r.inactive
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1">
                  <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-2">
                    Comments{" "}
                    <span className="text-ink-2 font-normal normal-case">
                      (optional)
                    </span>
                  </p>
                  <textarea
                    value={page.comment}
                    onChange={(e) =>
                      updatePage(asset.id, { comment: e.target.value })
                    }
                    disabled={readOnly}
                    placeholder="What works, what doesn't, anything specific to change…"
                    rows={6}
                    className="w-full rounded-md border border-line-2 px-3 py-2 text-sm text-ink placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500 resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Final notes */}
      <div className="bg-surface border border-line rounded-lg p-5">
        <p className="text-sm font-semibold text-ink mb-1">Anything else?</p>
        <p className="text-xs text-ink-3 mb-3">
          Any final thoughts before we move to the full design?
        </p>
        <textarea
          value={finalNotes}
          onChange={(e) => {
            setFinalNotes(e.target.value);
            setSavedDraft(false);
          }}
          disabled={readOnly}
          placeholder="Optional — leave blank if nothing else to add."
          rows={3}
          className="w-full rounded-md border border-line-2 px-3 py-2 text-sm text-ink placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500 resize-none"
        />
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="pb-6 space-y-4">
          {allHappy ? (
            <>
              {/* Approval notice */}
              <div className="border border-green-300 bg-mint-fill rounded-lg px-5 py-4">
                <p className="text-sm font-semibold text-green-900 mb-1">
                  You&apos;re approving these wireframes
                </p>
                <p className="text-sm text-mint leading-relaxed">
                  By clicking <strong>&ldquo;Approve wireframes&rdquo;</strong> below, you confirm
                  that you are satisfied with the wireframes as shown and authorise Zero-Point to
                  proceed to the full design stage. This is your formal sign-off on the sketch
                  direction — any structural or layout changes requested after this point will be
                  treated as new scope.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline"
                  onClick={handleSave}
                  disabled={saving || submitting}
                 
                >
                  {saving ? "Saving…" : "Save draft"}
                </Button>
                <Button variant="success" size="xl"
                  onClick={handleSubmit}
                  disabled={saving || submitting}
                 
                >
                  {submitting ? "Submitting…" : "Approve wireframes →"}
                </Button>
                {savedDraft && !saving && (
                  <span className="text-xs text-ink-2">Saved</span>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Button variant="outline"
                onClick={handleSave}
                disabled={saving || submitting}
               
              >
                {saving ? "Saving…" : "Save draft"}
              </Button>
              <Button size="xl"
                onClick={handleSubmit}
                disabled={saving || submitting}
               
              >
                {submitting ? "Submitting…" : "Submit feedback →"}
              </Button>
              {savedDraft && !saving && (
                <span className="text-xs text-ink-2">Saved</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
