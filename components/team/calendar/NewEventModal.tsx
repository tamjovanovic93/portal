"use client";

import { useRef, useState } from "react";
import { createEvent, updateEvent, deleteEvent } from "@/app/actions/events";
import { EVENT_TYPE_OPTIONS } from "@/lib/constants/events";
import Button from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";

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
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-ink">
            {event ? "Edit event" : "New event"}
          </h2>
          <button
            onClick={onClose}
            className="text-ink-2 hover:text-neutral-600 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label size="xs">Title</Label>
            <Input name="title" required defaultValue={event?.title} placeholder="Event title" />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="accent-neutral-900"
            />
            <label htmlFor="allDay" className="text-xs text-ink-2">
              All day
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label size="xs">{allDay ? "Date" : "Start"}</Label>
              <Input
                name="startAt"
                type={allDay ? "date" : "datetime-local"}
                required
                defaultValue={defaultStart}
              />
            </div>
            {!allDay && (
              <div>
                <Label size="xs">End (optional)</Label>
                <Input
                  name="endAt"
                  type="datetime-local"
                  defaultValue={event?.endAt ? toLocalDateTimeValue(event.endAt) : ""}
                />
              </div>
            )}
          </div>

          <div>
            <Label size="xs">Type</Label>
            <Select name="type" defaultValue={event?.type ?? "APPOINTMENT"}>
              {EVENT_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label size="xs">Project (optional)</Label>
            <Select name="projectId" defaultValue={event?.projectId ?? ""}>
              <option value="">— No project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label size="xs">Description (optional)</Label>
            <Textarea
              name="description"
              rows={2}
              resize="none"
              defaultValue={event?.description ?? ""}
              placeholder="Notes, agenda, details…"
            />
          </div>

          {error && <p className="text-xs text-rose">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            {event ? (
              <Button variant="link-danger" size="xs" onClick={handleDelete} disabled={busy}>
                Delete event
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="quiet" size="md" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="md" disabled={busy}>
                {busy ? "Saving…" : event ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
