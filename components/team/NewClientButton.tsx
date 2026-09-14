"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientAccount } from "@/app/actions/clients";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";

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
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Email: ${created.email}\nPassword: ${created.tempPassword}`
                    );
                    setCopied(true);
                  }}
                >
                  {copied ? "Copied ✓" : "Copy credentials"}
                </Button>
              )}
            </div>
            <div className="flex gap-3 pt-5">
              <Button variant="outline" size="block" className="flex-1" onClick={reset}>
                Close
              </Button>
              <Button
                size="block"
                className="flex-1"
                onClick={() => {
                  const id = created.clientId;
                  reset();
                  router.push(`/clients/${id}`);
                }}
              >
                Open client →
              </Button>
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
                <Label>Business name</Label>
                <Input name="name" type="text" required placeholder="e.g. ALEM Store" />
              </div>
              <div>
                <Label>Email</Label>
                <Input name="email" type="email" required placeholder="client@example.com" />
              </div>
              <div>
                <Label>Mode</Label>
                <Select name="mode" defaultValue="PROJECT">
                  <option value="PROJECT">Project</option>
                  <option value="ONGOING">Ongoing / Retainer</option>
                </Select>
              </div>

              {error && <p className="text-sm text-rose">{error}</p>}

              <div className="flex gap-3 pt-1">
                <Button variant="outline" size="block" className="flex-1" onClick={reset}>
                  Cancel
                </Button>
                <Button type="submit" size="block" className="flex-1" disabled={loading}>
                  {loading ? "Creating…" : "Create client"}
                </Button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </>
  );
}
