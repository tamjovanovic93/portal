"use client";

import { useRef, useState } from "react";
import { createEvent, updateEvent, deleteEvent } from "@/app/actions/events";

type Project = { id: string; name: string };

type ExistingEvent = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  type: string;
  description: string | null;
  projectId: string | null;
};

const EVENT_TYPES = [
  { value: "MEETING", label: "Meeting" },
  { value: "DEADLINE", label: "Deadline" },
  { value: "APPROVAL_GATE", label: "Approval Gate" },
  { value: "APPOINTMENT", label: "Appointment" },
  { value: "MILESTONE", label: "Milestone" },
];

function toLocalDateTimeValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDateValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function NewEventModal({
  projects,
  defaultDate,
  event,
  onClose,
}: {
  projects: Project[];
  defaultDate?: Date;
  event?: ExistingEvent;
  onClose: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultStart = event
    ? event.allDay
      ? toLocalDateValue(event.startAt)
      : toLocalDateTimeValue(event.startAt)
    : defaultDate
    ? allDay
      ? toLocalDateValue(defaultDate)
      : toLocalDateTimeValue(defaultDate)
    : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setBusy(true);
    setError(null);
    const fd = new FormData(formRef.current);
    fd.set("allDay", allDay ? "true" : "false");

    const result = event
      ? await updateEvent(event.id, fd)
      : await createEvent(fd);

    setBusy(false);
    if (result?.error) {
      setError(result.error);
    } else {
      onClose();
    }
  }

  async function handleDelete() {
    if (!event) return;
    if (!confirm("Delete this event?")) return;
    setBusy(true);
    await deleteEvent(event.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-neutral-900">
            {event ? "Edit event" : "New event"}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-600 hover:text-neutral-600 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Title</label>
            <input
              name="title"
              required
              defaultValue={event?.title}
              placeholder="Event title"
              className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="accent-neutral-900"
            />
            <label htmlFor="allDay" className="text-xs text-neutral-600">
              All day
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {allDay ? "Date" : "Start"}
              </label>
              <input
                name="startAt"
                type={allDay ? "date" : "datetime-local"}
                required
                defaultValue={defaultStart}
                className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
            {!allDay && (
              <div>
                <label className="block text-xs text-neutral-500 mb-1">
                  End (optional)
                </label>
                <input
                  name="endAt"
                  type="datetime-local"
                  defaultValue={
                    event?.endAt ? toLocalDateTimeValue(event.endAt) : ""
                  }
                  className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Type</label>
            <select
              name="type"
              defaultValue={event?.type ?? "APPOINTMENT"}
              className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">
              Project (optional)
            </label>
            <select
              name="projectId"
              defaultValue={event?.projectId ?? ""}
              className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white"
            >
              <option value="">— No project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">
              Description (optional)
            </label>
            <textarea
              name="description"
              rows={2}
              defaultValue={event?.description ?? ""}
              placeholder="Notes, agenda, details…"
              className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            {event ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                Delete event
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-1.5 text-sm bg-neutral-900 text-white rounded-md hover:bg-neutral-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : event ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
