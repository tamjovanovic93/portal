import type { ShowIf } from "./types";

// Evaluate a `showIf` condition against the current form values. A missing
// condition is always visible. `equals` matches a single value or any of a list.
export function isVisible(
  showIf: ShowIf | undefined,
  values: Record<string, unknown>
): boolean {
  if (!showIf) return true;
  const current = values[showIf.field];
  const allowed = Array.isArray(showIf.equals) ? showIf.equals : [showIf.equals];
  return allowed.includes(current as string);
}
