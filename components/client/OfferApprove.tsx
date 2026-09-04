"use client";

import { useState, useTransition } from "react";
import { approveOffer } from "@/app/actions/onboarding";

export default function OfferApprove({ documentId }: { documentId: string }) {
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-5 py-4">
        <p className="text-sm font-medium text-green-900">Offer approved ✓</p>
        <p className="text-xs text-green-700 mt-0.5">
          Thanks — your team has been notified and will continue with the next step.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4">
      <p className="text-sm font-medium text-amber-900">
        Please review the offer above and approve it to continue.
      </p>
      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            await approveOffer(documentId);
            setDone(true);
          })
        }
        disabled={isPending}
        className="mt-3 px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50"
      >
        {isPending ? "Approving…" : "Approve offer"}
      </button>
    </div>
  );
}
