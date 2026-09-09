"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { VAR, FILL, type Accent } from "@/components/ui/kit";

export type TileItem = { key: string; label: string; sub?: string; href?: string; dot?: Accent };
export type StatTile = {
  key: string;
  n: number;
  label: string;
  color: Accent;
  icon: string;
  items: TileItem[];
};

// Dashboard overview tiles. Each tile with a count is clickable and expands a
// panel below the row listing what's behind the number (projects, things that
// need you, client activity, upcoming). One open at a time.
export default function StatTiles({ tiles }: { tiles: StatTile[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = tiles.find((t) => t.key === openKey) ?? null;

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {tiles.map((s) => {
          const clickable = s.n > 0;
          const isOpen = openKey === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => clickable && setOpenKey(isOpen ? null : s.key)}
              className="card flex items-center gap-4 text-left"
              style={{
                padding: "18px 20px",
                cursor: clickable ? "pointer" : "default",
                borderColor: isOpen ? VAR[s.color] : undefined,
                width: "100%",
              }}
              aria-expanded={isOpen}
            >
              <div
                style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: FILL[s.color], color: VAR[s.color] }}
                className="flex items-center justify-center"
              >
                <Icon name={s.icon} size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="figure" style={{ fontSize: 30, color: VAR[s.color], lineHeight: 1 }}>{String(s.n).padStart(2, "0")}</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{s.label}</div>
              </div>
              {clickable && (
                <span className="faint" style={{ fontSize: 11, flexShrink: 0, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▸</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Expansion panel — what's behind the open tile */}
      {open && (
        <div className="card card-pad">
          <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
            <Icon name={open.icon} size={15} style={{ color: VAR[open.color] }} />
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>{open.label}</span>
            <span className="tech" style={{ fontSize: 11, color: VAR[open.color], marginLeft: 2 }}>{String(open.n).padStart(2, "0")}</span>
            <button type="button" onClick={() => setOpenKey(null)} className="faint" style={{ marginLeft: "auto", fontSize: 11.5, cursor: "pointer", background: "transparent", border: 0 }}>
              Close
            </button>
          </div>
          {open.items.length === 0 ? (
            <p className="faint" style={{ fontSize: 12.5 }}>Nothing here right now.</p>
          ) : (
            <div className="flex flex-col" style={{ gap: 2 }}>
              {open.items.slice(0, 40).map((it) => {
                const dot = it.dot ?? open.color;
                const body = (
                  <span className="flex items-start gap-2.5" style={{ padding: "7px 8px", borderRadius: "var(--r-md)", width: "100%" }}>
                    <span style={{ marginTop: 5, width: 7, height: 7, borderRadius: "50%", background: VAR[dot], flexShrink: 0 }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 12.5, lineHeight: 1.4, display: "block" }}>{it.label}</span>
                      {it.sub && <span className="faint truncate" style={{ fontSize: 11, display: "block" }}>{it.sub}</span>}
                    </span>
                  </span>
                );
                return it.href ? (
                  <Link key={it.key} href={it.href} className="hover-row" style={{ display: "block" }}>{body}</Link>
                ) : (
                  <div key={it.key}>{body}</div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
