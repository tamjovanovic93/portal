"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Template, Section, Field } from "@/lib/templates/types";
import { isVisible } from "@/lib/templates/visibility";
import { saveDocument, submitDocument } from "@/app/actions/documents";
import {
  completeForm,
  changeAnswer,
  askQuestion,
  sendFormToClient,
} from "@/app/actions/onboarding";
import {
  getCollab,
  teamPrefill,
  clientApprovePrefill,
  clientReplace,
  type FormContent,
  type CollabMap,
} from "@/lib/forms/collab";

export type FormMode = "fill" | "prefill" | "respond" | "review";

// ─── Field renderers ───────────────────────────────────────────────────────

function TextField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <input
      type="text"
      id={field.key}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      disabled={disabled}
      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500"
    />
  );
}

function TextareaField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <textarea
      id={field.key}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      rows={field.rows ?? 4}
      disabled={disabled}
      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500 resize-y"
    />
  );
}

function SelectField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <select
      id={field.key}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500 bg-white"
    >
      <option value="">Select…</option>
      {field.options?.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function RadioField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      {field.options?.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="radio"
            name={field.key}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            disabled={disabled}
            className="accent-neutral-900"
          />
          <span className="text-sm text-neutral-800">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function CheckboxField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="accent-neutral-900 w-4 h-4"
      />
      <span className="text-sm text-neutral-800">{field.label}</span>
    </label>
  );
}

