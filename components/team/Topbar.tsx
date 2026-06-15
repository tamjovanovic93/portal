"use client";

import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";

// Derive a simple breadcrumb from the path. Pages still render their own titles;
// this is the persistent chrome bar from the design.
const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  clients: "Clients",
  projects: "Projects",
  team: "Team",
  weekly: "Weekly plan",
  calendar: "Calendar",
  materials: "Materials",
  brief: "Client brief",
};

export default function Topbar() {
  const pathname = usePathname();
  const segs = pathname.split("/").filter(Boolean);
  const crumbs = segs.slice(0, 2).map((s) => LABELS[s] ?? (s.length > 14 ? "Detail" : s));

  return (
    <header
      className="flex items-center gap-3.5 sticky top-0 z-[9]"
      style={{
        height: 60,
        flexShrink: 0,
        background: "color-mix(in srgb, var(--bg) 82%, transparent)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 26px",
      }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {(crumbs.length ? crumbs : ["Dashboard"]).map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && <Icon name="chevR" size={14} style={{ color: "var(--text-4)" }} />}
            <span
              style={{
                fontSize: 13.5,
                fontWeight: i === crumbs.length - 1 ? 600 : 500,
                color: i === crumbs.length - 1 ? "var(--text)" : "var(--text-3)",
              }}
            >
              {c}
            </span>
          </div>
        ))}
      </div>
      <button className="btn btn-sm btn-ghost" style={{ color: "var(--text-3)", paddingLeft: 10 }}>
        <Icon name="search" size={16} /> Search
        <span
          className="mono"
          style={{ marginLeft: 6, padding: "1px 5px", borderRadius: 5, border: "1px solid var(--border-2)", fontSize: 10.5, color: "var(--text-4)" }}
        >
          ⌘K
        </span>
      </button>
      <button className="btn btn-icon btn-sm btn-ghost relative">
        <Icon name="bell" size={17} />
        <span
          className="live-dot"
          style={{ position: "absolute", top: 5, right: 6, width: 6, height: 6, borderRadius: "50%", background: "var(--mint)" }}
        />
      </button>
    </header>
  );
}
