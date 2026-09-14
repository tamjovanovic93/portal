"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientAccount } from "@/app/actions/clients";
import Modal from "@/components/ui/Modal";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    clientId: string;
    email: string;
    tempPassword?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

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

      <Modal open={open}>
              {created ? (
                <>
                  <h2 className="text-base font-semibold text-ink mb-1">Client created</h2>
                  <p className="text-sm text-ink-3 mb-5">
                    Share these login credentials with the client. The password is shown{" "}
                    <strong>once</strong> — copy it now.
                  </p>
                  <div className="rounded-md border border-line bg-page p-4 space-y-3">
                    <div>
                      <p className="text-xs text-ink-3">Email</p>
                      <p className="text-sm font-medium text-ink break-all">{created.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-3">Temporary password</p>
                      {created.tempPassword ? (
                        <p className="text-sm font-mono font-medium text-ink">{created.tempPassword}</p>
                      ) : (
                        <p className="text-sm text-ink-3">
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
                      className="flex-1 py-2 border border-line-2 text-sm rounded-md hover:bg-surface-2 transition-colors"
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
                  <h2 className="text-base font-semibold text-ink mb-1">New client</h2>
                  <p className="text-sm text-ink-3 mb-5">
                    A login is provisioned and the Initial Client Form is created. No project is needed yet.
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">Business name</label>
                      <input
                        name="name"
                        type="text"
                        required
                        placeholder="e.g. ALEM Store"
                        className="w-full px-3 py-2 border border-line-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">Email</label>
                      <input
                        name="email"
                        type="email"
                        required
                        placeholder="client@example.com"
                        className="w-full px-3 py-2 border border-line-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">Mode</label>
                      <select
                        name="mode"
                        defaultValue="PROJECT"
                        className="w-full px-3 py-2 border border-line-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-surface"
                      >
                        <option value="PROJECT">Project</option>
                        <option value="ONGOING">Ongoing / Retainer</option>
                      </select>
                    </div>

                    {error && <p className="text-sm text-rose">{error}</p>}

                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={reset}
                        className="flex-1 py-2 border border-line-2 text-sm rounded-md hover:bg-surface-2 transition-colors"
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
      </Modal>
    </>
  );
}
