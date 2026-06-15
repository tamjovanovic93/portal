"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/kit";
import { logout } from "@/app/actions/auth";

const NAV: { href: string; label: string; icon: IconName; match?: string[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/clients", label: "Clients", icon: "users", match: ["/clients", "/projects"] },
  { href: "/team", label: "Team", icon: "user" },
  { href: "/weekly", label: "Weekly", icon: "target" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/materials", label: "Materials", icon: "layers" },
];

export default function AppSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside
      style={{ width: "var(--sidebar-w)", background: "var(--panel)", borderRight: "1px solid var(--border)" }}
      className="flex flex-col shrink-0 h-screen sticky top-0 z-10"
    >
      {/* wordmark */}
      <div style={{ padding: "22px 20px 18px" }} className="flex items-center gap-2.5">
        <div
          style={{ width: 30, height: 30, borderRadius: 9, background: "var(--mint)", boxShadow: "var(--mint-glow)" }}
          className="flex items-center justify-center"
        >
          <div style={{ width: 13, height: 13, borderRadius: "50%", border: "2.5px solid #04130F" }} />
        </div>
        <div>
          <div className="tech" style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.04em", lineHeight: 1 }}>
            ZER0&nbsp;P0INT
          </div>
          <div className="tech" style={{ fontSize: 9.5, letterSpacing: "0.24em", color: "var(--text-3)", marginTop: 3 }}>
            CLIENT PORTAL
          </div>
        </div>
      </div>

      <div style={{ padding: "4px 12px" }} className="flex-1 overflow-y-auto">
        <div className="eyebrow" style={{ padding: "12px 10px 8px", fontSize: 10 }}>W0RKSPACE</div>
        {NAV.map((n) => {
          const targets = n.match ?? [n.href];
          const active = targets.some((t) => pathname === t || pathname.startsWith(t + "/"));
          return (
            <Link
              key={n.href}
              href={n.href}
              className="relative flex items-center gap-2.5 text-left"
              style={{
                padding: "9px 10px",
                borderRadius: "var(--r-md)",
                marginBottom: 2,
                color: active ? "var(--text)" : "var(--text-2)",
                background: active ? "var(--surface-2)" : "transparent",
                fontWeight: active ? 600 : 500,
                fontSize: 13.5,
              }}
            >
              {active && (
                <span
                  style={{ position: "absolute", left: -12, top: 9, bottom: 9, width: 3, borderRadius: 3, background: "var(--mint)" }}
                />
              )}
              <Icon name={n.icon} size={18} style={{ color: active ? "var(--mint)" : "var(--text-3)" }} />
              {n.label}
            </Link>
          );
        })}
      </div>

      {/* user */}
      <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5" style={{ padding: "8px" }}>
          <Avatar name={userEmail} size={32} />
          <div className="min-w-0 flex-1">
            <div style={{ fontSize: 13, fontWeight: 600 }} className="truncate">{userEmail}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>ZER0 P0INT team</div>
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="btn btn-sm btn-ghost w-full justify-start"
            style={{ marginTop: 4 }}
          >
            <Icon name="external" size={15} /> Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
