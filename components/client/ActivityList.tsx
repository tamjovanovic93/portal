import { timeAgo } from "@/lib/format";

export type ActivityItem = { key: string; label: string; at: Date };

// "Recent" — a quiet, unboxed list of what has happened lately. Derived from
// approvals, shared uploads, completed stages and submitted documents; there is
// no activity-log table to read.

export default function ActivityList({
  items,
  now,
  title = "Recent",
}: {
  items: ActivityItem[];
  now: Date;
  title?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <span className="eyebrow">{title}</span>
      <ul className="mt-3 space-y-2.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-ink-2 min-w-0 truncate">{item.label}</span>
            <span className="text-xs text-ink-3 shrink-0">{timeAgo(item.at, now)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
