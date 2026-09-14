"use client";

import { useState, useTransition } from "react";
import { addCustomVerification } from "@/app/actions/brief";
import Button from "@/components/ui/Button";

// Add a custom (team-authored) verification question to the queue. It can then be
// resolved directly or sent to the client for verification.
export default function AddVerificationQuestion({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(true)}>
        + Add custom question
      </Button>
    );
  }

  return (
    <div className="card card-pad space-y-2">
      <label className="zp-label">Custom verification question</label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="e.g. Is the founding year 2019 correct?"
        className="zp-textarea"
      />
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm"
          type="button"
          disabled={isPending || !value.trim()}
          onClick={() =>
            startTransition(async () => {
              await addCustomVerification(clientId, value);
              setValue("");
              setOpen(false);
            })
          }
         
        >
          {isPending ? "Adding…" : "Add question"}
        </Button>
        <Button variant="ghost" size="sm" type="button" onClick={() => { setOpen(false); setValue(""); }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
