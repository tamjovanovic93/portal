"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { approveAsset, deleteAsset } from "@/app/actions/assets";

export type FolderAsset = {
  id: string;
  filename: string;
  folder: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  approvedAt: string | null;
  visibility: string;
  isClientUpload: boolean;
};

const FOLDERS: { key: string; label: string; match: string[] }[] = [
  { key: "documents", label: "Documents", match: ["documents"] },
  { key: "visuals", label: "Visuals", match: ["visuals"] },
  { key: "copy", label: "Copy", match: ["copy"] },
  { key: "brief", label: "Brief & Data", match: ["brief"] },
];

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-5 h-5 shrink-0 ${open ? "text-neutral-700" : "text-neutral-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function AssetRow({ asset, projectId, router }: { asset: FolderAsset; projectId: string; router: ReturnType<typeof useRouter> }) {
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(!!asset.approvedAt);

  async function handleApprove() {
    setLoading(true);
    await approveAsset(asset.id);
    setApproved(true);
    setLoading(false);
    router.refresh();
  }
  async function handleDelete() {
    if (!confirm(`Delete "${asset.filename}"?`)) return;
    setLoading(true);
    await deleteAsset(asset.id);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 group">
      <div className="flex-1 min-w-0">
        <a href={`/api/download?id=${asset.id}`} className="text-sm font-medium text-neutral-800 hover:underline truncate block">
          {asset.filename}
        </a>
        <p className="text-xs text-neutral-700 mt-0.5">
          {formatBytes(asset.sizeBytes)}
          {asset.sizeBytes ? " · " : ""}
          {new Date(asset.uploadedAt).toLocaleDateString()}
          {asset.isClientUpload && !approved && <span className="ml-2 text-amber-700 font-medium">Client · new</span>}
          {asset.visibility === "SHARED" && <span className="ml-2 text-blue-700">Shared</span>}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {asset.isClientUpload && !approved && (
          <button onClick={handleApprove} disabled={loading} className="text-xs px-2.5 py-1 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50">
            Approve
          </button>
        )}
        <button onClick={handleDelete} disabled={loading} className="text-xs text-neutral-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
          Delete
        </button>
      </div>
    </div>
  );
}

export default function ProjectFiles({
  projectId,
  assets,
  briefGenerated = false,
}: {
  projectId: string;
  assets: FolderAsset[];
  briefGenerated?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [shareNext, setShareNext] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function assetsFor(folderKey: string) {
    const cfg = FOLDERS.find((f) => f.key === folderKey)!;
    return assets.filter((a) => a.folder && cfg.match.includes(a.folder));
  }

  async function uploadFiles(folderKey: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await Promise.all(
        Array.from(files).map(async (file) => {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("projectId", projectId);
          fd.append("folder", folderKey);
          fd.append("visibility", shareNext ? "SHARED" : "INTERNAL");
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
        })
      );
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      {/* Folder tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {FOLDERS.map((f) => {
          const count = assetsFor(f.key).length;
          const isOpen = open === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setOpen(isOpen ? null : f.key)}
              className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-left transition-colors ${
                isOpen ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 bg-white hover:border-neutral-400"
              }`}
            >
              <FolderIcon open={isOpen} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{f.label}</p>
                <p className="text-xs text-neutral-700">
                  {count} file{count !== 1 ? "s" : ""}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Open folder contents */}
      {open && (
        <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 bg-neutral-50">
            <p className="text-sm font-semibold text-neutral-900">
              {FOLDERS.find((f) => f.key === open)!.label}
            </p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
                <input type="checkbox" checked={shareNext} onChange={(e) => setShareNext(e.target.checked)} className="accent-neutral-900" />
                Share with client
              </label>
              <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => uploadFiles(open, e.target.files)} />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="text-xs px-3 py-1.5 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50 transition-colors"
              >
                {uploading ? "Uploading…" : "+ Upload"}
              </button>
            </div>
          </div>

          {/* Brief & Data: pinned link to the generated brief */}
          {open === "brief" && briefGenerated && (
            <Link
              href={`/projects/${projectId}/brief`}
              className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 hover:bg-neutral-50 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
                <span className="text-sm font-medium text-neutral-800 group-hover:underline">Brief & client database</span>
              </div>
              <span className="text-xs text-neutral-700 group-hover:text-neutral-900">Open →</span>
            </Link>
          )}

          {assetsFor(open).length === 0 ? (
            <p className="px-4 py-6 text-sm text-neutral-700 text-center">
              {open === "brief" && briefGenerated ? "No extra files in this folder yet." : "No files yet — upload one above."}
            </p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {assetsFor(open).map((a) => (
                <AssetRow key={a.id} asset={a} projectId={projectId} router={router} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
