import type { ReactNode } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

// "We need from you" — the one card a client should never be able to miss.
// The header bar is painted inline rather than with a bg-* utility: the
// semantic colour classes are !important, so a class would win over the inline
// value and the two would fight. Nothing here uses text-ink for the same reason.

export function ActionCard({
  title = "We need from you",
  count,
  children,
}: {
  title?: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section
      className="card overflow-hidden"
      style={{ borderColor: "color-mix(in srgb, var(--mint) 35%, transparent)" }}
    >
      <div
        className="flex items-center justify-between gap-3 px-5 py-4"
        style={{ background: "var(--mint-deep)" }}
      >
        <span className="flex items-center gap-2.5">
          <span
            className="rounded-full shrink-0"
            style={{ width: 7, height: 7, background: "var(--amber)" }}
          />
          <span className="eyebrow" style={{ color: "#fff" }}>{title}</span>
        </span>
        <span className="figure" style={{ color: "#fff", fontSize: 20 }}>{count}</span>
      </div>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

// A single thing the client has to do. Either a link with a call to action, or
// a wrapper around an interactive component (ApproveButton, MaterialItem, …).
export function ActionRow({
  href,
  eyebrow,
  label,
  sub,
  cta,
  children,
}: {
  href?: string;
  eyebrow?: string;
  label?: string;
  sub?: string;
  cta?: string;
  children?: ReactNode;
}) {
  if (children) return <div className="px-5 py-4">{children}</div>;

  return (
    <Link href={href ?? "#"} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2 transition-colors group">
      <span className="flex-1 min-w-0">
        {eyebrow ? <span className="eyebrow block">{eyebrow}</span> : null}
        <span className="block text-sm font-medium text-ink truncate group-hover:underline">{label}</span>
        {sub ? <span className="block text-xs text-ink-3 mt-0.5 truncate">{sub}</span> : null}
      </span>
      {cta ? <span className="text-xs font-medium text-mint shrink-0">{cta}</span> : null}
      <Icon name="chevR" size={14} style={{ color: "var(--text-3)", flexShrink: 0 }} />
    </Link>
  );
}
