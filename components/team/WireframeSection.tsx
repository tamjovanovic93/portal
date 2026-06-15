"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type WireframeAsset = {
  id: string;
  filename: string;
  uploadedAt: string;
};

export default function WireframeSection({
  projectId,
  assets,
  feedbackStatus,
  feedbackSubmittedAt,
}: {
  projectId: string;
  assets: WireframeAsset[];
  feedbackStatus: "none" | "pending" | "submitted";
  feedbackSubmittedAt: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      await Promise.all(
        Array.from(files).map(async (file) => {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("projectId", projectId);
          fd.append("stageNumber", "3");
          fd.append("visibility", "SHARED");
          fd.append("folder", "wireframes");
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Upload failed");
        })
      );
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Upload drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg px-6 py-8 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-neutral-600 bg-neutral-100"
            : "border-neutral-300 hover:border-neutral-400 bg-white"
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
              Drop wireframes here or{" "}
              <span className="font-medium text-neutral-900">click to browse</span>
            </p>
            <p className="text-xs text-neutral-600 mt-1">
              PNG, JPG, PDF — shared with client automatically
            </p>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Uploaded file list */}
      {assets.length > 0 && (
        <div className="border border-neutral-200 rounded-lg bg-white divide-y divide-neutral-100 overflow-hidden">
          {assets.map((asset, i) => (
            <div key={asset.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xs font-mono text-neutral-600 shrink-0 w-5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-sm text-neutral-800 truncate">
                {asset.filename}
              </span>
              <span className="text-xs text-neutral-600 shrink-0">
                {new Date(asset.uploadedAt).toLocaleDateString()}
              </span>
              <a
                href={`/api/download?id=${asset.id}`}
                className="text-xs text-neutral-600 hover:text-neutral-700 transition-colors shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                ↓
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Feedback status line */}
      {assets.length > 0 && (
        <p className="text-xs text-neutral-600 pt-1">
          {feedbackStatus === "submitted"
            ? `Client feedback received${feedbackSubmittedAt ? ` · ${new Date(feedbackSubmittedAt).toLocaleDateString()}` : ""} — see below`
            : "Awaiting client feedback"}
        </p>
      )}
    </div>
  );
}
