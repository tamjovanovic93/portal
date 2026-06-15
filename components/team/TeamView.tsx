"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { Avatar, Pill, Health, VAR, type Accent } from "@/components/ui/kit";
import { TEAM_MEMBERS, CONTENT_TEAM, type StaticMember } from "@/lib/team-static";

function capColor(v: number): Accent {
  return v > 0.85 ? "rose" : v > 0.7 ? "amber" : "mint";
}
function capLabel(v: number): string {
  return v > 0.85 ? "At capacity" : v > 0.7 ? "Busy" : "Has room";
}

export default function TeamView() {
  const [sel, setSel] = useState<string>(TEAM_MEMBERS[0]?.id ?? "content");

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 1320, margin: "0 auto" }}>
      <div className="fade-up flex items-end justify-between gap-5" style={{ marginBottom: 24 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>THE TEAM</div>
          <h1 className="page-title" style={{ fontSize: 32 }}>One team, one point of contact</h1>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 14.5, maxWidth: 560 }}>
            Four people own every engagement end-to-end, backed by a dedicated content team.
          </p>
        </div>
        <button className="btn btn-primary"><Icon name="plus" size={16} /> Invite member</button>
      </div>

      {/* roster */}
      <div className="fade-up grid gap-3.5" style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 26 }}>
        {TEAM_MEMBERS.map((m) => {
          const active = sel === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSel(m.id)}
              className="card flex flex-col items-center"
              style={{
                padding: "16px 14px 18px", gap: 12, cursor: "pointer",
                borderColor: active ? VAR[m.catColor] : "var(--border)",
                background: active ? "var(--feature-grad)" : "var(--surface)",
                boxShadow: active ? `var(--shadow), 0 0 26px -10px ${VAR[m.catColor]}` : "var(--shadow)",
              }}
            >
              <div style={{ alignSelf: "flex-start" }}>
                <Pill color={m.catColor} glow={active}>{m.cat}</Pill>
              </div>
              <Avatar name={m.name} color={m.catColor} size={62} photo={m.photo} />
              <div className="tech" style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.08em" }}>{m.name.toUpperCase()}</div>
            </button>
          );
        })}

        {/* content team card */}
        {(() => {
          const active = sel === "content";
          return (
            <button
              onClick={() => setSel("content")}
              className="card flex flex-col items-center"
              style={{
                padding: "16px 14px 18px", gap: 12, cursor: "pointer",
                borderColor: active ? VAR.purple : "var(--border)",
                background: active ? "var(--feature-grad)" : "var(--surface)",
                boxShadow: active ? `var(--shadow), 0 0 26px -10px ${VAR.purple}` : "var(--shadow)",
              }}
            >
              <div style={{ alignSelf: "flex-start" }}>
                <Pill color="purple" glow={active}>CONTENT</Pill>
              </div>
              <div className="flex" style={{ marginTop: 4 }}>
                {CONTENT_TEAM.members.slice(0, 3).map((cm, i) => (
                  <div key={cm.id} style={{ marginLeft: i ? -12 : 0, boxShadow: "0 0 0 3px var(--surface)", borderRadius: "50%" }}>
                    <Avatar name={cm.name} color="purple" size={42} />
                  </div>
                ))}
              </div>
              <div className="tech" style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.08em" }}>CONTENT</div>
            </button>
          );
        })()}
      </div>

      {/* detail */}
      {sel === "content" ? <ContentDetail /> : <MemberDetail m={TEAM_MEMBERS.find((x) => x.id === sel)!} />}
    </div>
  );
}

function SocialBtn({ name }: { name: string }) {
  return (
    <button className="btn btn-icon" style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(127,127,127,0.06)" }}>
      <Icon name={name} size={16} />
    </button>
  );
}

