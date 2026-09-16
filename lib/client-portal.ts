import { COLLAB_FORM_TYPES } from "@/lib/documents/types";
import { hasOpenClientItems, type FormContent } from "@/lib/forms/collab";

// Client-voiced view helpers for app/(client). The label tables in
// lib/constants are written for the team ("Sent to client", "Awaiting client")
// and read wrong on a client screen, so the client wording lives here.

export type ClientDocView = {
  status: string;
  templateType: string;
  content: unknown;
};

// A document still needs the client's attention if it's been sent (fill/approve)
// or it's an approved collab form with open team edits/questions. Everything
// else (completed forms, approved offers) is history.
export function isDocActive(doc: ClientDocView): boolean {
  if (doc.status === "SENT") return true;
  if (doc.status === "APPROVED" && COLLAB_FORM_TYPES.has(doc.templateType)) {
    return hasOpenClientItems((doc.content ?? {}) as FormContent);
  }
  return false;
}

// Status wording as the client reads it. An offer is "Accepted"; every other
// completed form is "Submitted".
export function clientDocStatusLabel(doc: ClientDocView): string {
  if (isDocActive(doc)) return "Action needed";
  return doc.templateType === "financial_offer" ? "Accepted" : "Submitted";
}

// ProjectAsset grouping for the client file views. A text/uri-list asset is a
// link the team shared, not an uploaded file.
export type AssetKind = "photo" | "link" | "doc";

export function assetKind(mimeType: string | null): AssetKind {
  if (mimeType === "text/uri-list") return "link";
  if (mimeType?.startsWith("image/")) return "photo";
  return "doc";
}

export const ASSET_KIND_LABEL: Record<AssetKind, string> = {
  photo: "Photos",
  link: "Links",
  doc: "Docs",
};

// "Good morning" / "Good afternoon" / "Good evening" for the dashboard hero.
export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
