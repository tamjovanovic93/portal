"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveAsset } from "@/app/actions/assets";

export default function ClientUploadAction({
  assetId,
  filename,
  folder,
  uploadedAt,
}: {
  assetId: string;
  filename: string;
  folder: string | null;
  uploadedAt: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [seen, setSeen] = useState(false);

  function markSeen() {
    setSeen(true);
    startTransition(async () => {
      await approveAsset(assetId);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
      {/* Open / download the file */}
      <a
        href={`/api/download?id=${assetId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 group"
      >
        <p className="text-sm font-medium text-blue-900 truncate group-hover:underline">
          Client uploaded: {filename}
        </p>
        <p className="text-xs text-blue-700 mt-0.5 capitalize">
          {folder ?? "documents"} · {new Date(uploadedAt).toLocaleDateString()} · open file ↗
        </p>
      </a>

      {/* Mark as seen */}
      <button
        type="button"
        onClick={markSeen}
        disabled={isPending || seen}
        title="Mark as seen"
        className="flex items-center gap-1.5 shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-md border border-blue-300 text-blue-800 hover:bg-white disabled:opacity-50 transition-colors"
      >
        <span className="inline-flex items-center justify-center w-4 h-4 rounded border border-blue-400">
          {seen && (
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 6.5l2.5 2.5 4.5-5" />
            </svg>
          )}
        </span>
        {seen ? "Seen" : "Mark seen"}
      </button>
    </div>
  );
}
