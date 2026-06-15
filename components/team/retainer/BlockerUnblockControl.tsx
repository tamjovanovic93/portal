"use client";

import { useState, useTransition } from "react";
import { markUnblocked } from "@/app/actions/retainer";

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BlockerUnblockControl({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await markUnblocked(taskId, projectId, date);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold px-3 py-1.5 rounded-md bg-green-100 text-green-900 border border-green-700 hover:bg-green-200 transition-colors"
      >
        Mark unblocked
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        disabled={isPending}
        className="text-xs text-neutral-900 rounded border border-neutral-300 px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
      />
      <button
        type="button"
        onClick={confirm}
        disabled={isPending}
        className="text-sm font-semibold px-3 py-1.5 rounded-md bg-green-100 text-green-900 border border-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors"
      >
        {isPending ? "…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-neutral-600 hover:text-neutral-700 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
