// ─── Collaborative field-state (single round per answer) ─────────────────────
//
// Per-answer metadata for the Initial Client Form and the full Intake Form.
// Stored under the reserved `_collab` key on Document.content, keyed by field.
// The *effective answer* always stays in the normal flat content[fieldKey], so
// the intake agents (buildFormText in app/actions/intake.ts) keep working with
// no knowledge of collaboration.
//
// Two mechanics, both single-round:
//   • Prefill (pre-send): team enters an answer; the client approves it (keeps
//     the value) or replaces it with their own.
//   • Post-completion review: the team can change an answer (client must
//     re-approve the change) or ask a question about an answer (client answers).

export type CollabStatus =
  | "prefilled" // team pre-filled, awaiting client approve/replace
  | "approved" // client approved the (pre)filled value
  | "replaced" // client replaced the value with their own
  | "answered"; // client filled an originally-empty field

export type FieldCollab = {
  origin: "team" | "client";
  // Pre-send prefill by the team.
  prefill?: { value: unknown; status: "pending" | "approved" | "replaced" };
  // Post-completion team edit awaiting client re-approval.
  edit?: { value: unknown; status: "pending" | "approved"; at: string };
  // Post-completion team question awaiting a client answer.
  question?: { text: string; answer?: string; status: "open" | "answered"; askedAt: string };
};

export type CollabMap = Record<string, FieldCollab>;

// content wrapper — the flat answer map plus the reserved collab map.
export type FormContent = Record<string, unknown> & { _collab?: CollabMap };

export function getCollab(content: FormContent): CollabMap {
  return (content._collab as CollabMap) ?? {};
}

// True when any field has a pending prefill, pending edit, or open question —
// i.e. the client has something to respond to.
export function hasOpenClientItems(content: FormContent): boolean {
  const collab = getCollab(content);
  return Object.values(collab).some(
    (c) =>
      c.prefill?.status === "pending" ||
      c.edit?.status === "pending" ||
      c.question?.status === "open"
  );
}

// True when the team pre-filled at least one field (so the client sees the
// approve/replace UI rather than an empty form).
export function hasPrefill(content: FormContent): boolean {
  return Object.values(getCollab(content)).some((c) => c.prefill != null);
}

// ── Mutators (pure — return a new content object) ──

function withCollab(content: FormContent, fieldKey: string, patch: FieldCollab): FormContent {
  const collab = { ...getCollab(content) };
  collab[fieldKey] = { ...collab[fieldKey], ...patch };
  return { ...content, _collab: collab };
}

// Team pre-fills an answer before sending. Sets the effective value and marks
// it pending client approval.
export function teamPrefill(content: FormContent, fieldKey: string, value: unknown): FormContent {
  const next = withCollab(content, fieldKey, {
    origin: "team",
    prefill: { value, status: "pending" },
  });
  next[fieldKey] = value;
  return next;
}

// Client approves the pre-filled value (keeps it).
export function clientApprovePrefill(content: FormContent, fieldKey: string): FormContent {
  const existing = getCollab(content)[fieldKey];
  if (!existing?.prefill) return content;
  return withCollab(content, fieldKey, {
    ...existing,
    prefill: { ...existing.prefill, status: "approved" },
  });
}

// Client replaces the value with their own.
export function clientReplace(content: FormContent, fieldKey: string, value: unknown): FormContent {
  const existing = getCollab(content)[fieldKey] ?? { origin: "team" as const };
  const next = withCollab(content, fieldKey, {
    ...existing,
    prefill: existing.prefill
      ? { ...existing.prefill, status: "replaced" }
      : undefined,
  });
  next[fieldKey] = value;
  return next;
}

// Team edits a submitted answer; client must re-approve.
export function teamEdit(content: FormContent, fieldKey: string, value: unknown): FormContent {
  const existing = getCollab(content)[fieldKey] ?? { origin: "client" as const };
  const next = withCollab(content, fieldKey, {
    ...existing,
    edit: { value, status: "pending", at: new Date().toISOString() },
  });
  // Effective value becomes the team's proposed edit immediately; the flag
  // tracks whether the client has signed off.
  next[fieldKey] = value;
  return next;
}

// Client approves the team's edit.
export function clientApproveEdit(content: FormContent, fieldKey: string): FormContent {
  const existing = getCollab(content)[fieldKey];
  if (!existing?.edit) return content;
  return withCollab(content, fieldKey, {
    ...existing,
    edit: { ...existing.edit, status: "approved" },
  });
}

// Team asks a question about a specific answer.
export function teamAskQuestion(content: FormContent, fieldKey: string, text: string): FormContent {
  const existing = getCollab(content)[fieldKey] ?? { origin: "client" as const };
  return withCollab(content, fieldKey, {
    ...existing,
    question: { text, status: "open", askedAt: new Date().toISOString() },
  });
}

// Client answers the team's question.
export function clientAnswerQuestion(content: FormContent, fieldKey: string, answer: string): FormContent {
  const existing = getCollab(content)[fieldKey];
  if (!existing?.question) return content;
  return withCollab(content, fieldKey, {
    ...existing,
    question: { ...existing.question, answer, status: "answered" },
  });
}
