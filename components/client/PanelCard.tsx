import type { ReactNode } from "react";
import Link from "next/link";
import { cx } from "@/components/ui/cx";

// The client portal's standard card: an eyebrow header with an optional
// right-hand link, then a divided list of rows. Used by the Documents, Brand,
// Files, Project info, Latest work and Recent panels.

export function PanelCard({
  title,
  action,
  count,
  children,
  className,
}: {
  title: string;
  action?: { label: string; href: string };
  count?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("card overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <span className="eyebrow">{title}</span>
        {action ? (
          <Link href={action.href} className="text-xs font-medium text-mint hover:underline shrink-0">
            {action.label} →
          </Link>
        ) : count !== undefined ? (
          <span className="text-xs text-ink-3 shrink-0">{count}</span>
        ) : null}
      </div>
      {children ? <div className="border-t border-line divide-y divide-line">{children}</div> : null}
    </section>
  );
}

// One row inside a PanelCard. Becomes a link when `href` is given; `children`
// replaces the label/value pair entirely for rows that hold their own content.
export function PanelRow({
  href,
  label,
  sub,
  right,
  children,
}: {
  href?: string;
  label?: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const body = children ?? (
    <>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink truncate">{label}</p>
        {sub ? <p className="text-xs text-ink-3 mt-0.5 truncate">{sub}</p> : null}
      </div>
      {right ? <div className="shrink-0 text-xs text-ink-2">{right}</div> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2 transition-colors">
        {body}
      </Link>
    );
  }
  return <div className="flex items-center justify-between gap-3 px-5 py-3">{body}</div>;
}
