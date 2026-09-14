// Document.status labels and badge classes shared by the document pages.
export const DOC_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent to client",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const DOC_STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-500",
  SENT: "bg-blue-50 text-blue-700",
  APPROVED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-700",
};

export { COLLAB_FORM_TYPES, TEMPLATE_TYPES } from "@/lib/documents/types";
