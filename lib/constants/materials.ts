import type { Accent } from "@/components/ui/kit";

// MaterialItem.category / status vocab and the labels shown for them.

export const MATERIAL_CATEGORIES = ["copy", "visuals", "info", "access", "approval"] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const MATERIAL_CATEGORY_OPTIONS: { value: MaterialCategory; label: string }[] = [
  { value: "copy", label: "Copy" },
  { value: "visuals", label: "Visuals" },
  { value: "info", label: "Info" },
  { value: "access", label: "Access" },
  { value: "approval", label: "Approval" },
];

export const MATERIAL_STATUSES = ["pending", "submitted", "received", "verified"] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

// Project-level wording (project page, project materials page, MaterialRow).
export const MATERIAL_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  received: "Received",
  verified: "Verified",
};

// Text colour classes used next to the label on project-level pages.
export const MATERIAL_STATUS_TEXT_CLASS: Record<string, string> = {
  pending: "text-ink-2",
  submitted: "text-blue",
  received: "text-amber",
  verified: "text-green-600",
};

// The team-wide materials queue (/materials) is worded from the team's point
// of view and uses pill colours instead of text classes.
export const MATERIAL_QUEUE_STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting client",
  submitted: "To review",
  received: "Received",
  verified: "Verified",
};

export const MATERIAL_QUEUE_STATUS_COLOR: Record<string, Accent> = {
  pending: "amber",
  submitted: "blue",
  received: "mint",
  verified: "mint",
};
