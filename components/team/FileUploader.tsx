"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const STAGE_LABELS: Record<number, string> = {
  1: "01 Onboarding", 2: "02 Strategy", 3: "03 Sketch",
  4: "04 Make", 5: "05 Build", 6: "06 Client Review",
  7: "07 Launch", 8: "08 Complete",
};

export default function FileUploader({
  projectId,
  currentStage,
}: {
  projectId: string;
  currentStage: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"INTERNAL" | "SHARED">("INTERNAL");
  const [stage, setStage] = useState<string>(String(currentStage));
  const [notes, setNotes] = useState("");

  async function uploadFile(file: File) {
    setUploading(true);
    setProgress(`Uploading ${file.name}…`);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectId", projectId);
    fd.append("stageNumber", stage);
    fd.append("visibility", visibility);
    if (notes) fd.append("notes", notes);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setProgress(null);
      setNotes("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(uploadFile);
  }

  return (
    <div className="space-y-3">
      {/* Options row */}
      <div className="flex gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Stage tag</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="px-2 py-1.5 border border-neutral-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <option value="">None</option>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={String(n)}>{STAGE_LABELS[n]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Visibility</label>
          <div className="flex border border-neutral-300 rounded-md overflow-hidden text-sm">
            {(["INTERNAL", "SHARED"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`px-3 py-1.5 transition-colors ${
                  visibility === v
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {v === "INTERNAL" ? "Internal" : "Share with client"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-600 mb-1">Note (optional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. First draft wireframes"
            className="w-full px-3 py-1.5 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
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
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <p className="text-sm text-neutral-500">{progress}</p>
        ) : (
          <>
            <p className="text-sm text-neutral-600">
              Drop files here or <span className="font-medium text-neutral-900">click to browse</span>
            </p>
            <p className="text-xs text-neutral-600 mt-1">Max 50 MB per file</p>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
