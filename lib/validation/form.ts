import { z, type ZodTypeAny } from "zod";

// Boundary validation for server actions that receive FormData. Returns the
// parsed data or the first human-readable error so actions can keep returning
// `{ error }` in the shape the UI already renders.

export type Parsed<T> = { ok: true; data: T } | { ok: false; error: string };

export function parseForm<S extends ZodTypeAny>(schema: S, formData: FormData): Parsed<z.infer<S>> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") raw[key] = value;
  }
  return parseInput(schema, raw);
}

export function parseInput<S extends ZodTypeAny>(schema: S, input: unknown): Parsed<z.infer<S>> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const issue = result.error.issues[0];
  const path = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
  return { ok: false, error: `${path}${issue?.message ?? "Invalid input"}` };
}

// ── Reusable field schemas ──

export const trimmed = z.string().trim();
export const requiredText = (label: string) => trimmed.min(1, `${label} is required.`);
export const optionalText = trimmed.optional().transform((v) => (v ? v : null));
export const email = trimmed.toLowerCase().email("Enter a valid email address.");
export const uuid = z.string().uuid("Invalid id.");

// Date inputs arrive as "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm"; empty means null.
export const optionalDate = trimmed
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Enter a valid date.")
  .transform((v) => (v === null ? null : new Date(v)));

export const requiredDate = (label: string) =>
  trimmed
    .min(1, `${label} is required.`)
    .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date.")
    .transform((v) => new Date(v));

export const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");
