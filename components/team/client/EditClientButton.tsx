"use client";

import { useState } from "react";
import { updateClient } from "@/app/actions/clients";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";

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
      <Button variant="ghost" type="button" onClick={() => setOpen(true)}>
        Edit
      </Button>

      <Modal open={open}>
        <h2 className="text-base font-semibold text-ink mb-5">Edit client</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Business name</Label>
            <Input name="name" type="text" required defaultValue={name} />
          </div>
          <div>
            <Label>Email</Label>
            <Input name="email" type="email" required defaultValue={email} />
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
              {loading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
