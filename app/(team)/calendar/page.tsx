import { prisma } from "@/lib/prisma";
import CalendarView, { CalendarEvent } from "@/components/team/calendar/CalendarView";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = parseInt((sp.year as string) ?? String(now.getFullYear()));
  const month = parseInt((sp.month as string) ?? String(now.getMonth() + 1));

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const [manualEvents, tasks, materials, cycles, projects] = await Promise.all([
    prisma.appEvent.findMany({
      where: { startAt: { gte: startOfMonth, lte: endOfMonth } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { startAt: "asc" },
    }),
    prisma.task.findMany({
      where: {
        dueDate: { gte: startOfMonth, lte: endOfMonth },
        status: { not: "DONE" },
      },
      include: {
        cycle: {
          include: { project: { select: { id: true, name: true } } },
        },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.materialItem.findMany({
      where: {
        dueDate: { gte: startOfMonth, lte: endOfMonth },
        status: { in: ["pending", "submitted"] },
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.cycle.findMany({
      where: {
        status: "ACTIVE",
        endDate: { gte: startOfMonth, lte: endOfMonth },
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { endDate: "asc" },
    }),
    prisma.project.findMany({
      where: { isArchived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const events: CalendarEvent[] = [
    ...manualEvents.map((e) => ({
      id: e.id,
      title: e.title,
      startAt: e.startAt,
      endAt: e.endAt,
      allDay: e.allDay,
      type: e.type,
      description: e.description,
      projectId: e.projectId,
      projectName: e.project?.name ?? null,
      sourceType: "manual" as const,
    })),
    ...tasks.map((t) => ({
      id: `task-${t.id}`,
      title: t.name,
      startAt: t.dueDate!,
      endAt: null,
      allDay: true,
      type: "TASK_DUE",
      description: t.description ?? null,
      projectId: t.cycle.project.id,
      projectName: t.cycle.project.name,
      sourceType: "task" as const,
    })),
    ...materials.map((m) => ({
      id: `material-${m.id}`,
      title: `${m.label} due`,
      startAt: m.dueDate!,
      endAt: null,
      allDay: true,
      type: "DEADLINE",
      description: m.notes ?? null,
      projectId: m.projectId,
      projectName: m.project.name,
      sourceType: "material" as const,
    })),
    ...cycles.map((c) => ({
      id: `cycle-${c.id}`,
      title: `${c.name} ends`,
      startAt: c.endDate!,
      endAt: null,
      allDay: true,
      type: "MILESTONE",
      description: null,
      projectId: c.project.id,
      projectName: c.project.name,
      sourceType: "cycle" as const,
    })),
  ];

  return (
    <div className="p-8 h-full">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Calendar</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Events, deadlines, and project milestones
        </p>
      </div>
      <CalendarView
        year={year}
        month={month}
        events={events}
        projects={projects}
      />
    </div>
  );
}
