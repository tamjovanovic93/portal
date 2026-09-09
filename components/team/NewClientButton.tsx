"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { createClientAccount } from "@/app/actions/clients";

// Create a Client without a Project. On success the action redirects to the new
// client's page, where onboarding/intake begins.
export default function NewClientButton({
  triggerClassName = "btn btn-primary",
  label = "+ New client",
}: {
  triggerClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await createClientAccount(new FormData(e.currentTarget));
    // Success redirects; only an error object returns here.
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {label}
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="theme-dark fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h2 className="text-base font-semibold text-neutral-900 mb-1">Create client</h2>
              <p className="text-sm text-neutral-500 mb-5">
                A login is provisioned and the Initial Client Form is created. No project is needed yet.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Client name</label>
                  <input
                    name="name"
                    type="text"
                    placeholder="e.g. ALEM Store"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Client email</label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="client@example.com"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
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
                    {loading ? "Creating…" : "Create client"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
