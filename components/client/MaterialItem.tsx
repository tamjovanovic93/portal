"use client";

import { useState, useRef } from "react";
import { updateMaterialStatus } from "@/app/actions/materials";

export default function MaterialItem({
  item,
}: {
  item: {
    id: string;
    label: string;
    notes: string | null;
    status: string;
    dueDate: string | null;
    projectId: string;
    fileRef: string | null;
  };
}) {
  const [status, setStatus] = useState(item.status);
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [showMarkDone, setShowMarkDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isResolved = status === "submitted" || status === "received" || status === "verified";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectId", item.projectId);
    fd.append("materialItemId", item.id);

    try {
      const res = await fetch("/api/client-upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setAttachedFile(file.name);
      setStatus("submitted");
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleMarkDone() {
    setLoading(true);
    await updateMaterialStatus(item.id, "submitted");
    setStatus("submitted");
    setShowMarkDone(false);
    setLoading(false);
  }

  return (
    <div className={`rounded-lg border bg-white transition-colors ${
      isResolved ? "border-neutral-200 opacity-70" : "border-neutral-200"
    }`}>
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Status indicator */}
        <div
          className={`mt-0.5 h-4 w-4 rounded border shrink-0 flex items-center justify-center ${
            isResolved ? "bg-neutral-900 border-neutral-900" : "border-neutral-300"
          }`}
        >
          {isResolved && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
              <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm ${isResolved ? "line-through text-neutral-600" : "text-neutral-800"}`}>
            {item.label}
          </p>
          {item.notes && !isResolved && (
            <p className="text-xs text-neutral-500 mt-0.5">{item.notes}</p>
          )}
          {item.dueDate && !isResolved && (
            <p className="text-xs text-neutral-600 mt-0.5">
              Needed by {new Date(item.dueDate).toLocaleDateString()}
            </p>
          )}
          {(attachedFile ?? (isResolved && item.fileRef)) && (
            <p className="text-xs text-blue-600 mt-0.5">
              📎 {attachedFile ?? item.fileRef?.split("/").pop()}
            </p>
          )}
          {status === "submitted" && !attachedFile && !item.fileRef && (
            <p className="text-xs text-blue-600 mt-0.5">Submitted — we'll confirm receipt shortly.</p>
          )}
          {status === "verified" && (
            <p className="text-xs text-green-600 mt-0.5">Received and verified.</p>
          )}
          {uploadError && (
            <p className="text-xs text-red-600 mt-0.5">{uploadError}</p>
          )}
        </div>

        {!isResolved && (
          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-xs px-2.5 py-1 border border-neutral-300 rounded hover:bg-neutral-50 transition-colors disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Attach file"}
            </button>
            <button
              onClick={() => setShowMarkDone((v) => !v)}
              className="text-xs px-2.5 py-1 border border-neutral-300 rounded hover:bg-neutral-50 transition-colors"
            >
              Mark done
            </button>
          </div>
        )}
      </div>

      {showMarkDone && !isResolved && (
        <div className="px-4 pb-3 border-t border-neutral-100 pt-3 flex gap-2">
          <button
            onClick={() => setShowMarkDone(false)}
            className="px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMarkDone}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {loading ? "…" : "Confirm done"}
          </button>
        </div>
      )}
    </div>
  );
}
