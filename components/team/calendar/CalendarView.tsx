"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NewEventModal from "./NewEventModal";

export type CalendarEvent = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  type: string;
  description: string | null;
  projectId: string | null;
  projectName: string | null;
  sourceType: string; // "manual" | "task" | "material"
};

type Project = { id: string; name: string };

const TYPE_COLORS: Record<string, string> = {
  MEETING: "bg-blue-500",
  DEADLINE: "bg-red-500",
  APPROVAL_GATE: "bg-amber-500",
  APPOINTMENT: "bg-purple-500",
  MILESTONE: "bg-green-500",
  TASK_DUE: "bg-neutral-400",
  task: "bg-neutral-400",
  material: "bg-red-400",
  cycle: "bg-blue-600",
};

const TYPE_LABEL: Record<string, string> = {
  MEETING: "Meeting",
  DEADLINE: "Deadline",
  APPROVAL_GATE: "Approval Gate",
  APPOINTMENT: "Appointment",
  MILESTONE: "Milestone",
  TASK_DUE: "Task Due",
  task: "Task",
  material: "Material Due",
  cycle: "Cycle Ends",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildGrid(year: number, month: number) {
  // month is 1-indexed
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDow = firstDay.getDay();

  const cells: { date: Date; isCurrentMonth: boolean }[] = [];

  for (let i = 0; i < startDow; i++) {
    cells.push({
      date: new Date(year, month - 1, 1 - startDow + i),
      isCurrentMonth: false,
    });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month - 1, d), isCurrentMonth: true });
  }
  while (cells.length < 42) {
    cells.push({
      date: new Date(year, month, cells.length - lastDay.getDate() - startDow + 1),
      isCurrentMonth: false,
    });
  }
  return cells;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(d: Date) {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function CalendarView({
  year,
  month,
  events,
  projects,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  projects: Project[];
}) {
  const router = useRouter();
  const today = new Date();

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [modalDate, setModalDate] = useState<Date | undefined>(undefined);

  const grid = buildGrid(year, month);

  function navigate(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    router.push(`/calendar?year=${y}&month=${m}`);
  }

  function goToday() {
    router.push(`/calendar?year=${today.getFullYear()}&month=${today.getMonth() + 1}`);
  }

  function eventsForDay(date: Date) {
    return events.filter((e) => isSameDay(e.startAt, date));
  }

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];

  function openNew(date?: Date) {
    setEditingEvent(null);
    setModalDate(date);
    setShowModal(true);
  }

  function openEdit(ev: CalendarEvent) {
    setEditingEvent(ev);
    setShowModal(true);
  }

  return (
    <div className="flex gap-6 h-full">
      {/* ── Main calendar grid ── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded hover:bg-neutral-100 text-neutral-600"
            >
              ‹
            </button>
            <h2 className="text-base font-semibold text-neutral-900 w-44 text-center">
              {MONTH_NAMES[month - 1]} {year}
            </h2>
            <button
              onClick={() => navigate(1)}
              className="p-1.5 rounded hover:bg-neutral-100 text-neutral-600"
            >
              ›
            </button>
            <button
              onClick={goToday}
              className="ml-1 text-xs px-2.5 py-1 rounded border border-neutral-200 hover:bg-neutral-50 text-neutral-600"
            >
              Today
            </button>
          </div>
          <button
            onClick={() => openNew(today)}
            className="text-sm px-3 py-1.5 bg-neutral-900 text-white rounded-md hover:bg-neutral-700"
          >
            + New event
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map((d) => (
            <div
              key={d}
              className="text-center text-xs text-neutral-600 font-medium py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 border-l border-t border-neutral-200">
          {grid.map(({ date, isCurrentMonth }, i) => {
            const dayEvents = eventsForDay(date);
            const isToday = isSameDay(date, today);
            const isSelected = selectedDay ? isSameDay(date, selectedDay) : false;

            return (
              <div
                key={i}
                onClick={() => setSelectedDay(date)}
                className={`border-r border-b border-neutral-200 p-1.5 min-h-[80px] cursor-pointer hover:bg-neutral-50 transition-colors ${
                  isSelected ? "bg-neutral-50 ring-inset ring-1 ring-neutral-400" : ""
                }`}
              >
                <div
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                    isToday
                      ? "bg-neutral-900 text-white"
                      : isCurrentMonth
                      ? "text-neutral-900"
                      : "text-neutral-500"
                  }`}
                >
                  {date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDay(date);
                        openEdit(ev);
                      }}
                      className={`text-xs px-1 py-0.5 rounded text-white truncate cursor-pointer ${
                        TYPE_COLORS[ev.sourceType === "manual" ? ev.type : ev.sourceType] ?? "bg-neutral-400"
                      }`}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-neutral-600 px-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {Object.entries(TYPE_LABEL).filter(([k]) =>
            ["MEETING", "DEADLINE", "APPROVAL_GATE", "APPOINTMENT", "MILESTONE", "TASK_DUE"].includes(k)
          ).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${TYPE_COLORS[k]}`} />
              <span className="text-xs text-neutral-500">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Day detail panel ── */}
      <div className="w-72 shrink-0">
        {selectedDay ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-neutral-700">
                {formatDateLabel(selectedDay)}
              </p>
              <button
                onClick={() => openNew(selectedDay)}
                className="text-xs text-neutral-500 hover:text-neutral-900"
              >
                + Add
              </button>
            </div>

            {selectedEvents.length === 0 ? (
              <p className="text-xs text-neutral-600 py-4 text-center">
                No events — click + Add to create one.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="border border-neutral-200 rounded-lg p-3 cursor-pointer hover:border-neutral-400 transition-colors"
                    onClick={() => ev.sourceType === "manual" && openEdit(ev)}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 ${
                          TYPE_COLORS[ev.sourceType === "manual" ? ev.type : ev.sourceType] ?? "bg-neutral-400"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-900 truncate">
                          {ev.title}
                        </p>
                        <p className="text-xs text-neutral-600 mt-0.5">
                          {ev.allDay
                            ? "All day"
                            : formatTime(ev.startAt)}
                          {" · "}
                          {TYPE_LABEL[ev.sourceType === "manual" ? ev.type : ev.sourceType] ?? ev.type}
                        </p>
                        {ev.projectId && (
                          <Link
                            href={`/projects/${ev.projectId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-blue-600 hover:underline mt-0.5 block truncate"
                          >
                            {ev.projectName}
                          </Link>
                        )}
                        {ev.description && (
                          <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                            {ev.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-neutral-600 text-center pt-12">
            Click a day to see events
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <NewEventModal
          projects={projects}
          defaultDate={modalDate}
          event={
            editingEvent && editingEvent.sourceType === "manual"
              ? {
                  id: editingEvent.id,
                  title: editingEvent.title,
                  startAt: editingEvent.startAt,
                  endAt: editingEvent.endAt,
                  allDay: editingEvent.allDay,
                  type: editingEvent.type,
                  description: editingEvent.description,
                  projectId: editingEvent.projectId,
                }
              : undefined
          }
          onClose={() => {
            setShowModal(false);
            setEditingEvent(null);
          }}
        />
      )}
    </div>
  );
}
