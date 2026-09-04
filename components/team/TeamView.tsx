"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { Avatar, Pill, Health, VAR, type Accent } from "@/components/ui/kit";
import { capacityColor, capacityLabel, type TeamMember } from "@/lib/team";

export default function TeamView({ members }: { members: TeamMember[] }) {
  const [sel, setSel] = useState<string>(members[0]?.id ?? "");
  const selected = members.find((m) => m.id === sel) ?? members[0];

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 1320, margin: "0 auto" }}>
      <div className="fade-up flex items-end justify-between gap-5" style={{ marginBottom: 24 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>THE TEAM</div>
          <h1 className="page-title" style={{ fontSize: 32 }}>One team, one point of contact</h1>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 14.5, maxWidth: 560 }}>
            Everyone who owns and delivers the work — capacity and current projects are live from assigned tasks.
          </p>
        </div>
        <button className="btn btn-primary"><Icon name="plus" size={16} /> Invite member</button>
      </div>

      {members.length === 0 ? (
        <div className="card muted" style={{ padding: 40, textAlign: "center", fontSize: 13.5 }}>
          No team members yet.
        </div>
      ) : (
        <>
          {/* roster */}
          <div className="fade-up grid gap-3.5" style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 26 }}>
            {members.map((m) => {
              const active = sel === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSel(m.id)}
                  className="card flex flex-col items-center"
                  style={{
                    padding: "16px 14px 18px", gap: 12, cursor: "pointer",
                    borderColor: active ? VAR[m.color] : "var(--border)",
                    background: active ? "var(--feature-grad)" : "var(--surface)",
                    boxShadow: active ? `var(--shadow), 0 0 26px -10px ${VAR[m.color]}` : "var(--shadow)",
                  }}
                >
                  <div style={{ alignSelf: "flex-start" }}>
                    <Pill color={capacityColor(m.capacity)} glow={active}>{Math.round(m.capacity * 100)}%</Pill>
                  </div>
                  <Avatar name={m.name} color={m.color} size={62} photo={m.photo} />
                  <div className="tech" style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.08em" }}>{m.name.toUpperCase()}</div>
                </button>
              );
            })}
          </div>

          {/* detail */}
          {selected && <MemberDetail m={selected} />}
        </>
      )}
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

function MemberDetail({ m }: { m: TeamMember }) {
  const cc = capacityColor(m.capacity);
  return (
    <div className="fade-up flex flex-col gap-4">
      {/* hero */}
      <div className="feature" style={{ padding: "26px 28px" }}>
        <div className="flex gap-6">
          <Avatar name={m.name} color={m.color} size={104} photo={m.photo} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="tech" style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "0.14em" }}>{m.name.toUpperCase()}</h2>
                <div className="eyebrow" style={{ color: VAR[m.color], marginTop: 6 }}>{m.title}</div>
              </div>
              <div className="flex gap-2">
                <SocialBtn name="link" /><SocialBtn name="send" /><SocialBtn name="mail" />
              </div>
            </div>
            {m.overview && <p style={{ fontSize: 14.5, lineHeight: 1.6, margin: "16px 0 14px", maxWidth: 760 }}>{m.overview}</p>}
            <div className="flex flex-wrap gap-2">
              {m.skills.map((s) => <Pill key={s} color={m.color}>{s}</Pill>)}
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
            <Pill color={cc}>{capacityLabel(m.capacity)}</Pill>
          </div>
          <Health value={m.capacity} color={cc} w={"100%"} />
          <div className="faint" style={{ fontSize: 11.5, marginTop: 10 }}>{m.openTasks} open task{m.openTasks !== 1 ? "s" : ""} across {m.projects.length} engagement{m.projects.length !== 1 ? "s" : ""}</div>
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
          {m.availability.note && <div className="faint" style={{ fontSize: 12, lineHeight: 1.5 }}>{m.availability.note}</div>}
        </div>

        <div className="card card-pad">
          <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
            <Icon name="folder" size={15} style={{ color: "var(--text-2)" }} />
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>Currently working on</span>
            <span className="tech faint" style={{ fontSize: 11, marginLeft: "auto" }}>{m.projects.length} ACTIVE</span>
          </div>
          {m.projects.length === 0 ? (
            <p className="faint" style={{ fontSize: 12.5 }}>No active engagements.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {m.projects.map((pr) => (
                <div key={pr.id} className="flex items-center gap-2.5" style={{ padding: "9px 11px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: pr.isRetainer ? VAR.blue : VAR.mint }} />
                  <div className="min-w-0 flex-1">
                    <div style={{ fontSize: 12.5, fontWeight: 600 }} className="truncate">{pr.name}</div>
                    <div className="faint" style={{ fontSize: 11 }}>{pr.clientName}</div>
                  </div>
                  {pr.isRetainer && <Pill color="blue" style={{ fontSize: 9 }}>RET</Pill>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
