"use client";

import { useState, useRef } from "react";
import {
  saveDesignFeedback,
  submitDesignFeedback,
  approveDesignAndSubmit,
} from "@/app/actions/design";
import { DESIGN_STAGE } from "@/lib/stages";
import Button from "@/components/ui/Button";

type Asset = { id: string; filename: string; mimeType: string | null; storagePath: string; previewUrl?: string | null };
type Revision = { pageScreen: string; whatToChange: string };
type Verdict = "" | "approved" | "approved_with_revisions" | "revisions_required";

const AREAS = [
  { value: "layout", label: "Layout / structure" },
  { value: "colours", label: "Colours" },
  { value: "typography", label: "Typography / fonts" },
  { value: "spacing", label: "Spacing & padding" },
  { value: "images", label: "Images / visuals" },
  { value: "copy", label: "Copy / wording" },
  { value: "navigation", label: "Navigation / menus" },
  { value: "forms_buttons", label: "Forms & buttons" },
  { value: "mobile", label: "Mobile view" },
  { value: "other", label: "Something else" },
];

function AssetCard({ asset }: { asset: Asset }) {
  const isLink = asset.mimeType === "text/uri-list";
  const isImage = asset.mimeType?.startsWith("image/") ?? false;

  if (isLink) {
    return (
      <a
        href={asset.storagePath}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 bg-surface border border-line rounded-lg px-4 py-3 hover:border-line-3 transition-colors group"
      >
        <svg className="w-4 h-4 text-ink-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span className="text-sm font-medium text-ink group-hover:underline flex-1">
          {asset.filename}
        </span>
        <span className="text-xs text-blue shrink-0">Open ↗</span>
      </a>
    );
  }

  if (isImage) {
    return (
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.previewUrl ?? `/api/download?id=${asset.id}`}
          alt={asset.filename}
          className="w-full object-contain bg-page max-h-80"
        />
        <div className="px-4 py-3 flex items-center justify-between border-t border-line">
          <span className="text-sm text-ink-2">{asset.filename}</span>
          <a
            href={`/api/download?id=${asset.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-ink-3 hover:text-ink"
          >
            Open full size ↗
          </a>
        </div>
      </div>
    );
  }

  return (
    <a
      href={`/api/download?id=${asset.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-surface border border-line rounded-lg px-4 py-3 hover:border-line-3 transition-colors group"
    >
      <svg className="w-4 h-4 text-ink-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <span className="text-sm font-medium text-ink group-hover:underline flex-1 truncate">
        {asset.filename}
      </span>
      <span className="text-xs text-ink-3 shrink-0">Download ↓</span>
    </a>
  );
}

export default function DesignFeedbackForm({
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
  const saved = initialContent;

  const [verdict, setVerdict] = useState<Verdict>((saved.verdict as Verdict) ?? "");
  const [revisions, setRevisions] = useState<Revision[]>(
    (saved.revisions as Revision[] | undefined) ?? [{ pageScreen: "", whatToChange: "" }]
  );
  const [areas, setAreas] = useState<string[]>((saved.areas as string[] | undefined) ?? []);
  const [happyWith, setHappyWith] = useState((saved.happyWith as string) ?? "");
  const [anythingElse, setAnythingElse] = useState((saved.anythingElse as string) ?? "");

  type Attachment = { id: string; filename: string };
  const [attachments, setAttachments] = useState<Attachment[]>(
    (saved.attachments as Attachment[] | undefined) ?? []
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);

  const isApproval = verdict === "approved" || verdict === "approved_with_revisions";
  const needsRevisions = verdict === "revisions_required" || verdict === "approved_with_revisions";
  const canSubmit = verdict !== "";

  function buildContent() {
    return { verdict, revisions, areas, happyWith, anythingElse, attachments };
  }

  async function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("projectId", projectId);
        fd.append("folder", "design-feedback");
        fd.append("stageNumber", String(DESIGN_STAGE));
        const res = await fetch("/api/client-upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        setAttachments((prev) => [...prev, { id: json.id, filename: file.name }]);
      }
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    setSavedDraft(false);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setSavedDraft(false);
  }

  function addRevision() {
    setRevisions((prev) => [...prev, { pageScreen: "", whatToChange: "" }]);
    setSavedDraft(false);
  }

  function updateRevision(i: number, field: keyof Revision, value: string) {
    setRevisions((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
    setSavedDraft(false);
  }

  function removeRevision(i: number) {
    setRevisions((prev) => prev.filter((_, idx) => idx !== i));
    setSavedDraft(false);
  }

  function toggleArea(value: string) {
    setAreas((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]
    );
    setSavedDraft(false);
  }

  async function handleSave() {
    setSaving(true);
    await saveDesignFeedback(projectId, buildContent());
    setSavedDraft(true);
    setSaving(false);
  }

  async function handleSubmit() {
    setSubmitting(true);
    if (isApproval) {
      await approveDesignAndSubmit(projectId, buildContent());
    } else {
      await submitDesignFeedback(projectId, buildContent());
    }
  }

  return (
    <div className="space-y-6">
      {/* Design assets */}
      {assets.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">
            Designs to review
          </p>
          {assets.map((a) => (
            <AssetCard key={a.id} asset={a} />
          ))}
        </div>
      )}

      {/* Verdict */}
      <div className="bg-surface border border-line rounded-lg p-5">
        <p className="text-sm font-semibold text-ink mb-1">Overall verdict</p>
        <p className="text-xs text-ink-3 mb-4">
          How do you feel about the designs overall?
        </p>
        <div className="space-y-2">
          {[
            {
              value: "approved" as Verdict,
              label: "Approved",
              sub: "I'm happy with everything — proceed to build, no changes needed.",
            },
            {
              value: "approved_with_revisions" as Verdict,
              label: "Approved with revisions",
              sub: "Make the changes I've listed below, then proceed. No need to show me again.",
            },
            {
              value: "revisions_required" as Verdict,
              label: "Revisions required",
              sub: "Please make changes and share the updated designs for another review.",
            },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={readOnly}
              onClick={() => { setVerdict(opt.value); setSavedDraft(false); }}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-colors disabled:opacity-60 ${
                verdict === opt.value
                  ? opt.value === "approved"
                    ? "border-green-500 bg-mint-fill"
                    : opt.value === "approved_with_revisions"
                    ? "border-amber-400 bg-amber-fill"
                    : "border-red-400 bg-rose-fill"
                  : "border-line bg-surface hover:border-line-3"
              }`}
            >
              <p className={`text-sm font-medium ${
                verdict === opt.value
                  ? opt.value === "approved" ? "text-green-900"
                  : opt.value === "approved_with_revisions" ? "text-amber-900"
                  : "text-red-900"
                  : "text-ink"
              }`}>
                {opt.label}
              </p>
              <p className={`text-xs mt-0.5 ${
                verdict === opt.value
                  ? opt.value === "approved" ? "text-mint"
                  : opt.value === "approved_with_revisions" ? "text-amber"
                  : "text-rose"
                  : "text-ink-3"
              }`}>
                {opt.sub}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Revision list — shown when changes are requested */}
      {needsRevisions && (
        <div className="bg-surface border border-line rounded-lg p-5">
          <p className="text-sm font-semibold text-ink mb-1">What needs to change?</p>
          <p className="text-xs text-ink-3 mb-4">
            Be as specific as possible — the clearer you are, the faster we can turn it around.
          </p>
          <div className="space-y-3">
            {revisions.map((rev, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  value={rev.pageScreen}
                  onChange={(e) => updateRevision(i, "pageScreen", e.target.value)}
                  disabled={readOnly}
                  placeholder="Page / screen"
                  className="w-36 shrink-0 px-3 py-2 border border-line-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50"
                />
                <input
                  value={rev.whatToChange}
                  onChange={(e) => updateRevision(i, "whatToChange", e.target.value)}
                  disabled={readOnly}
                  placeholder="What would you like changed?"
                  className="flex-1 px-3 py-2 border border-line-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50"
                />
                {!readOnly && revisions.length > 1 && (
                  <button
                    onClick={() => removeRevision(i)}
                    className="text-ink-3 hover:text-red-500 transition-colors text-lg leading-none pt-2 shrink-0"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {!readOnly && (
              <button
                onClick={addRevision}
                className="text-xs text-ink-3 hover:text-ink border border-dashed border-line-2 hover:border-line-3 rounded-md px-3 py-1.5 transition-colors"
              >
                + Add another change
              </button>
            )}
          </div>
        </div>
      )}

      {/* Specific areas — shown when revisions needed */}
      {needsRevisions && (
        <div className="bg-surface border border-line rounded-lg p-5">
          <p className="text-sm font-semibold text-ink mb-1">Which areas need attention?</p>
          <p className="text-xs text-ink-3 mb-4">
            Tick anything you want us to pay particular attention to.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AREAS.map((area) => (
              <label
                key={area.value}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                  areas.includes(area.value)
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-line text-ink-2 hover:border-line-3"
                } ${readOnly ? "pointer-events-none opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={areas.includes(area.value)}
                  onChange={() => toggleArea(area.value)}
                  disabled={readOnly}
                  className="hidden"
                />
                <span className="text-sm">{area.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* What's working */}
      <div className="bg-surface border border-line rounded-lg p-5">
        <p className="text-sm font-semibold text-ink mb-1">What&apos;s working well?</p>
        <p className="text-xs text-ink-3 mb-3">
          Optional — helps us make sure we don&apos;t accidentally change what&apos;s already right.
        </p>
        <textarea
          value={happyWith}
          onChange={(e) => { setHappyWith(e.target.value); setSavedDraft(false); }}
          disabled={readOnly}
          placeholder="e.g. The homepage layout looks great. The colour palette feels right."
          rows={3}
          className="w-full rounded-md border border-line-2 px-3 py-2 text-sm text-ink placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500 resize-none"
        />
      </div>

      {/* Anything else */}
      <div className="bg-surface border border-line rounded-lg p-5">
        <p className="text-sm font-semibold text-ink mb-1">Anything else?</p>
        <textarea
          value={anythingElse}
          onChange={(e) => { setAnythingElse(e.target.value); setSavedDraft(false); }}
          disabled={readOnly}
          placeholder="Optional — leave blank if nothing else to add."
          rows={2}
          className="w-full rounded-md border border-line-2 px-3 py-2 text-sm text-ink placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500 resize-none"
        />
      </div>

      {/* Attachments */}
      <div className="bg-surface border border-line rounded-lg p-5">
        <p className="text-sm font-semibold text-ink mb-0.5">
          Reference files
          <span className="ml-2 text-xs font-normal text-ink-2">optional</span>
        </p>
        <p className="text-xs text-ink-3 mb-4">
          Attach screenshots, annotations, or reference images to help explain your feedback.
        </p>

        {/* Uploaded files */}
        {attachments.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-3 px-3 py-2 bg-page border border-line rounded-md"
              >
                <svg className="w-4 h-4 text-ink-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
                <span className="text-sm text-ink-2 flex-1 truncate">{att.filename}</span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="text-ink-3 hover:text-red-500 transition-colors text-lg leading-none shrink-0"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!readOnly && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileAttach}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-sm text-ink-2 border border-dashed border-line-2 hover:border-neutral-500 hover:text-ink rounded-md px-4 py-2 transition-colors disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "+ Attach a file"}
            </button>
            {uploadError && (
              <p className="mt-2 text-xs text-rose">{uploadError}</p>
            )}
          </div>
        )}

        {readOnly && attachments.length === 0 && (
          <p className="text-sm text-ink-2">No files attached.</p>
        )}
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="pb-6 space-y-4">
          {isApproval ? (
            <>
              <div className="border border-green-300 bg-mint-fill rounded-lg px-5 py-4">
                <p className="text-sm font-semibold text-green-900 mb-1">
                  {verdict === "approved"
                    ? "You're approving the designs"
                    : "You're approving the designs with revisions"}
                </p>
                <p className="text-sm text-mint leading-relaxed">
                  By clicking <strong>&ldquo;Approve designs&rdquo;</strong> below, you confirm that you
                  are satisfied with the designs
                  {verdict === "approved_with_revisions"
                    ? " subject to the revisions listed above"
                    : ""}{" "}
                  and authorise Zero-Point to proceed to the build stage. This is your formal
                  sign-off — any changes to design direction after this point will be treated as
                  new scope.
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
                  disabled={saving || submitting || !canSubmit}
                 
                >
                  {submitting ? "Submitting…" : "Approve designs →"}
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
                disabled={saving || submitting || !canSubmit}
               
              >
                {submitting ? "Submitting…" : "Submit feedback →"}
              </Button>
              {!canSubmit && !saving && !submitting && (
                <span className="text-xs text-ink-2">Select a verdict above to continue</span>
              )}
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
