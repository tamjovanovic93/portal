"use client";

import { useState } from "react";
import { toggleAssetVisibility, deleteAsset } from "@/app/actions/assets";

type Asset = {
  id: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  visibility: string;
  stageNumber: number | null;
  notes: string | null;
  uploadedAt: string;
};

const STAGE_LABELS: Record<number, string> = {
  1: "Onboarding", 2: "Strategy", 3: "Sketch",
  4: "Make", 5: "Build", 6: "Client Review",
  7: "Launch", 8: "Complete",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AssetRow({ asset, projectId }: { asset: Asset; projectId: string }) {
  const [loading, setLoading] = useState(false);
  const isShared = asset.visibility === "SHARED";

  async function handleToggle() {
    setLoading(true);
    await toggleAssetVisibility(asset.id);
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete ${asset.filename}? This cannot be undone.`)) return;
    setLoading(true);
    await deleteAsset(asset.id);
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <a
            href={`/api/download?id=${asset.id}`}
            className="text-sm font-medium text-neutral-800 hover:underline truncate"
          >
            {asset.filename}
          </a>
          {asset.stageNumber && (
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">
              {STAGE_LABELS[asset.stageNumber] ?? `Stage ${asset.stageNumber}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {asset.notes && (
            <span className="text-xs text-neutral-600">{asset.notes}</span>
          )}
          <span className="text-xs text-neutral-600">
            {formatBytes(asset.sizeBytes)} · {new Date(asset.uploadedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`text-xs px-2.5 py-1 rounded border transition-colors ${
            isShared
              ? "border-blue-300 text-blue-700 hover:bg-blue-50"
              : "border-neutral-300 text-neutral-500 hover:bg-neutral-50"
          }`}
        >
          {isShared ? "Shared" : "Internal"}
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs text-neutral-600 hover:text-red-600 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function FileList({
  assets,
  projectId,
}: {
  assets: Asset[];
  projectId: string;
}) {
  const shared = assets.filter((a) => a.visibility === "SHARED");
  const internal = assets.filter((a) => a.visibility === "INTERNAL");

  return (
    <div className="space-y-6">
      {shared.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Shared with client
          </h2>
          <div className="border border-neutral-200 rounded-lg bg-white divide-y divide-neutral-100 overflow-hidden">
            {shared.map((a) => (
              <AssetRow key={a.id} asset={a} projectId={projectId} />
            ))}
          </div>
        </section>
      )}

      {internal.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Internal only
          </h2>
          <div className="border border-neutral-200 rounded-lg bg-white divide-y divide-neutral-100 overflow-hidden">
            {internal.map((a) => (
              <AssetRow key={a.id} asset={a} projectId={projectId} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
