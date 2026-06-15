"use client";

import { useEffect, useRef, useState } from "react";
import { archiveProject, deleteProject, restoreProject } from "@/app/actions/projects";

export default function ProjectCardMenu({
  projectId,
  isArchived = false,
}: {
  projectId: string;
  isArchived?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  function stop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleArchive(e: React.MouseEvent) {
    stop(e);
    setBusy(true);
    await (isArchived ? restoreProject(projectId) : archiveProject(projectId));
    setBusy(false);
    setOpen(false);
  }

  async function handleDelete(e: React.MouseEvent) {
    stop(e);
    if (
      !confirm(
        "Permanently delete this project? All data will be lost and cannot be recovered."
      )
    )
      return;
    setBusy(true);
    await deleteProject(projectId);
    setBusy(false);
    setOpen(false);
  }

  return (
    <div
      ref={ref}
      className="relative"
      onClick={stop}
    >
      <button
        onClick={(e) => {
          stop(e);
          setOpen((o) => !o);
        }}
        disabled={busy}
        className="flex items-center justify-center w-6 h-6 rounded hover:bg-neutral-100 text-neutral-600 hover:text-neutral-600 transition-colors"
        aria-label="Project options"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="7" cy="2" r="1.2" />
          <circle cx="7" cy="7" r="1.2" />
          <circle cx="7" cy="12" r="1.2" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-neutral-200 rounded-md shadow-lg z-30 py-1">
          <button
            onClick={handleArchive}
            disabled={busy}
            className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {isArchived ? "Restore" : "Archive"}
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
