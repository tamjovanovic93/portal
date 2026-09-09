"use client";

import { useState } from "react";
import { deleteClient } from "@/app/actions/projects";

// Destructive action on the client stream header — mirrors the confirm() +
// red-button pattern used by ProjectCardMenu. On success the action redirects
// back to /clients, so only errors return to this component.
export default function DeleteClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        `Delete ${clientName}?\n\n` +
          "This permanently removes the client and ALL of their data — every " +
          "project and retainer, their Client Data (profile, verification, " +
          "strategy, brand kit), intake forms, briefs, tasks, approvals, uploads " +
          "and notifications.\n\nTeam members are not affected. This cannot be undone."
      )
    )
      return;
    setBusy(true);
    const result = await deleteClient(clientId);
    // Success redirects away; only an error object comes back here.
    if (result?.error) {
      alert(result.error);
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      className="px-3 py-2 text-sm rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
    >
      {busy ? "Deleting…" : "Delete client"}
    </button>
  );
}
