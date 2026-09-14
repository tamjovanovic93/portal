// Document.status labels and badge classes shared by the document pages.
export const DOC_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent to client",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const DOC_STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-inset text-ink-3",
  SENT: "bg-blue-fill text-blue",
  APPROVED: "bg-mint-fill text-mint",
  REJECTED: "bg-rose-fill text-rose",
};

export { COLLAB_FORM_TYPES, TEMPLATE_TYPES } from "@/lib/documents/types";
