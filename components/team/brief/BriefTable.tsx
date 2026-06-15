"use client";

import { useState, useTransition } from "react";

export type ColumnDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "boolean" | "select" | "textarea";
  options?: { value: string; label: string }[];
  addOnly?: boolean;
  tableOnly?: boolean;
};

type Row = Record<string, unknown> & { id: string };

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="faint">—</span>;
  }
  if (typeof value === "boolean") {
    return <span style={{ color: value ? "var(--mint)" : "var(--text-3)" }}>{value ? "Yes" : "No"}</span>;
  }
  const str = String(value);
  if (str.length > 80) return <span title={str}>{str.slice(0, 80)}…</span>;
  return <>{str}</>;
}

export default function BriefTable({
  title,
  description,
  columns,
  rows,
  addAction,
  deleteAction,
}: {
  title: string;
  description?: string;
  columns: ColumnDef[];
  rows: Row[];
  addAction: (formData: FormData) => Promise<void>;
  deleteAction: (id: string) => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [isPending, startTransition] = useTransition();

  const tableColumns = columns.filter((c) => !c.addOnly);
  const formColumns = columns.filter((c) => !c.tableOnly);

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteAction(id);
    });
  }
  function handleAdd(formData: FormData) {
    startTransition(async () => {
      await addAction(formData);
      setShowAdd(false);
    });
  }

  return (
    <section className="card" style={{ overflow: "hidden" }}>
      <div className="flex items-center justify-between" style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>{title}</h3>
          {description && <p className="faint" style={{ fontSize: 12, marginTop: 2 }}>{description}</p>}
        </div>
        <button type="button" onClick={() => setShowAdd((v) => !v)} className="btn btn-sm">
          {showAdd ? "Cancel" : "+ Add"}
        </button>
      </div>

      {showAdd && (
        <form action={handleAdd} style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {formColumns.map((col) => (
              <div key={col.key} className={col.type === "textarea" ? "col-span-2" : ""}>
                <label className="zp-label">{col.label}</label>
                {col.type === "textarea" ? (
                  <textarea name={col.key} rows={2} className="zp-textarea" />
                ) : col.type === "select" && col.options ? (
                  <select name={col.key} className="zp-select">
                    <option value="">—</option>
                    {col.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : col.type === "boolean" ? (
                  <select name={col.key} className="zp-select">
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input name={col.key} type={col.type === "number" ? "number" : "text"} step={col.type === "number" ? "any" : undefined} className="zp-input" />
                )}
              </div>
            ))}
          </div>
          <button type="submit" disabled={isPending} className="btn btn-sm btn-primary">
            {isPending ? "Saving…" : "Save"}
          </button>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="faint" style={{ padding: "16px 18px", fontSize: 13 }}>No entries yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="zp-table">
            <thead>
              <tr>
                {tableColumns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
                <th style={{ width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="group">
                  {tableColumns.map((col) => (
                    <td key={col.key} style={{ maxWidth: 320 }}>
                      <CellValue value={row[col.key]} />
                    </td>
                  ))}
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      disabled={isPending}
                      className="faint"
                      style={{ fontSize: 12 }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
