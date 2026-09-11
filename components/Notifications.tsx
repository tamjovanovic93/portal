"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead, markNotificationSeen } from "@/app/actions/notifications";

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

// Types that stay in an attention state until the underlying item is actually
// viewed — opening the dropdown does not clear them.
const ATTENTION_TYPES = new Set(["offer_question"]);

export default function Notifications({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.readAt).length;
  // Unviewed attention items (e.g. client offer questions) drive a persistent,
  // pulsing indicator that survives opening the dropdown.
  const attention = items.filter((n) => !n.readAt && ATTENTION_TYPES.has(n.type)).length;

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
    // Opening clears ordinary unread notifications, but attention items remain
    // until their question is actually viewed (clicked).
    if (next && unread - attention > 0) {
      startTransition(async () => {
        await markAllNotificationsRead();
        router.refresh();
      });
    }
  }

  // Viewing an attention item (clicking through to the question) clears it.
  function viewAttention(id: string) {
    setOpen(false);
    startTransition(async () => {
      await markNotificationSeen(id);
      router.refresh();
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        className={`relative flex items-center justify-center w-9 h-9 rounded-md border text-neutral-700 transition-colors ${
          attention > 0
            ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 animate-pulse"
            : "border-neutral-300 hover:bg-neutral-50"
        }`}
      >
        <svg className="w-4.5 h-4.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-white text-[10px] font-semibold flex items-center justify-center ${
              attention > 0 ? "bg-amber-500 ring-2 ring-amber-200" : "bg-red-500"
            }`}
          >
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
                const isAttention = ATTENTION_TYPES.has(n.type) && !n.readAt;
                const body = (
                  <div className={`flex items-start gap-2.5 px-4 py-3 ${isAttention ? "bg-amber-50" : ""}`}>
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        isAttention ? "bg-amber-500 animate-pulse" : n.readAt ? "bg-transparent" : "bg-blue-500"
                      }`}
                    />
                    <div className="min-w-0">
                      {isAttention && (
                        <span className="inline-block mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                          New question — needs a look
                        </span>
                      )}
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
                        onClick={() => (isAttention ? viewAttention(n.id) : setOpen(false))}
                        className={`block transition-colors ${isAttention ? "hover:bg-amber-100" : "hover:bg-neutral-50"}`}
                      >
                        {body}
                      </Link>
                    ) : isAttention ? (
                      <button type="button" onClick={() => viewAttention(n.id)} className="block w-full text-left hover:bg-amber-100 transition-colors">
                        {body}
                      </button>
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
