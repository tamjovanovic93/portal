"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";

// Client portal navigation. Plain links, never Buttons — tabs and nav stay
// plain elements (see docs/ARCHITECTURE.md). Only the active state needs the
// client boundary, so the layout itself stays a server component.

type NavItem = {
  href: string;
  label: string;
  // Matched exactly rather than by prefix (every route starts with /portal).
  exact?: boolean;
  // Sub-routes that belong to this item but live outside its path.
  also?: string[];
};

const NAV: NavItem[] = [
  { href: "/portal", label: "Home", exact: true },
  {
    href: "/portal/projects",
    label: "Projects",
    also: ["/portal/brief", "/portal/wireframes", "/portal/design", "/portal/documents"],
  },
  { href: "/portal/messages", label: "Messages" },
  { href: "/portal/files", label: "Files" },
];

export default function PortalNav({ mobile }: { mobile?: boolean }) {
  const pathname = usePathname();

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname.startsWith(item.href) || (item.also ?? []).some((p) => pathname.startsWith(p));

  return (
    <nav
      className={cx(
        "flex items-center gap-1",
        mobile && "overflow-x-auto border-t border-line px-4 py-1.5"
      )}
    >
      {NAV.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "bg-mint-fill text-mint" : "text-ink-2 hover:text-ink hover:bg-surface-2"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
