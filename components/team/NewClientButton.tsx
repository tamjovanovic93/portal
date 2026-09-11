"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClientAccount } from "@/app/actions/clients";

// Create a Client without a Project. Only business name, email and mode are
// captured here — projects (and their types) are proposed later by the agent.
// On success a temporary login password is shown once so the team can hand it off.
export default function NewClientButton({
  triggerClassName = "btn btn-primary",
  label = "+ New client",
}: {
  triggerClassName?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    clientId: string;
    email: string;
    tempPassword?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setMounted(true), []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = e.currentTarget;
    const email = (new FormData(form).get("email") as string)?.trim().toLowerCase();
    const result = await createClientAccount(new FormData(form));
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setLoading(false);
    setCreated({ clientId: result.clientId!, email, tempPassword: result.tempPassword });
  }

  function reset() {
    setOpen(false);
    setError(null);
    setCreated(null);
    setCopied(false);
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
              {created ? (
                <>
                  <h2 className="text-base font-semibold text-neutral-900 mb-1">Client created</h2>
                  <p className="text-sm text-neutral-500 mb-5">
                    Share these login credentials with the client. The password is shown{" "}
                    <strong>once</strong> — copy it now.
                  </p>
                  <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 space-y-3">
                    <div>
                      <p className="text-xs text-neutral-500">Email</p>
                      <p className="text-sm font-medium text-neutral-900 break-all">{created.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Temporary password</p>
                      {created.tempPassword ? (
                        <p className="text-sm font-mono font-medium text-neutral-900">{created.tempPassword}</p>
                      ) : (
                        <p className="text-sm text-neutral-500">
                          Existing login reused — use “Reset password” on the client page if needed.
                        </p>
                      )}
                    </div>
                    {created.tempPassword && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `Email: ${created.email}\nPassword: ${created.tempPassword}`
                          );
                          setCopied(true);
                        }}
                        className="text-xs px-3 py-1.5 rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                      >
                        {copied ? "Copied ✓" : "Copy credentials"}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3 pt-5">
                    <button
                      type="button"
                      onClick={reset}
                      className="flex-1 py-2 border border-neutral-300 text-sm rounded-md hover:bg-neutral-50 transition-colors"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const id = created.clientId;
                        reset();
                        router.push(`/clients/${id}`);
                      }}
                      className="flex-1 py-2 bg-neutral-900 text-white text-sm rounded-md hover:bg-neutral-800 transition-colors"
                    >
                      Open client →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-base font-semibold text-neutral-900 mb-1">New client</h2>
                  <p className="text-sm text-neutral-500 mb-5">
                    A login is provisioned and the Initial Client Form is created. No project is needed yet.
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Business name</label>
                      <input
                        name="name"
                        type="text"
                        required
                        placeholder="e.g. ALEM Store"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                      <input
                        name="email"
                        type="email"
                        required
                        placeholder="client@example.com"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Mode</label>
                      <select
                        name="mode"
                        defaultValue="PROJECT"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
                      >
                        <option value="PROJECT">Project</option>
                        <option value="ONGOING">Ongoing / Retainer</option>
                      </select>
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={reset}
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
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
