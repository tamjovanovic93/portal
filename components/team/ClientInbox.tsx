"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { Pill } from "@/components/ui/kit";
import { markNotificationSeen } from "@/app/actions/notifications";

export type ClientInboxItem = {
  id: string;
  type: string;
  message: string;
  link: string | null;
  projectName: string | null;
  createdAt: string;
};

// Dashboard "From clients" card — new inbound client activity (answers,
// confirmations, approvals, completed forms). Reads the shared team Notification
// records (recipientRole=TEAM). Expand/collapse uses a native <details> so it
// works without JS; "Mark seen" clears an item for the whole team, so leave the
// ones that aren't yours to handle.
export default function ClientInbox({ items }: { items: ClientInboxItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const count = items.length;
  const badge = count > 99 ? "99+" : String(count).padStart(2, "0");

  function markSeen(id: string) {
    start(async () => {
      await markNotificationSeen(id);
      router.refresh();
    });
  }

  return (
    <details className="card group" open style={{ overflow: "hidden" }}>
      <summary
        className="flex items-center gap-2 list-none select-none"
        style={{ cursor: "pointer", padding: "18px 20px" }}
      >
        <Icon name="bell" size={15} style={{ color: "var(--mint)" }} />
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>From clients</span>
        {count > 0 && <Pill color="mint" style={{ marginLeft: "auto" }}>{badge}</Pill>}
        <span
          className="faint group-open:rotate-90"
          style={{ fontSize: 10, marginLeft: count > 0 ? 6 : "auto", transition: "transform .15s" }}
        >
          ▸
        </span>
      </summary>

      <div style={{ padding: "0 20px 18px" }}>
        {count === 0 ? (
          <p className="faint" style={{ fontSize: 12.5 }}>Nothing new from clients.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-2.5"
                style={{ padding: "8px", borderRadius: "var(--r-md)", background: "var(--surface-2)" }}
              >
                <span style={{ marginTop: 5, width: 7, height: 7, borderRadius: "50%", background: "var(--mint)", flexShrink: 0 }} />
                <div className="min-w-0 flex-1">
                  {n.link ? (
                    <Link href={n.link} style={{ fontSize: 12.5, lineHeight: 1.4, display: "block" }}>
                      {n.message}
                    </Link>
                  ) : (
                    <p style={{ fontSize: 12.5, lineHeight: 1.4 }}>{n.message}</p>
                  )}
                  <p className="faint" style={{ fontSize: 11, marginTop: 2 }} suppressHydrationWarning>
                    {n.projectName ? `${n.projectName} · ` : ""}
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => markSeen(n.id)}
                  className="btn btn-sm btn-ghost"
                  style={{ flexShrink: 0 }}
                  title="Mark seen for the whole team"
                >
                  Mark seen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
