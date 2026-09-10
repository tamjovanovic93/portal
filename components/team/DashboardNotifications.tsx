"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markAllNotificationsRead } from "@/app/actions/notifications";
import { Eyebrow, Pill } from "@/components/ui/kit";

export type DashNotification = {
  id: string;
  type: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// Top-of-dashboard feed of everything clients have sent back to the team
// (answers, approvals, submitted forms, uploads, questions). Sourced from the
// Notification table so any client → team action shows up here.
export default function DashboardNotifications({ items }: { items: DashNotification[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const unread = items.filter((n) => !n.readAt).length;

  if (items.length === 0) return null;

  function markRead() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <div className="fade-up">
      <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
        <Eyebrow style={{ margin: 0 }}>N0TIFICATIONS</Eyebrow>
        {unread > 0 && <Pill color="blue">{unread} new</Pill>}
        <div className="flex-1" />
        {unread > 0 && (
          <button
            type="button"
            onClick={markRead}
            disabled={isPending}
            className="faint"
            style={{ fontSize: 11.5, cursor: "pointer", background: "transparent", border: 0 }}
          >
            {isPending ? "Marking…" : "Mark all read"}
          </button>
        )}
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        {items.slice(0, 8).map((n, i) => {
          const body = (
            <div className="flex items-center gap-3" style={{ padding: "11px 18px" }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: n.readAt ? "var(--text-4)" : "var(--blue)",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 13, flex: 1 }} className="truncate">{n.message}</span>
              <span className="faint" style={{ fontSize: 11.5, flexShrink: 0 }}>{timeAgo(n.createdAt)}</span>
            </div>
          );
          const style = { borderTop: i ? "1px solid var(--border)" : "none" } as const;
          return n.link ? (
            <Link key={n.id} href={n.link} className="block hover:opacity-80" style={style}>
              {body}
            </Link>
          ) : (
            <div key={n.id} style={style}>{body}</div>
          );
        })}
      </div>
    </div>
  );
}
