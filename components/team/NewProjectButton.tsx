"use client";

import { useState, useRef, useEffect } from "react";
import { createProject, listClients } from "@/app/actions/projects";
import { PROJECT_TYPE_OPTIONS } from "@/lib/constants/projects";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";

type ClientOption = { id: string; name: string | null; email: string };

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
  const [clientChoice, setClientChoice] = useState<"new" | "existing">("new");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  // Load existing clients the first time the modal opens.
  useEffect(() => {
    if (open && clients.length === 0) {
      listClients().then(setClients).catch(() => {});
    }
  }, [open, clients.length]);

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

      <Modal
        open={open}
        overlayClassName="theme-dark fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
        cardClassName="bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
      >
        <h2 className="text-base font-semibold text-ink mb-5">
          Create project
        </h2>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Project name</Label>
            <Input name="name" type="text" required placeholder="e.g. ALEM Store Website" />
          </div>

          {/* Client — existing or new */}
          <div>
            <Label>Client</Label>
            <input type="hidden" name="clientChoice" value={clientChoice} />
            <div className="flex gap-2 mb-2">
              {(["new", "existing"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setClientChoice(c)}
                  className={`flex-1 py-1.5 text-sm rounded-md border transition-colors ${
                    clientChoice === c
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-line-2 text-ink-2 hover:bg-surface-2"
                  }`}
                >
                  {c === "new" ? "New client" : "Existing client"}
                </button>
              ))}
            </div>
            {clientChoice === "new" ? (
              <Input
                name="clientEmail"
                type="email"
                required
                defaultValue={prefillEmail ?? ""}
                placeholder="client@example.com"
              />
            ) : (
              <Select name="existingClientId" required>
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ? `${c.name} — ${c.email}` : c.email}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <Label>Project type</Label>
            <Select name="type" required>
              <option value="">Select type…</option>
              {PROJECT_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Mode</Label>
            <Select name="mode">
              <option value="PROJECT">Project (stages 1–8)</option>
              <option value="ONGOING">Ongoing / Retainer</option>
            </Select>
          </div>

          {error && <p className="text-sm text-rose">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              size="block"
              className="flex-1"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="block" className="flex-1" disabled={loading}>
              {loading ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
