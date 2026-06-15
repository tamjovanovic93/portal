import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Eyebrow, Pill, Avatar, VAR, type Accent } from "@/components/ui/kit";

type WeekItem = {
  id: string;
  title: string;
  sub: string;
  href: string;
  accent: Accent;
  kind: string;
  who?: string;
  at: Date;
};

export default async function WeeklyPage() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // 0 = Monday
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - dow);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [tasks, materials, events] = await Promise.all([
    prisma.task.findMany({
      where: { dueDate: { gte: weekStart, lt: weekEnd }, status: { not: "DONE" } },
      include: {
        assignee: { select: { name: true, email: true } },
        cycle: { include: { project: { select: { id: true, name: true } } } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.materialItem.findMany({
      where: { dueDate: { gte: weekStart, lt: weekEnd }, status: { in: ["pending", "submitted"] } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.appEvent.findMany({
      where: { startAt: { gte: weekStart, lt: weekEnd } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { startAt: "asc" },
    }),
  ]);

  const items: WeekItem[] = [
    ...tasks.map((t) => ({
      id: `task-${t.id}`,
      title: t.name,
      sub: t.cycle.project.name,
      href: `/projects/${t.cycle.project.id}`,
      accent: (t.isBlocker && !t.unblockedAt ? "rose" : "mint") as Accent,
      kind: t.isBlocker ? "Blocker" : "Task",
      who: t.assignee?.name ?? t.assignee?.email ?? undefined,
      at: t.dueDate!,
    })),
    ...materials.map((m) => ({
      id: `mat-${m.id}`,
      title: `${m.label} due`,
      sub: m.project.name,
      href: `/projects/${m.project.id}/materials`,
      accent: "amber" as Accent,
      kind: "Material",
      at: m.dueDate!,
    })),
    ...events.map((e) => ({
      id: `evt-${e.id}`,
      title: e.title,
      sub: e.project?.name ?? "—",
      href: e.project ? `/projects/${e.project.id}` : "/calendar",
      accent: "blue" as Accent,
      kind: "Event",
      at: e.startAt,
    })),
  ];

  // bucket into 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const byDay = days.map((d) => ({
    date: d,
    isToday: d.toDateString() === new Date().toDateString(),
    items: items
      .filter((it) => it.at.toDateString() === d.toDateString())
      .sort((a, b) => a.at.getTime() - b.at.getTime()),
  }));

  const blockerCount = items.filter((i) => i.kind === "Blocker").length;
  const rangeLabel = `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 1100, margin: "0 auto" }} className="space-y-6">
      <div className="fade-up flex items-end justify-between gap-5">
        <div>
          <Eyebrow style={{ marginBottom: 10 }}>THIS WEEK · {rangeLabel.toUpperCase()}</Eyebrow>
          <h1 className="page-title" style={{ fontSize: 32 }}>Weekly plan</h1>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 14.5 }}>
            {items.length} item{items.length !== 1 ? "s" : ""} due this week
            {blockerCount > 0 && <> · <span style={{ color: "var(--rose)" }}>{blockerCount} blocker{blockerCount !== 1 ? "s" : ""}</span></>}
          </p>
        </div>
      </div>

      <div className="fade-up space-y-3">
        {byDay.map(({ date, isToday, items: dayItems }) => (
          <div key={date.toISOString()} className="card" style={{ overflow: "hidden", borderColor: isToday ? "color-mix(in srgb, var(--mint) 30%, transparent)" : "var(--border)" }}>
            <div className="flex items-center gap-3" style={{ padding: "12px 18px", borderBottom: dayItems.length ? "1px solid var(--border)" : "none" }}>
              <div className="tech" style={{ fontSize: 11, letterSpacing: "0.08em", color: isToday ? "var(--mint)" : "var(--text-3)", width: 90 }}>
                {date.toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase()}
              </div>
              <div className="figure" style={{ fontSize: 15, color: isToday ? "var(--mint)" : "var(--text-2)" }}>
                {date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </div>
              {isToday && <Pill color="mint" glow>TODAY</Pill>}
              <div className="flex-1" />
              {dayItems.length > 0 && <span className="faint tech" style={{ fontSize: 11 }}>{dayItems.length}</span>}
            </div>
            {dayItems.length === 0 ? (
              <p className="faint" style={{ padding: "10px 18px", fontSize: 12.5 }}>Nothing scheduled.</p>
            ) : (
              dayItems.map((it, i) => (
                <Link key={it.id} href={it.href} className="flex items-center gap-3" style={{ padding: "11px 18px", borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <span style={{ width: 2, alignSelf: "stretch", borderRadius: 2, background: VAR[it.accent] }} />
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13 }} className="truncate">{it.title}</p>
                    <p className="faint" style={{ fontSize: 11.5 }}>{it.sub}</p>
                  </div>
                  {it.who && <Avatar name={it.who} size={22} />}
                  <Pill color={it.accent}>{it.kind}</Pill>
                </Link>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
