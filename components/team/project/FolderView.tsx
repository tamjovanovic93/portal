"use client";

import { useState } from "react";
import { approveAsset, deleteAsset } from "@/app/actions/assets";

type Asset = {
  id: string;
  filename: string;
  sizeBytes: number | null;
  uploadedAt: string;
  approvedAt: string | null;
  isClientUpload: boolean;
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AssetRow({ asset, projectId }: { asset: Asset; projectId: string }) {
  const [approved, setApproved] = useState(!!asset.approvedAt);
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    await approveAsset(asset.id);
    setApproved(true);
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${asset.filename}"? This cannot be undone.`)) return;
    setLoading(true);
    await deleteAsset(asset.id);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 group">
      <div className="flex-1 min-w-0">
        <a
          href={`/api/download?id=${asset.id}`}
          className="text-sm font-medium text-neutral-900 hover:underline truncate block"
        >
          {asset.filename}
        </a>
        <p className="text-xs text-neutral-500 mt-0.5">
          {formatBytes(asset.sizeBytes)} · {new Date(asset.uploadedAt).toLocaleDateString()}
          {asset.isClientUpload && !approved && (
            <span className="ml-2 text-amber-600 font-medium">New</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {asset.isClientUpload && (
          approved ? (
            <span className="text-xs text-green-700 font-medium">✓ Approved</span>
          ) : (
            <button
              onClick={handleApprove}
              disabled={loading}
              className="text-xs px-3 py-1 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50 transition-colors"
            >
              Approve
            </button>
          )
        )}
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs text-neutral-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function FolderView({
  folder,
  assets,
  projectId,
}: {
  folder: string;
  assets: Asset[];
  projectId: string;
}) {
  const unapproved = assets.filter((a) => a.isClientUpload && !a.approvedAt).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider capitalize">
          {folder}
        </h3>
        {unapproved > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
            {unapproved} new
          </span>
        )}
      </div>
      {assets.length === 0 ? (
        <div className="border border-dashed border-neutral-200 rounded-lg px-4 py-8 text-center">
          <p className="text-sm text-neutral-600">No files yet</p>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-lg bg-white divide-y divide-neutral-100 overflow-hidden">
          {assets.map((a) => (
            <AssetRow key={a.id} asset={a} projectId={projectId} />
          ))}
        </div>
      )}
    </div>
  );
}
