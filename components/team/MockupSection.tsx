"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveDesignLink, deleteDesignAsset } from "@/app/actions/design";

type MockupAsset = {
  id: string;
  filename: string;
  mimeType: string | null;
  storagePath: string;
  uploadedAt: string;
};

const VERDICT_LABELS: Record<string, string> = {
  approved: "Approved — no changes needed",
  approved_with_revisions: "Approved with revisions",
  revisions_required: "Revisions required",
};

const VERDICT_STYLE: Record<string, string> = {
  approved: "text-green-700",
  approved_with_revisions: "text-amber-700",
  revisions_required: "text-red-700",
};

export default function MockupSection({
  projectId,
  assets,
  feedbackStatus,
  feedbackSubmittedAt,
  feedbackVerdict,
}: {
  projectId: string;
  assets: MockupAsset[];
  feedbackStatus: "none" | "pending" | "submitted";
  feedbackSubmittedAt: string | null;
  feedbackVerdict?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      await Promise.all(
        Array.from(files).map(async (file) => {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("projectId", projectId);
          fd.append("stageNumber", "4");
          fd.append("visibility", "SHARED");
          fd.append("folder", "mockup");
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Upload failed");
        })
      );
      router.refresh();
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    setLinkError(null);
    try {
      new URL(linkUrl.trim());
    } catch {
      setLinkError("Enter a valid URL (e.g. https://figma.com/...)");
      return;
    }
    await saveDesignLink(projectId, linkLabel, linkUrl);
    setLinkLabel("");
    setLinkUrl("");
    setAddingLink(false);
    router.refresh();
  }

  async function handleDelete(assetId: string) {
    if (!confirm("Remove this file or link?")) return;
    await deleteDesignAsset(assetId, projectId);
    router.refresh();
  }

  const files = assets.filter((a) => a.mimeType !== "text/uri-list");
  const links = assets.filter((a) => a.mimeType === "text/uri-list");

  return (
    <div className="space-y-4">
      {/* Upload drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg px-6 py-6 text-center cursor-pointer transition-colors ${
          dragging ? "border-neutral-600 bg-neutral-100" : "border-neutral-300 hover:border-neutral-400 bg-white"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files)}
        />
        {uploading ? (
          <p className="text-sm text-neutral-500">Uploading…</p>
        ) : (
          <>
            <p className="text-sm text-neutral-600">
              Drop design files here or{" "}
              <span className="font-medium text-neutral-900">click to browse</span>
            </p>
            <p className="text-xs text-neutral-600 mt-1">
              PNG, JPG, PDF — shared with client automatically
            </p>
          </>
        )}
      </div>
      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

      {/* Add link */}
      {addingLink ? (
        <form onSubmit={handleAddLink} className="border border-neutral-200 rounded-lg bg-white p-4 space-y-3">
          <p className="text-xs font-medium text-neutral-700">Add a design link</p>
          <div className="flex gap-3">
            <input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Label (e.g. Figma Design)"
              className="w-36 px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              required
            />
          </div>
          {linkError && <p className="text-xs text-red-600">{linkError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setAddingLink(false); setLinkError(null); }}
              className="px-3 py-1.5 text-sm border border-neutral-300 rounded-md hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded-md hover:bg-neutral-700"
            >
              Add link
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAddingLink(true)}
          className="text-xs text-neutral-500 hover:text-neutral-900 border border-dashed border-neutral-300 hover:border-neutral-400 rounded-md px-3 py-2 transition-colors"
        >
          + Add design link (Figma, staging, etc.)
        </button>
      )}

      {/* Files list */}
      {files.length > 0 && (
        <div className="border border-neutral-200 rounded-lg bg-white divide-y divide-neutral-100 overflow-hidden">
          {files.map((asset, i) => (
            <div key={asset.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xs font-mono text-neutral-600 shrink-0 w-5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-sm text-neutral-800 truncate">{asset.filename}</span>
              <span className="text-xs text-neutral-600 shrink-0">
                {new Date(asset.uploadedAt).toLocaleDateString()}
              </span>
              <a
                href={`/api/download?id=${asset.id}`}
                className="text-xs text-neutral-600 hover:text-neutral-700 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                ↓
              </a>
              <button
                onClick={() => handleDelete(asset.id)}
                className="text-xs text-neutral-500 hover:text-red-500 transition-colors shrink-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Links list */}
      {links.length > 0 && (
        <div className="border border-neutral-200 rounded-lg bg-white divide-y divide-neutral-100 overflow-hidden">
          {links.map((asset) => (
            <div key={asset.id} className="flex items-center gap-3 px-4 py-3">
              <svg className="w-3.5 h-3.5 text-neutral-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="flex-1 text-sm text-neutral-800 truncate">{asset.filename}</span>
              <a
                href={asset.storagePath}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                Open ↗
              </a>
              <button
                onClick={() => handleDelete(asset.id)}
                className="text-xs text-neutral-500 hover:text-red-500 transition-colors shrink-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Feedback status */}
      {assets.length > 0 && (
        <p className="text-xs text-neutral-600 pt-1">
          {feedbackStatus === "submitted" ? (
            <>
              Client feedback received
              {feedbackSubmittedAt && ` · ${new Date(feedbackSubmittedAt).toLocaleDateString()}`}
              {feedbackVerdict && (
                <span className={`ml-1 font-medium ${VERDICT_STYLE[feedbackVerdict] ?? ""}`}>
                  — {VERDICT_LABELS[feedbackVerdict] ?? feedbackVerdict}
                </span>
              )}
              {" — see below"}
            </>
          ) : (
            "Awaiting client feedback"
          )}
        </p>
      )}
    </div>
  );
}
