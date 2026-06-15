"use client";

import { useState, useTransition } from "react";
import type { Template, Section, Field } from "@/lib/templates/types";
import { saveDocument, submitDocument } from "@/app/actions/documents";

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
        {section.fields.map((field) => (
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

// ─── Main DocumentForm component ───────────────────────────────────────────

export default function DocumentForm({
  documentId,
  template,
  initialContent,
  readOnly = false,
  isTeam = false,
}: {
  documentId: string;
  template: Template;
  initialContent: Record<string, unknown>;
  readOnly?: boolean;
  isTeam?: boolean;
}) {
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

  // Filter sections for audience: team sees teamOnly sections, client does not
  const visibleSections = template.sections.filter(
    (s) => !s.teamOnly || isTeam
  );

  return (
    <div className="space-y-10">
      {/* Section list */}
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

      {/* Actions */}
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
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors"
          >
            {isTeam ? "Save & mark complete" : "Submit"}
          </button>
          {saved && !isPending && (
            <span className="text-xs text-neutral-600">Saved</span>
          )}
        </div>
      )}
    </div>
  );
}
