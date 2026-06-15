"use client";

import { useRouter } from "next/navigation";
import { deleteDocument } from "@/app/actions/documents";

export default function DeleteDocumentButton({
  documentId,
  projectId,
  stageNumber,
}: {
  documentId: string;
  projectId: string;
  stageNumber: number;
}) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    await deleteDocument(documentId);
    router.push(`/projects/${projectId}/stage/${stageNumber}`);
  }

  return (
    <button
      onClick={handleDelete}
      className="text-xs text-neutral-600 hover:text-red-600 transition-colors"
    >
      Delete
    </button>
  );
}
