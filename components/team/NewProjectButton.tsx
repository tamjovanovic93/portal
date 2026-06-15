"use client";

import { useState, useRef } from "react";
import { createProject } from "@/app/actions/projects";

const PROJECT_TYPES = [
  { value: "WEBSITE", label: "Website" },
  { value: "BRANDING", label: "Branding" },
  { value: "MARKETING", label: "Marketing" },
  { value: "SOFTWARE_CRM", label: "Software / CRM" },
  { value: "OTHER", label: "Other" },
];

export default function NewProjectButton({
  prefillEmail,
  label = "New project",
  triggerClassName = "px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 transition-colors",
}: {
  prefillEmail?: string;
  label?: string;
  triggerClassName?: string;
} = {}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await createProject(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={triggerClassName}>
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900 mb-5">
              Create project
            </h2>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Project name
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. ALEM Store Website"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Client email
                </label>
                <input
                  name="clientEmail"
                  type="email"
                  required
                  defaultValue={prefillEmail ?? ""}
                  placeholder="client@example.com"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Project type
                </label>
                <select
                  name="type"
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
                >
                  <option value="">Select type…</option>
                  {PROJECT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Mode
                </label>
                <select
                  name="mode"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
                >
                  <option value="PROJECT">Project (stages 1–8)</option>
                  <option value="ONGOING">Ongoing / Retainer</option>
                </select>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                  }}
                  className="flex-1 py-2 border border-neutral-300 text-sm rounded-md hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-neutral-900 text-white text-sm rounded-md hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Creating…" : "Create project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