function MemberDetail({ m }: { m: StaticMember }) {
  const cc = capColor(m.capacity);
  return (
    <div className="fade-up flex flex-col gap-4">
      {/* hero */}
      <div className="feature" style={{ padding: "26px 28px" }}>
        <div className="flex gap-6">
          <Avatar name={m.name} color={m.catColor} size={104} photo={m.photo} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="tech" style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "0.14em" }}>{m.name.toUpperCase()}</h2>
                <div className="eyebrow" style={{ color: VAR[m.catColor], marginTop: 6 }}>{m.cat} · {m.title}</div>
              </div>
              <div className="flex gap-2">
                <SocialBtn name="link" /><SocialBtn name="send" /><SocialBtn name="mail" />
              </div>
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, margin: "16px 0 14px", maxWidth: 760 }}>{m.overview}</p>
            <div className="flex flex-wrap gap-2">
              {m.skills.map((s) => <Pill key={s} color={m.catColor}>{s}</Pill>)}
            </div>
            <div style={{ borderLeft: `2px solid ${VAR[m.catColor]}`, paddingLeft: 14, marginTop: 18, maxWidth: 760 }}>
              <p className="muted" style={{ fontStyle: "italic", fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>{m.quote}</p>
            </div>
          </div>
        </div>
      </div>

      {/* info row */}
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "300px 300px minmax(0,1fr)" }}>
        <div className="card card-pad">
          <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
            <Icon name="trend" size={15} style={{ color: "var(--text-2)" }} />
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>Current capacity</span>
          </div>
          <div className="flex items-end gap-2" style={{ marginBottom: 12 }}>
            <span className="figure" style={{ fontSize: 38, color: VAR[cc], lineHeight: 1 }}>{Math.round(m.capacity * 100)}</span>
            <span className="tech" style={{ fontSize: 16, color: VAR[cc], marginBottom: 4 }}>%</span>
            <div className="flex-1" />
            <Pill color={cc}>{capLabel(m.capacity)}</Pill>
          </div>
          <Health value={m.capacity} color={cc} w={"100%"} />
          <div className="faint" style={{ fontSize: 11.5, marginTop: 10 }}>Allocated across {m.projects.length} active engagement{m.projects.length !== 1 ? "s" : ""}</div>
        </div>

        <div className="card card-pad">
          <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
            <Icon name="clock" size={15} style={{ color: "var(--text-2)" }} />
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>When reachable</span>
          </div>
          <div className="flex items-center gap-2.5" style={{ marginBottom: 10 }}>
            <span className="live-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--mint)" }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{m.availability.hours}</span>
          </div>
          <div className="muted flex items-center gap-2" style={{ fontSize: 12.5, marginBottom: 10 }}>
            <Icon name="target" size={13} style={{ color: "var(--text-3)" }} /> {m.availability.tz}
          </div>
          <div className="faint" style={{ fontSize: 12, lineHeight: 1.5 }}>{m.availability.note}</div>
        </div>

        <div className="card card-pad">
          <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
            <Icon name="folder" size={15} style={{ color: "var(--text-2)" }} />
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>Currently working on</span>
            <span className="tech faint" style={{ fontSize: 11, marginLeft: "auto" }}>{m.projects.length} ACTIVE</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {m.projects.map((pr, i) => (
              <div key={i} className="flex items-center gap-2.5" style={{ padding: "9px 11px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: pr.isRetainer ? VAR.blue : VAR.mint }} />
                <div className="min-w-0 flex-1">
                  <div style={{ fontSize: 12.5, fontWeight: 600 }} className="truncate">{pr.name}</div>
                  <div className="faint" style={{ fontSize: 11 }}>{pr.client}{pr.owner ? " · owner" : ""}</div>
                </div>
                {pr.isRetainer && <Pill color="blue" style={{ fontSize: 9 }}>RET</Pill>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ContentDetail() {
  const ct = CONTENT_TEAM;
  return (
    <div className="fade-up flex flex-col gap-4">
      <div className="feature" style={{ padding: "26px 28px" }}>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 className="tech" style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "0.1em" }}>CONTENT TEAM</h2>
            <div className="eyebrow" style={{ color: "var(--purple)", marginTop: 6 }}>LED BY {ct.lead.toUpperCase()}</div>
          </div>
          <Pill color="amber"><Icon name="lock" size={11} /> Not on portal yet</Pill>
        </div>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, margin: "16px 0 14px", maxWidth: 800 }}>{ct.overview}</p>
        <div className="flex flex-wrap gap-2">
          {ct.skills.map((s) => <Pill key={s} color="purple">{s}</Pill>)}
        </div>
      </div>

      <div className="card card-pad">
        <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
          <Icon name="users" size={15} style={{ color: "var(--text-2)" }} />
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>Members</span>
          <span className="tech faint" style={{ fontSize: 11, marginLeft: "auto" }}>{ct.members.length} PEOPLE</span>
        </div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
          {ct.members.map((cm) => (
            <div key={cm.id} className="flex flex-col items-center" style={{ gap: 9, padding: "16px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <Avatar name={cm.name} color="purple" size={46} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{cm.name}</div>
                <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>{cm.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
