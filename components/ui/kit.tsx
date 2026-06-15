import type { CSSProperties, ReactNode } from "react";

// Accent colors map to the theme CSS vars, so they resolve correctly under
// either .theme-dark or .theme-light.
export type Accent = "mint" | "amber" | "purple" | "rose" | "blue";

export const VAR: Record<Accent, string> = {
  mint: "var(--mint)",
  amber: "var(--amber)",
  purple: "var(--purple)",
  rose: "var(--rose)",
  blue: "var(--blue)",
};
export const FILL: Record<Accent, string> = {
  mint: "var(--mint-fill)",
  amber: "var(--amber-fill)",
  purple: "var(--purple-fill)",
  rose: "var(--rose-fill)",
  blue: "var(--blue-fill)",
};

const AVATAR_COLORS: Accent[] = ["mint", "amber", "purple", "rose", "blue"];

export function hashAccent(seed: string): Accent {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ── Eyebrow ──
export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="eyebrow" style={style}>{children}</div>;
}

// ── Pill ──
export function Pill({
  color,
  glow,
  children,
  style,
}: {
  color?: Accent | null;
  glow?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span className={`pill ${color ? "pill-" + color : ""} ${glow ? "glow" : ""}`} style={style}>
      {children}
    </span>
  );
}

export function StatusPill({ label, color = "mint" }: { label: string; color?: Accent }) {
  return (
    <Pill color={color}>
      <span className="dot" />
      {label}
    </Pill>
  );
}

// ── Avatar (initials-based stub) ──
export function Avatar({
  name,
  color,
  size = 28,
  ring = true,
  photo,
}: {
  name: string;
  color?: Accent;
  size?: number;
  ring?: boolean;
  photo?: string;
}) {
  const c = color ?? hashAccent(name);
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        title={name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: ring ? `1px solid ${VAR[c]}` : "none",
          background: FILL[c],
          flexShrink: 0,
          display: "block",
        }}
      />
    );
  }
  return (
    <div
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: FILL[c],
        color: VAR[c],
        border: ring ? `1px solid ${VAR[c]}` : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--f-tech)",
        fontWeight: 600,
        fontSize: size * 0.36,
        letterSpacing: "0.02em",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

export function AvatarStack({ names, size = 26 }: { names: string[]; size?: number }) {
  return (
    <div style={{ display: "flex" }}>
      {names.map((n, i) => (
        <div
          key={n + i}
          style={{ marginLeft: i ? -8 : 0, boxShadow: "0 0 0 2px var(--surface)", borderRadius: "50%" }}
        >
          <Avatar name={n} size={size} />
        </div>
      ))}
    </div>
  );
}

// ── Health bar ──
export function Health({
  value,
  color = "mint",
  w = 60,
}: {
  value: number;
  color?: Accent;
  w?: number | string;
}) {
  return (
    <div className="track" style={{ width: w }}>
      <span style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, background: VAR[color] }} />
    </div>
  );
}

// ── Stage stepper (current is a zero-based index) ──
export function StageBar({
  stages,
  current,
  compact,
}: {
  stages: string[];
  current: number;
  compact?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      {stages.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s + i} style={{ display: "contents" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, flexShrink: 0 }}>
              <div
                style={{
                  width: active ? 13 : 11,
                  height: active ? 13 : 11,
                  borderRadius: "50%",
                  background: done ? "var(--mint)" : "transparent",
                  border: `2px solid ${active || done ? "var(--mint)" : "var(--border-3)"}`,
                  boxShadow: active ? "0 0 12px -2px var(--mint)" : "none",
                }}
              />
              {!compact && (
                <span
                  className="tech"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: active ? "var(--mint)" : done ? "var(--text-2)" : "var(--text-4)",
                    fontWeight: active ? 600 : 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {s}
                </span>
              )}
            </div>
            {i < stages.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  margin: "0 -1px",
                  marginBottom: compact ? 0 : 22,
                  background: i < current ? "var(--mint)" : "var(--border-2)",
                  minWidth: 12,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
