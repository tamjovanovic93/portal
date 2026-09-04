import type { Template } from "./types";

// Team-built configuration for an intake form instance ("building blocks"):
// which sections/fields are removed, and the order of sections. Stored under
// content._config on the intake Document. Applied before rendering (DocumentForm),
// before review, and before the agent reads the answers (buildFormText).

export type FormConfig = {
  sectionOrder?: string[];
  removedSections?: string[];
  removedFields?: string[];
};

export function getConfig(content: Record<string, unknown> | null | undefined): FormConfig {
  return ((content?._config as FormConfig) ?? {}) as FormConfig;
}

// Return a new Template with removed sections/fields dropped and sections
// reordered per the config. Unknown keys in sectionOrder are ignored; sections
// missing from sectionOrder keep their original relative order at the end.
export function applyConfig(template: Template, config: FormConfig): Template {
  const removedSections = new Set(config.removedSections ?? []);
  const removedFields = new Set(config.removedFields ?? []);

  let sections = template.sections
    .filter((s) => !removedSections.has(s.key))
    .map((s) => ({
      ...s,
      fields: s.fields.filter((f) => !removedFields.has(f.key)),
    }))
    // Drop sections that ended up with no fields.
    .filter((s) => s.fields.length > 0);

  if (config.sectionOrder && config.sectionOrder.length > 0) {
    const rank = new Map(config.sectionOrder.map((k, i) => [k, i]));
    sections = [...sections].sort((a, b) => {
      const ra = rank.has(a.key) ? (rank.get(a.key) as number) : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(b.key) ? (rank.get(b.key) as number) : Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
  }

  return { ...template, sections };
}