function CheckboxGroupField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: string[];
  onChange: (v: string[]) => void;
  disabled: boolean;
}) {
  function toggle(optValue: string) {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  }

  return (
    <div className="space-y-2">
      {field.options?.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={value.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            disabled={disabled}
            className="accent-neutral-900 w-4 h-4"
          />
          <span className="text-sm text-neutral-800">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

type ChecklistItemValue = { result: "pass" | "fail" | "na" | ""; note: string };

function ChecklistItemField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: ChecklistItemValue;
  onChange: (v: ChecklistItemValue) => void;
  disabled: boolean;
}) {
  const RESULTS = [
    { v: "pass", label: "Pass", cls: "border-green-300 text-green-700 bg-green-50" },
    { v: "fail", label: "Fail", cls: "border-red-300 text-red-700 bg-red-50" },
    { v: "na", label: "N/A", cls: "border-neutral-300 text-neutral-500 bg-neutral-50" },
  ] as const;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {RESULTS.map(({ v, label, cls }) => (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ ...value, result: v })}
            className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
              value.result === v
                ? cls
                : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
            } disabled:opacity-50`}
          >
            {label}
          </button>
        ))}
      </div>
      {value.result === "fail" && (
        <input
          type="text"
          value={value.note}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
          placeholder="Note what failed…"
          disabled={disabled}
          className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50"
        />
      )}
    </div>
  );
}

type RepeatableRow = Record<string, string>;

function RepeatableField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: RepeatableRow[];
  onChange: (v: RepeatableRow[]) => void;
  disabled: boolean;
}) {
  const columns = field.columns ?? [];

  function addRow() {
    const emptyRow: RepeatableRow = {};
    columns.forEach((col) => (emptyRow[col.key] = ""));
    onChange([...value, emptyRow]);
  }

  function removeRow(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  function updateCell(rowIdx: number, colKey: string, cellValue: string) {
    const next = value.map((row, i) =>
      i === rowIdx ? { ...row, [colKey]: cellValue } : row
    );
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="border border-neutral-200 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2 text-left text-xs font-medium text-neutral-500"
                  >
                    {col.label}
                    {col.required && <span className="text-red-500 ml-0.5">*</span>}
                  </th>
                ))}
                {!disabled && <th className="w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {value.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2">
                      {col.type === "textarea" ? (
                        <textarea
                          value={row[col.key] ?? ""}
                          onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                          placeholder={col.placeholder}
                          rows={2}
                          disabled={disabled}
                          className="w-full text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none disabled:bg-transparent resize-none"
                        />
                      ) : col.type === "select" ? (
                        <select
                          value={row[col.key] ?? ""}
                          onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                          disabled={disabled}
                          className="w-full text-sm text-neutral-900 focus:outline-none disabled:bg-transparent bg-transparent"
                        >
                          <option value="">—</option>
                          {col.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={col.type === "date" ? "date" : "text"}
                          value={row[col.key] ?? ""}
                          onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                          placeholder={col.placeholder}
                          disabled={disabled}
                          className="w-full text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none disabled:bg-transparent"
                        />
                      )}
                    </td>
                  ))}
                  {!disabled && (
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => removeRow(rowIdx)}
                        className="text-neutral-500 hover:text-red-500 transition-colors text-lg leading-none"
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!disabled && (
        <button
          type="button"
          onClick={addRow}
          className="text-xs text-neutral-500 hover:text-neutral-900 border border-dashed border-neutral-300 hover:border-neutral-400 rounded-md px-3 py-1.5 transition-colors"
        >
          + Add row
        </button>
      )}
    </div>
  );
}

type SignatureValue = { name: string; date: string };

function SignatureField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: SignatureValue;
  onChange: (v: SignatureValue) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <label className="block text-xs text-neutral-500 mb-1">Full name</label>
        <input
          type="text"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Your full name"
          disabled={disabled}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500"
        />
      </div>
      <div className="w-40">
        <label className="block text-xs text-neutral-500 mb-1">Date</label>
        <input
          type="date"
          value={value.date}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
          disabled={disabled}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500"
        />
      </div>
    </div>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────────────

function FieldWrapper({
  field,
  children,
}: {
  field: Field;
  children: React.ReactNode;
}) {
  // Checkbox label is rendered inside the field itself
  const isInlineLabel = field.type === "checkbox";

  return (
    <div>
      {!isInlineLabel && (
        <label
          htmlFor={field.key}
          className="block text-sm font-medium text-neutral-800 mb-1.5"
        >
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {field.hint && (
        <p className="text-xs text-neutral-500 mb-2">{field.hint}</p>
      )}
      {children}
    </div>
  );
}

// ─── Single field dispatcher ───────────────────────────────────────────────

function FieldRenderer({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (v: any) => void;
  disabled: boolean;
}) {
  switch (field.type) {
    case "text":
    case "date":
      return (
        <FieldWrapper field={field}>
          <input
            id={field.key}
            type={field.type}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500"
          />
        </FieldWrapper>
      );
    case "textarea":
      return (
        <FieldWrapper field={field}>
          <TextareaField
            field={field}
            value={value ?? ""}
            onChange={onChange}
            disabled={disabled}
          />
        </FieldWrapper>
      );
    case "select":
      return (
        <FieldWrapper field={field}>
          <SelectField
            field={field}
            value={value ?? ""}
            onChange={onChange}
            disabled={disabled}
          />
        </FieldWrapper>
      );
    case "radio":
      return (
        <FieldWrapper field={field}>
          <RadioField
            field={field}
            value={value ?? ""}
            onChange={onChange}
            disabled={disabled}
          />
        </FieldWrapper>
      );
    case "checkbox":
      return (
        <FieldWrapper field={field}>
          <CheckboxField
            field={field}
            value={value ?? false}
            onChange={onChange}
            disabled={disabled}
          />
        </FieldWrapper>
      );
    case "checkboxGroup":
      return (
        <FieldWrapper field={field}>
          <CheckboxGroupField
            field={field}
            value={value ?? []}
            onChange={onChange}
            disabled={disabled}
          />
        </FieldWrapper>
      );
    case "checklistItem":
      return (
        <FieldWrapper field={field}>
          <ChecklistItemField
            field={field}
            value={value ?? { result: "", note: "" }}
            onChange={onChange}
            disabled={disabled}
          />
        </FieldWrapper>
      );
    case "repeatable": {
      const defaultRows = field.defaultRows ?? 0;
      const defaultValue =
        value ??
        Array.from({ length: defaultRows }, () => {
          const row: RepeatableRow = {};
          field.columns?.forEach((col) => (row[col.key] = ""));
          return row;
        });
      return (
        <FieldWrapper field={field}>
          <RepeatableField
            field={field}
            value={defaultValue}
            onChange={onChange}
            disabled={disabled}
          />
        </FieldWrapper>
      );
    }
    case "signature":
      return (
        <FieldWrapper field={field}>
          <SignatureField
            field={field}
            value={value ?? { name: "", date: "" }}
            onChange={onChange}
            disabled={disabled}
          />
        </FieldWrapper>
      );
    default:
      return null;
  }
}

// ─── Section ───────────────────────────────────────────────────────────────

function SectionRenderer({
  section,
  values,
  onChangeField,
  disabled,
}: {
  section: Section;
  values: Record<string, unknown>;
  onChangeField: (key: string, value: unknown) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-neutral-900">{section.title}</h3>
        {section.description && (
          <p className="text-sm text-neutral-500 mt-1">{section.description}</p>
        )}
      </div>
      <div className="space-y-5">
        {section.fields
          .filter((field) => isVisible(field.showIf, values))
          .map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={(v) => onChangeField(field.key, v)}
              disabled={disabled}
            />
          ))}
      </div>
    </div>
  );
}

// ─── Read-only value display (review / respond) ──────────────────────────────

function displayValue(field: Field, value: unknown): string {
  if (value == null || value === "") return "—";
  if (field.type === "select" || field.type === "radio") {
    return field.options?.find((o) => o.value === value)?.label ?? String(value);
  }
  if (field.type === "checkboxGroup" && Array.isArray(value)) {
    return (
      value
        .map((v) => field.options?.find((o) => o.value === v)?.label ?? v)
        .join(", ") || "—"
    );
  }
  if (field.type === "repeatable" && Array.isArray(value)) {
    const cols = field.columns ?? [];
    return (
      (value as Record<string, string>[])
        .map((row) => cols.map((c) => row[c.key]).filter(Boolean).join(" · "))
        .filter(Boolean)
        .join("  |  ") || "—"
    );
  }
  if (field.type === "signature" && typeof value === "object" && value) {
    const v = value as { name?: string; date?: string };
    return [v.name, v.date].filter(Boolean).join(" · ") || "—";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

type DocumentFormProps = {
  documentId: string;
  template: Template;
  initialContent: Record<string, unknown>;
  readOnly?: boolean;
  isTeam?: boolean;
  mode?: FormMode;
  stepped?: boolean; // respond mode: guided one-step-at-a-time wizard
};

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export default function DocumentForm(props: DocumentFormProps) {
  const mode: FormMode = props.mode ?? "fill";
  if (mode === "respond") return <RespondForm {...props} />;
  if (mode === "review") return <ReviewForm {...props} />;
  return <EditableForm {...props} mode={mode} />;
}

// ─── fill / prefill — a plain editable form ─────────────────────────────────

function EditableForm({
  documentId,
  template,
  initialContent,
  readOnly = false,
  isTeam = false,
  mode = "fill",
}: DocumentFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialContent);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleChangeField(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    startTransition(async () => {
      await saveDocument(documentId, values);
      setSaved(true);
    });
  }

  async function handleSubmit() {
    startTransition(async () => {
      await saveDocument(documentId, values);
      await submitDocument(documentId);
    });
  }

  // Prefill mode: mark every answered field as a pending prefill, then send.
  async function handleSend() {
    let content = { ...values } as FormContent;
    for (const section of template.sections) {
      for (const field of section.fields) {
        const v = content[field.key];
        const empty =
          v === undefined ||
          v === null ||
          v === "" ||
          (Array.isArray(v) && v.length === 0);
        if (!empty) content = teamPrefill(content, field.key, v);
      }
    }
    startTransition(async () => {
      await saveDocument(documentId, content);
      await sendFormToClient(documentId);
    });
  }

  const visibleSections = template.sections.filter(
    (s) => (!s.teamOnly || isTeam) && isVisible(s.showIf, values)
  );

  return (
    <div className="space-y-10">
      {visibleSections.map((section) => (
        <section
          key={section.key}
          className="border border-neutral-200 rounded-lg bg-white px-6 py-6"
        >
          <SectionRenderer
            section={section}
            values={values}
            onChangeField={handleChangeField}
            disabled={readOnly}
          />
        </section>
      ))}

      {!readOnly && (
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="px-4 py-2 rounded-md border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Saving…" : "Save draft"}
          </button>
          {mode === "prefill" ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending}
              className="px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Sending…" : "Send to client"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors"
            >
              {isTeam ? "Save & mark complete" : "Submit"}
            </button>
          )}
          {saved && !isPending && (
            <span className="text-xs text-neutral-600">Saved</span>
          )}
        </div>
      )}
      {mode === "prefill" && (
        <p className="text-xs text-neutral-500">
          Answers you fill in will be sent to the client to approve or change.
          Leave a field empty for the client to fill it in themselves.
        </p>
      )}
    </div>
  );
}

// ─── respond — client approves/changes pre-filled answers, fills the rest ────

const MAX_FIELDS_PER_STEP = 5;

function RespondForm({
  documentId,
  template,
  initialContent,
  stepped = false,
}: DocumentFormProps) {
  const router = useRouter();
  const [content, setContent] = useState<FormContent>(initialContent as FormContent);
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const collab: CollabMap = getCollab(content);

  function setValue(key: string, v: unknown) {
    setContent((prev) => ({ ...prev, [key]: v }));
  }
  function approve(key: string) {
    setContent((prev) => clientApprovePrefill(prev, key));
  }
  function beginChange(key: string) {
    setEditing((prev) => new Set(prev).add(key));
    setContent((prev) => clientReplace(prev, key, prev[key] ?? ""));
  }
  function replaceValue(key: string, v: unknown) {
    setContent((prev) => clientReplace(prev, key, v));
  }

  const visibleSections = template.sections.filter(
    (s) => !s.teamOnly && isVisible(s.showIf, content)
  );

  function hasUnresolved(): boolean {
    return Object.entries(getCollab(content)).some(
      ([k, c]) => c.prefill?.status === "pending" && !editing.has(k)
    );
  }

  function submit() {
    if (hasUnresolved()) {
      setError("Please approve or change every pre-filled answer before submitting.");
      return;
    }
    setError(null);
    startTransition(async () => {
      await saveDocument(documentId, content);
      await completeForm(documentId);
      setSubmitted(true);
      router.refresh();
    });
  }

  // ── Render a single field with its collab controls ──
  function renderField(field: Field) {
    const c = collab[field.key];
    const status = c?.prefill?.status;
    const isEditing = editing.has(field.key) || status === "replaced";

    if (c?.prefill && status === "pending" && !isEditing) {
      return (
        <div key={field.key} className="rounded-md border border-blue-200 bg-blue-50/50 px-4 py-3">
          <p className="text-sm font-medium text-neutral-800 mb-1">{field.label}</p>
          <p className="text-xs text-neutral-500 mb-2">Your team suggested:</p>
          <p className="text-sm text-neutral-900 mb-3 whitespace-pre-wrap">
            {displayValue(field, content[field.key])}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => approve(field.key)}
              className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-700 transition-colors">
              Approve
            </button>
            <button type="button" onClick={() => beginChange(field.key)}
              className="px-3 py-1.5 rounded-md border border-neutral-300 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
              Change my answer
            </button>
          </div>
        </div>
      );
    }

    if (c?.prefill && status === "approved") {
      return (
        <div key={field.key} className="rounded-md border border-green-200 bg-green-50/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-800">{field.label}</p>
            <button type="button" onClick={() => beginChange(field.key)}
              className="text-xs text-neutral-500 hover:text-neutral-800">
              Change
            </button>
          </div>
          <p className="text-sm text-neutral-900 mt-1 whitespace-pre-wrap">
            {displayValue(field, content[field.key])}
          </p>
          <p className="text-xs text-green-700 mt-1">Approved ✓</p>
        </div>
      );
    }

    const onChange = isEditing
      ? (v: unknown) => replaceValue(field.key, v)
      : (v: unknown) => setValue(field.key, v);
    return (
      <FieldRenderer key={field.key} field={field} value={content[field.key]} onChange={onChange} disabled={false} />
    );
  }

  // ── Success confirmation (after submit) ──
  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-6 py-8 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h3 className="text-lg font-semibold text-green-900">
          Thank you — your intake form has been submitted.
        </h3>
        <p className="text-sm text-green-800 max-w-md mx-auto">
          Our team is reviewing your answers and preparing the next stage of your project.
          You&apos;ll be notified here when your Project Brief is ready for review.
        </p>
        <a href="/portal" className="inline-block mt-2 text-sm text-neutral-900 underline underline-offset-2">
          Back to portal
        </a>
      </div>
    );
  }

  // ── Stepped (guided) wizard ──
  if (stepped) {
    // Build steps from the visible sections/fields (respecting conditionals).
    type Wizard = { key: string; title: string; description?: string; fields: Field[] };
    const steps: Wizard[] = [];
    for (const section of visibleSections) {
      const fields = section.fields.filter((f) => isVisible(f.showIf, content));
      if (fields.length === 0) continue;
      for (let i = 0; i < fields.length; i += MAX_FIELDS_PER_STEP) {
        const chunk = fields.slice(i, i + MAX_FIELDS_PER_STEP);
        const multi = fields.length > MAX_FIELDS_PER_STEP;
        steps.push({
          key: `${section.key}-${i}`,
          title: section.title + (multi ? ` (part ${Math.floor(i / MAX_FIELDS_PER_STEP) + 1})` : ""),
          description: i === 0 ? section.description : undefined,
          fields: chunk,
        });
      }
    }

    if (steps.length === 0) {
      return <p className="text-sm text-neutral-500">This form has no questions to complete.</p>;
    }

    const idx = Math.min(step, steps.length - 1);
    const current = steps[idx];
    const isLast = idx === steps.length - 1;
    const pct = Math.round(((idx + 1) / steps.length) * 100);

    return (
      <div className="space-y-6">
        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-neutral-600">
              Step {idx + 1} of {steps.length}
            </span>
            <span className="text-xs font-medium text-neutral-600">{pct}% complete</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-neutral-200 overflow-hidden">
            <div className="h-full rounded-full bg-neutral-900 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <section className="border border-neutral-200 rounded-lg bg-white px-6 py-6 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">{current.title}</h3>
            {current.description && (
              <p className="text-sm text-neutral-500 mt-1">{current.description}</p>
            )}
          </div>
          <div className="space-y-5">{current.fields.map(renderField)}</div>
        </section>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => { setError(null); setStep(idx - 1); }}
            disabled={idx === 0 || isPending}
            className="px-4 py-2 rounded-md border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 transition-colors"
          >
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => startTransition(async () => { await saveDocument(documentId, content); })}
              disabled={isPending}
              className="px-3 py-2 rounded-md text-sm font-medium text-neutral-500 hover:text-neutral-800 disabled:opacity-50"
            >
              Save &amp; finish later
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="px-5 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Submitting…" : "Submit Intake Form"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setError(null); setStep(idx + 1); }}
                disabled={isPending}
                className="px-5 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors"
              >
                Next →
              </button>
            )}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ── Single-page (Initial Form) ──
  return (
    <div className="space-y-10">
      {visibleSections.map((section) => (
        <section key={section.key} className="border border-neutral-200 rounded-lg bg-white px-6 py-6 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">{section.title}</h3>
            {section.description && (
              <p className="text-sm text-neutral-500 mt-1">{section.description}</p>
            )}
          </div>
          <div className="space-y-5">
            {section.fields.filter((field) => isVisible(field.showIf, content)).map(renderField)}
          </div>
        </section>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => startTransition(async () => { await saveDocument(documentId, content); })}
          disabled={isPending}
          className="px-4 py-2 rounded-md border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        >
          Submit
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// ─── review — team reviews a completed form (change / ask a question) ────────

function ReviewForm({ documentId, template, initialContent }: DocumentFormProps) {
  const content = initialContent as FormContent;
  const collab = getCollab(content);
  const visibleSections = template.sections.filter((s) =>
    isVisible(s.showIf, content)
  );

  return (
    <div className="space-y-10">
      {visibleSections.map((section) => (
        <section
          key={section.key}
          className="border border-neutral-200 rounded-lg bg-white px-6 py-6 space-y-5"
        >
          <h3 className="text-base font-semibold text-neutral-900">{section.title}</h3>
          <div className="divide-y divide-neutral-100">
            {section.fields
              .filter((field) => isVisible(field.showIf, content))
              .map((field) => (
                <ReviewField
                  key={field.key}
                  documentId={documentId}
                  field={field}
                  value={content[field.key]}
                  collab={collab[field.key]}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ReviewField({
  documentId,
  field,
  value,
  collab,
}: {
  documentId: string;
  field: Field;
  value: unknown;
  collab: CollabMap[string] | undefined;
}) {
  const [open, setOpen] = useState<null | "edit" | "ask">(null);
  const [editValue, setEditValue] = useState(typeof value === "string" ? value : "");
  const [question, setQuestion] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitEdit() {
    startTransition(async () => {
      await changeAnswer(documentId, field.key, editValue);
      setOpen(null);
      setDone("Change sent — awaiting client approval.");
    });
  }
  function submitAsk() {
    if (!question.trim()) return;
    startTransition(async () => {
      await askQuestion(documentId, field.key, question.trim());
      setOpen(null);
      setQuestion("");
      setDone("Question sent to the client.");
    });
  }

  const edit = collab?.edit;
  const q = collab?.question;

  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-800">{field.label}</p>
          <p className="text-sm text-neutral-900 mt-0.5 whitespace-pre-wrap">
            {displayValue(field, value)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setOpen(open === "edit" ? null : "edit")}
            className="text-xs px-2.5 py-1 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          >
            Change
          </button>
          <button
            type="button"
            onClick={() => setOpen(open === "ask" ? null : "ask")}
            className="text-xs px-2.5 py-1 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          >
            Ask a question
          </button>
        </div>
      </div>

      {/* Existing collab status */}
      {edit && (
        <p className="text-xs mt-1.5 text-amber-700">
          {edit.status === "pending"
            ? "Your change is awaiting client approval."
            : "Client approved your change ✓"}
        </p>
      )}
      {q && (
        <p className="text-xs mt-1.5 text-neutral-600">
          <span className="font-medium">Q:</span> {q.text}
          {q.status === "answered" ? (
            <>
              {" "}
              <span className="font-medium text-neutral-800">A:</span> {q.answer}
            </>
          ) : (
            <span className="text-amber-700"> — awaiting client answer</span>
          )}
        </p>
      )}

      {open === "edit" && (
        <div className="mt-2 flex gap-2">
          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="New answer…"
          />
          <button
            type="button"
            onClick={submitEdit}
            disabled={isPending}
            className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-medium disabled:opacity-50"
          >
            Send change
          </button>
        </div>
      )}
      {open === "ask" && (
        <div className="mt-2 flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="Ask the client about this answer…"
          />
          <button
            type="button"
            onClick={submitAsk}
            disabled={isPending}
            className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-medium disabled:opacity-50"
          >
            Send question
          </button>
        </div>
      )}
      {done && <p className="text-xs text-green-700 mt-1.5">{done}</p>}
    </div>
  );
}
