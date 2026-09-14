// Join class names, dropping falsy entries. No Tailwind merging: later
// entries do not override earlier ones (CSS order decides), so never pass two
// classes that set the same property.
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
