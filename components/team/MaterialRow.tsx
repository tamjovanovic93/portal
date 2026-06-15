"use client";

import { useState } from "react";
import { updateMaterialStatus, updateMaterialItem, deleteMaterialItem } from "@/app/actions/materials";

type Item = {
  id: string;
  label: string;
  category: string;
  status: string;
  notes: string | null;
  dueDate: string | null;
};

const CATEGORIES = ["copy", "visuals", "info", "access", "approval"];
const STATUSES = ["pending", "submitted", "received", "verified"] as const;
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  received: "Received",
  verified: "Verified",
};

export default function MaterialRow({
  item,
  statusLabel,
  statusStyle,
}: {
  item: Item;
  statusLabel: string;
  statusStyle: string;
}) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  // Edit form local state
  const [label, setLabel] = useState(item.label);
  const [category, setCategory] = useState(item.category);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [dueDate, setDueDate] = useState(
    item.dueDate ? item.dueDate.slice(0, 10) : ""
  );
  const [status, setStatus] = useState(item.status);

  async function handleStatusChange(newStatus: string) {
    setStatusLoading(true);
    await updateMaterialStatus(item.id, newStatus as "pending" | "submitted" | "received" | "verified");
    setStatusLoading(false);
  }

  async function handleSave() {
    setLoading(true);
    const fd = new FormData();
    fd.set("itemId", item.id);
    fd.set("label", label);
    fd.set("category", category);
    fd.set("notes", notes);
    fd.set("dueDate", dueDate);
    fd.set("status", status);
    await updateMaterialItem(fd);
    setEditing(false);
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm("Remove this item?")) return;
    setLoading(true);
    await deleteMaterialItem(item.id);
  }

  if (editing) {
    return (
      <div className="px-4 py-3 space-y-3 bg-neutral-50">
        <div className="flex gap-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1 px-2 py-1.5 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-32 px-2 py-1.5 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-28 px-2 py-1.5 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes for client"
            className="flex-1 px-2 py-1.5 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-36 px-2 py-1.5 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-1 text-xs border border-neutral-300 rounded hover:bg-neutral-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-3 py-1 text-xs bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {loading ? "Saving…" : "Save"}
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="ml-auto px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 flex items-start gap-4 group">
      {/* Status pill */}
      <div className="shrink-0 pt-0.5">
        <select
          value={item.status}
          disabled={statusLoading}
          onChange={(e) => handleStatusChange(e.target.value)}
          className={`text-xs font-medium bg-transparent border-none cursor-pointer focus:outline-none ${statusStyle}`}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${item.status === "verified" ? "line-through text-neutral-600" : "text-neutral-800"}`}>
          {item.label}
        </p>
        {item.notes && (
          <p className="text-xs text-neutral-600 mt-0.5">{item.notes}</p>
        )}
        {item.dueDate && (
          <p className="text-xs text-neutral-600 mt-0.5">
            Due {new Date(item.dueDate).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Edit button — visible on hover */}
      <button
        onClick={() => setEditing(true)}
        className="shrink-0 text-xs text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-neutral-700 transition-all"
      >
        Edit
      </button>
    </div>
  );
}
