"use client";

import type { Section, Field } from "@/lib/templates/types";
import { isVisible } from "@/lib/templates/visibility";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";

// ─── Field renderers ───────────────────────────────────────────────────────

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
    <Textarea
      id={field.key}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      rows={field.rows ?? 4}
      disabled={disabled}
      resize="y"
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
    <Select
      id={field.key}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">Select…</option>
      {field.options?.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </Select>
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
          <span className="text-sm text-ink">{opt.label}</span>
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
      <span className="text-sm text-ink">{field.label}</span>
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
          <span className="text-sm text-ink">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

type ChecklistItemValue = { result: "pass" | "fail" | "na" | ""; note: string };

function ChecklistItemField({
  value,
  onChange,
  disabled,
}: {
  value: ChecklistItemValue;
  onChange: (v: ChecklistItemValue) => void;
  disabled: boolean;
}) {
  const RESULTS = [
    { v: "pass", label: "Pass", cls: "border-green-300 text-mint bg-mint-fill" },
    { v: "fail", label: "Fail", cls: "border-red-300 text-rose bg-rose-fill" },
    { v: "na", label: "N/A", cls: "border-line-2 text-ink-3 bg-page" },
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
                : "border-line text-ink-2 hover:border-neutral-300"
            } disabled:opacity-50`}
          >
            {label}
          </button>
        ))}
      </div>
      {value.result === "fail" && (
        <Input
          type="text"
          size="sm"
          value={value.note}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
          placeholder="Note what failed…"
          disabled={disabled}
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
        <div className="border border-line rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-page border-b border-line">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2 text-left text-xs font-medium text-ink-3"
                  >
                    {col.label}
                    {col.required && <span className="text-red-500 ml-0.5">*</span>}
                  </th>
                ))}
                {!disabled && <th className="w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
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
                          className="w-full text-sm text-ink placeholder:text-neutral-500 focus:outline-none disabled:bg-transparent resize-none"
                        />
                      ) : col.type === "select" ? (
                        <select
                          value={row[col.key] ?? ""}
                          onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                          disabled={disabled}
                          className="w-full text-sm text-ink focus:outline-none disabled:bg-transparent bg-transparent"
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
                          className="w-full text-sm text-ink placeholder:text-neutral-500 focus:outline-none disabled:bg-transparent"
                        />
                      )}
                    </td>
                  ))}
                  {!disabled && (
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => removeRow(rowIdx)}
                        className="text-ink-3 hover:text-red-500 transition-colors text-lg leading-none"
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
        <Button variant="dashed" size="sm" onClick={addRow}>
          + Add row
        </Button>
      )}
    </div>
  );
}

type SignatureValue = { name: string; date: string };

function SignatureField({
  value,
  onChange,
  disabled,
}: {
  value: SignatureValue;
  onChange: (v: SignatureValue) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <label className="block text-xs text-ink-3 mb-1">Full name</label>
        <Input
          type="text"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Your full name"
          disabled={disabled}
        />
      </div>
      <div className="w-40">
        <label className="block text-xs text-ink-3 mb-1">Date</label>
        <Input
          type="date"
          value={value.date}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
          disabled={disabled}
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
          className="block text-sm font-medium text-ink mb-1.5"
        >
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {field.hint && (
        <p className="text-xs text-ink-3 mb-2">{field.hint}</p>
      )}
      {children}
    </div>
  );
}

// ─── Single field dispatcher ───────────────────────────────────────────────

export function FieldRenderer({
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
          <Input
            id={field.key}
            type={field.type}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
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

export function SectionRenderer({
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
        <h3 className="text-base font-semibold text-ink">{section.title}</h3>
        {section.description && (
          <p className="text-sm text-ink-3 mt-1">{section.description}</p>
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

export function displayValue(field: Field, value: unknown): string {
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
