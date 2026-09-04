"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markDocumentHandled } from "@/app/actions/documents";

// Small "Mark as reviewed" control on client-submitted document cards. Handling
// a document moves it out of Action Required into Recently completed.
export default function MarkReviewedButton({
  documentId,
  className = "text-xs px-2.5 py-1 rounded-full bg-white/70 border border-current/20 font-medium hover:bg-white transition-colors shrink-0",
}: {
  documentId: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          await markDocumentHandled(documentId);
          router.refresh();
        });
      }}
      disabled={isPending}
      className={className}
    >
      {isPending ? "…" : "Mark as reviewed"}
    </button>
  );
}
