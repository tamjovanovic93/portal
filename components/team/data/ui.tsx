import type { CSSProperties, ReactNode } from "react";

// ─── Presentational primitives for the Data page ─────────────────────────────
// Server components (no client state). Native <details> handles progressive
// disclosure. Styled with the existing Zero Point tokens (pill, eyebrow, --mint…).

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));

// ── Chip / Chips ──
export function Chip({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <span
      className="pill"
      style={
        accent
          ? {
              color: "var(--mint)",
              background: "var(--mint-fill)",
              borderColor: "color-mix(in srgb, var(--mint) 40%, transparent)",
            }
          : undefined
      }
    >
      {children}
    </span>
  );
}

export type ChipItem = string | { label: string; accent?: boolean };

export function Chips({ items }: { items: ChipItem[] }) {
  const norm = items
    .map((i) => (typeof i === "string" ? { label: i } : i))
    .filter((i) => i.label && i.label.trim());
  if (norm.length === 0) return null;
  return (
    <div className="flex flex-wrap" style={{ gap: 6 }}>
      {norm.map((i, k) => (
        <Chip key={k} accent={i.accent}>
          {i.label}
        </Chip>
      ))}
    </div>
  );
}

// ── Disclosure (progressive disclosure) ──
export function Disclosure({
  summary,
  children,
  style,
  open,
}: {
  summary: string;
  children: ReactNode;
  style?: CSSProperties;
  open?: boolean;
}) {
  return (
    <details style={style} open={open}>
      <summary
        style={{
          cursor: "pointer",
          fontSize: 12.5,
          fontWeight: 500,
          color: "var(--text-3)",
          userSelect: "none",
          listStyle: "none",
          padding: "6px 0",
        }}
      >
        {summary} ↓
      </summary>
      <div style={{ marginTop: 8 }}>{children}</div>
    </details>
  );
}

// ── Insight card (label + qualitative value, subtle left rule, optional accent) ──
export function InsightCard({
  label,
  value,
  accent,
  details,
}: {
  label: string;
  value?: ReactNode;
  accent?: boolean;
  details?: ReactNode;
}) {
  const hasValue = value != null && value !== "";
  if (!hasValue && !details) return null;
  return (
    <div style={{ borderLeft: `2px solid ${accent ? "var(--mint)" : "var(--border-2)"}`, paddingLeft: 14 }}>
      <div className="eyebrow" style={{ marginBottom: 4, color: accent ? "var(--mint)" : undefined }}>
        {label}
      </div>
      {hasValue && <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text)" }}>{value}</div>}
      {details && <div style={{ marginTop: 6 }}>{details}</div>}
    </div>
  );
}

// ── Section snapshot (title + summary + chips + highlight cards) ──
export function Snapshot({
  title,
  summary,
  chips,
  children,
}: {
  title: string;
  summary?: ReactNode;
  chips?: ChipItem[];
  children?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="page-title" style={{ fontSize: 22 }}>{title}</h2>
        {summary && (
          <p style={{ fontSize: 14, color: "var(--text-2)", marginTop: 4, maxWidth: 660, lineHeight: 1.5 }}>
            {summary}
          </p>
        )}
      </div>
      {chips && chips.length > 0 && <Chips items={chips} />}
      {children && (
        <div
          className="grid gap-x-8 gap-y-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: 6 }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── Small section heading with an optional count ──
export function GroupHeading({ children, count }: { children: ReactNode; count?: string | number }) {
  return (
    <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
      <span className="eyebrow">{children}</span>
      {count != null && count !== "" && (
        <span className="faint" style={{ fontSize: 11.5 }}>· {count}</span>
      )}
    </div>
  );
}

// ── Persona card (audience redesign) ──
export function PersonaCard({ persona }: { persona: Row }) {
  const name = str(persona.persona_name) || "Persona";
  const identity = [
    str(persona.gender),
    str(persona.age_range),
    str(persona.location),
    str(persona.income_level),
  ].filter(Boolean);
  const coreValues = str(persona.core_values)
    .split(/[·,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const pains = (persona.pain_points as Row[]) ?? [];
  const needs = (persona.needs as Row[]) ?? [];
  const objections = (persona.objections as Row[]) ?? [];

  return (
    <section className="card" style={{ padding: "18px 20px" }}>
      <div className="space-y-4">
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>{name}</h3>
          {identity.length > 0 && (
            <div className="flex flex-wrap" style={{ gap: 6, marginTop: 8 }}>
              {identity.map((v, i) => (
                <Chip key={i}>{v}</Chip>
              ))}
            </div>
          )}
        </div>

        {coreValues.length > 0 && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Core values</div>
            <p style={{ fontSize: 13.5, color: "var(--text)" }}>{coreValues.join(" · ")}</p>
          </div>
        )}

        {pains.length > 0 && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Pain points</div>
            <div className="space-y-2">
              {pains.map((p, i) => {
                const sev = Number(p.severity) || 0;
                const high = sev >= 4;
                return (
                  <div key={i} style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                    {sev > 0 && (
                      <span style={{ color: high ? "var(--mint)" : "var(--text-3)", fontWeight: 600, marginRight: 8 }}>
                        {sev}/5
                      </span>
                    )}
                    <span style={{ color: "var(--text)" }}>{str(p.pain_description)}</span>
                    {str(p.strategic_implication) && (
                      <Disclosure summary="Strategic implication">
                        <p style={{ fontSize: 13, color: "var(--text-2)" }}>{str(p.strategic_implication)}</p>
                      </Disclosure>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {needs.length > 0 && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Needs</div>
            <div className="space-y-2">
              {needs.map((n, i) => {
                const pri = Number(n.priority) || 0;
                return (
                  <div key={i} style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                    <span style={{ color: "var(--text-3)", marginRight: 8 }}>
                      {pri > 0 ? `${pri}/5` : ""}
                      {str(n.need_type) ? ` · ${str(n.need_type)}` : ""}
                    </span>
                    <span style={{ color: "var(--text)" }}>{str(n.need_description)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {objections.length > 0 && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Objections</div>
            <div className="space-y-2.5">
              {objections.map((o, i) => (
                <div key={i} style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                  {str(o.objection_type) && (
                    <p style={{ fontWeight: 600, color: "var(--text)" }}>{str(o.objection_type)}</p>
                  )}
                  <p style={{ color: "var(--text)" }}>{str(o.objection_text)}</p>
                  {str(o.response_text) && (
                    <p style={{ color: "var(--text-2)", marginTop: 2 }}>
                      <span className="faint">Response: </span>
                      {str(o.response_text)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
