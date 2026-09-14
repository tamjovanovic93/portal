"use client";

import { useState } from "react";
import { updateClient } from "@/app/actions/clients";
import Modal from "@/components/ui/Modal";

// Edit a client's business name and email after creation.
export default function EditClientButton({
  clientId,
  name,
  email,
}: {
  clientId: string;
  name: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await updateClient(clientId, {
      name: (fd.get("name") as string) ?? undefined,
      email: (fd.get("email") as string) ?? undefined,
    });
    if (res?.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setLoading(false);
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost">
        Edit
      </button>

      <Modal open={open}>
              <h2 className="text-base font-semibold text-ink mb-5">Edit client</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">Business name</label>
                  <input
                    name="name"
                    type="text"
                    required
                    defaultValue={name}
                    className="w-full px-3 py-2 border border-line-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">Email</label>
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={email}
                    className="w-full px-3 py-2 border border-line-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>

                {error && <p className="text-sm text-rose">{error}</p>}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setError(null);
                    }}
                    className="flex-1 py-2 border border-line-2 text-sm rounded-md hover:bg-surface-2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 bg-neutral-900 text-white text-sm rounded-md hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                  >
                    {loading ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
      </Modal>
    </>
  );
}
