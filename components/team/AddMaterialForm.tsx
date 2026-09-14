"use client";

import { useState, useRef } from "react";
import { addMaterialItem } from "@/app/actions/materials";
import { MATERIAL_CATEGORY_OPTIONS } from "@/lib/constants/materials";
import { Input, Select } from "@/components/ui/Field";

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
        className="flex items-center gap-2 text-sm text-ink-3 hover:text-ink border border-dashed border-line-2 hover:border-line-3 rounded-lg px-4 py-3 w-full transition-colors"
      >
        <span className="text-lg leading-none">+</span> Add item
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="border border-line-2 rounded-lg bg-surface p-4 space-y-3"
    >
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-ink-2 mb-1">
            What do we need?
          </label>
          <Input
            name="label"
            type="text"
            required
            placeholder="e.g. Logo files in SVG format"
           
          />
        </div>
        <div className="w-36">
          <label className="block text-xs font-medium text-ink-2 mb-1">
            Category
          </label>
          <Select
            name="category"
            required
           
          >
            <option value="">Pick…</option>
            {MATERIAL_CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-ink-2 mb-1">
            Notes for client (optional)
          </label>
          <Input
            name="notes"
            type="text"
            placeholder="e.g. Please include all colour variants"
           
          />
        </div>
        <div className="w-36">
          <label className="block text-xs font-medium text-ink-2 mb-1">
            Due date (optional)
          </label>
          <Input className="bg-surface"
            name="dueDate"
            type="date"
           
          />
        </div>
      </div>

      {error && <p className="text-xs text-rose">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="px-3 py-1.5 text-sm border border-line-2 rounded-md hover:bg-surface-2 transition-colors"
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
