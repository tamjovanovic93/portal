"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "@/app/actions/notifications";

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export default function Notifications({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.readAt).length;

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      startTransition(async () => {
        await markAllNotificationsRead();
        router.refresh();
      });
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-9 h-9 rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition-colors"
      >
        <svg className="w-4.5 h-4.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-xl z-50">
          <div className="px-4 py-2.5 border-b border-neutral-100">
            <p className="text-sm font-semibold text-neutral-900">Notifications</p>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-sm text-neutral-500 text-center">
              No notifications yet.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {items.map((n) => {
                const body = (
                  <div className="flex items-start gap-2.5 px-4 py-3">
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        n.readAt ? "bg-transparent" : "bg-blue-500"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-neutral-800">{n.message}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => setOpen(false)}
                        className="block hover:bg-neutral-50 transition-colors"
                      >
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
