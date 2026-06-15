"use client";

import { useState, useRef } from "react";
import { addMaterialItem } from "@/app/actions/materials";

const CATEGORIES = [
  { value: "copy", label: "Copy" },
  { value: "visuals", label: "Visuals" },
  { value: "info", label: "Info" },
  { value: "access", label: "Access" },
  { value: "approval", label: "Approval" },
];

export default function AddMaterialForm({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("projectId", projectId);
    const result = await addMaterialItem(fd);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      formRef.current?.reset();
      setOpen(false);
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 border border-dashed border-neutral-300 hover:border-neutral-400 rounded-lg px-4 py-3 w-full transition-colors"
      >
        <span className="text-lg leading-none">+</span> Add item
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="border border-neutral-300 rounded-lg bg-white p-4 space-y-3"
    >
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-600 mb-1">
            What do we need?
          </label>
          <input
            name="label"
            type="text"
            required
            placeholder="e.g. Logo files in SVG format"
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>
        <div className="w-36">
          <label className="block text-xs font-medium text-neutral-600 mb-1">
            Category
          </label>
          <select
            name="category"
            required
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <option value="">Pick…</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-600 mb-1">
            Notes for client (optional)
          </label>
          <input
            name="notes"
            type="text"
            placeholder="e.g. Please include all colour variants"
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>
        <div className="w-36">
          <label className="block text-xs font-medium text-neutral-600 mb-1">
            Due date (optional)
          </label>
          <input
            name="dueDate"
            type="date"
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="px-3 py-1.5 text-sm border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded-md hover:bg-neutral-800 disabled:opacity-50 transition-colors"
        >
          {loading ? "Adding…" : "Add item"}
        </button>
      </div>
    </form>
  );
}
