import Link from "next/link";
import NewClientButton from "@/components/team/NewClientButton";
import Icon from "@/components/ui/Icon";
import { Eyebrow, Pill, StageBar, Health, Avatar, VAR, type Accent } from "@/components/ui/kit";
import { capacityColor } from "@/lib/team";
import { getSessionUser } from "@/lib/auth/session";
import MyWork from "@/components/team/MyWork";
import StatTiles from "@/components/team/StatTiles";
import { STAGE_LABELS, STAGE_COUNT } from "@/lib/stages";
import { loadDashboard } from "./queries";
import {
  STAGE_LIST,
  clientName,
  daysSince,
  deriveDashboard,
  getBlockingLine,
  getPendingStatus,
  hasGatePending,
  healthAccent,
  timeAgo,
} from "./derive";
import { PROJECT_TYPE_LABELS } from "@/lib/constants/projects";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const authUser = await getSessionUser();
  const currentUserId = authUser?.id ?? "";

  const data = await loadDashboard(currentUserId);
  const { now, projects, team, workload, myTasks, blockerCount, blockerTasks } = data;
  const {
    workMembers, memberQuestions, gateProjects, healthById, feed, retainerStats, needsYou, statTiles, waitingItems,
  } = deriveDashboard(data);

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 1440, margin: "0 auto" }} className="space-y-6">
      {/* Header */}
      <div className="fade-up flex items-end justify-between gap-5">
        <div>
          <Eyebrow style={{ marginBottom: 10 }}>0VERVIEW</Eyebrow>
          <h1 className="page-title" style={{ fontSize: 34 }}>Dashboard</h1>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 14.5 }}>
            {projects.length} active engagement{projects.length !== 1 ? "s" : ""}
            {needsYou.length > 0 && <> · <span style={{ color: "var(--amber)" }}>{needsYou.length} need you</span></>}
            {gateProjects.length > 0 && <> · <span style={{ color: "var(--rose)" }}>{gateProjects.length} awaiting sign-off</span></>}
          </p>
        </div>
        <NewClientButton
          triggerClassName="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 transition-colors"
          label="+ New client"
        />
      </div>

      {/* Stat tiles — clickable, expand to reveal the items behind each count */}
      <div className="fade-up">
        <StatTiles tiles={statTiles} />
      </div>

      {/* My Work — tasks for the logged-in member, filterable, with workload strip */}
      <div className="fade-up">
        <Eyebrow style={{ marginBottom: 14 }}>MY W0RK</Eyebrow>
        <MyWork tasks={myTasks} workload={workload} members={workMembers} questions={memberQuestions} currentUserId={currentUserId} />
      </div>

      {/* Main split */}
      <div className="grid gap-5 items-start" style={{ gridTemplateColumns: "minmax(0,1fr) 340px" }}>
        {/* Left — projects */}
        <div className="fade-up">
          <Eyebrow style={{ marginBottom: 14 }}>ACTIVE PR0JECTS</Eyebrow>
          {projects.length === 0 ? (
            <div className="card muted" style={{ padding: 40, textAlign: "center", fontSize: 13.5 }}>
              No active projects. Create one to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
              {projects.map((project) => {
                if (project.mode === "ONGOING") {
                  const r = retainerStats.find((s) => s.id === project.id);
                  const accent: Accent = r && r.overdueCount > 0 ? "rose" : r && r.awaitingClientCount > 0 ? "amber" : "mint";
                  const days = daysSince(project.updatedAt, now);
                  return (
                    <Link key={project.id} href={`/projects/${project.id}`} className="card block" style={{ padding: 18 }}>
                      <div className="flex items-center gap-2">
                        <Pill color="blue">RETAINER</Pill>
                        <div className="flex-1" />
                        <span className="faint" style={{ fontSize: 11 }}>{days === 0 ? "today" : `${days}d ago`}</span>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <div className="eyebrow mint" style={{ marginBottom: 5, fontSize: 10.5 }}>{clientName(project)}</div>
                        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>{project.name}</div>
                        <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>{r?.cycleName ?? "No active cycle"} · {r?.openCount ?? 0} open</div>
                      </div>
                      {(() => {
                        const h = healthById.get(project.id) ?? 1;
                        return (
                          <div style={{ marginTop: 12 }}>
                            <div className="flex justify-between" style={{ fontSize: 11.5, marginBottom: 6 }}>
                              <span className="tech" style={{ letterSpacing: "0.04em", color: "var(--text-2)" }}>HEALTH</span>
                              <span className="faint">{Math.round(h * 100)}%</span>
                            </div>
                            <Health value={h} color={healthAccent(h)} w={"100%"} />
                          </div>
                        );
                      })()}
                      <div className="flex items-center gap-1.5 flex-wrap" style={{ marginTop: 12, minHeight: 20 }}>
                        {r && r.overdueCount > 0 && <Pill color="rose">{r.overdueCount} OVERDUE</Pill>}
                        {r && r.awaitingClientCount > 0 && <Pill color="amber">{r.awaitingClientCount} AWAITING</Pill>}
                        {r && r.overdueCount === 0 && r.awaitingClientCount === 0 && <Pill color="mint">ON TRACK</Pill>}
                        <div className="flex-1" />
                        <span style={{ color: VAR[accent], display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                          Open <Icon name="chevR" size={14} />
                        </span>
                      </div>
                    </Link>
                  );
                }

                const pending = getPendingStatus(project);
                const blocking = getBlockingLine(project);
                const hasGate = hasGatePending(project);
                const statusColor: Accent = hasGate ? "rose" : pending.actor === "client" ? "amber" : "mint";
                const days = daysSince(project.updatedAt, now);
                return (
                  <Link key={project.id} href={`/projects/${project.id}`} className="card block" style={{ padding: 18 }}>
                    <div className="flex items-center gap-2">
                      <Pill>{PROJECT_TYPE_LABELS[project.type]}</Pill>
                      <Pill color={statusColor}><span className="dot" />{hasGate ? "Gate" : pending.actor === "client" ? "Client" : "Team"}</Pill>
                      <div className="flex-1" />
                      <span className="faint" style={{ fontSize: 11 }}>{days === 0 ? "today" : `${days}d ago`}</span>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div className="eyebrow mint" style={{ marginBottom: 5, fontSize: 10.5 }}>{clientName(project)}</div>
                      <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>{project.name}</div>
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <StageBar stages={STAGE_LIST} current={project.currentStage - 1} compact />
                      <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                        <span className="tech" style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--text-3)", textTransform: "uppercase" }}>
                          STAGE {project.currentStage}/{STAGE_COUNT} · {STAGE_LABELS[project.currentStage]}
                        </span>
                        {(() => {
                          const h = healthById.get(project.id) ?? 1;
                          return (
                            <span className="flex items-center gap-1.5">
                              <Health value={h} color={healthAccent(h)} w={44} />
                              <span className="faint tech" style={{ fontSize: 10 }}>{Math.round(h * 100)}%</span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="hr" style={{ margin: "14px 0" }} />
                    <div className="flex items-center gap-1.5">
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: VAR[blocking.dot], flexShrink: 0 }} />
                      <span className={blocking.blocking ? "" : "faint"} style={{ fontSize: 12 }}>{blocking.text}</span>
                      <div className="flex-1" />
                      <span style={{ color: "var(--text-3)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                        Open <Icon name="chevR" size={14} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="fade-up flex flex-col gap-4 sticky" style={{ top: 76 }}>
          {/* Blockers */}
          <div className="card card-pad">
            <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
              <Icon name="alert" size={15} style={{ color: "var(--amber)" }} />
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Blockers</span>
              {blockerCount > 0 && <Pill color="amber" style={{ marginLeft: "auto" }}>{blockerCount}</Pill>}
            </div>
            {blockerTasks.length === 0 ? (
              <p className="faint" style={{ fontSize: 12.5 }}>No active blockers.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {blockerTasks.map((b) => (
                  <Link key={b.id} href={`/projects/${b.cycle.project.id}`} className="flex items-start gap-2.5">
                    <span style={{ marginTop: 5, width: 7, height: 7, borderRadius: "50%", background: VAR.amber, flexShrink: 0 }} />
                    <div className="min-w-0">
                      <p style={{ fontSize: 12.5, lineHeight: 1.35 }}>{b.name}</p>
                      <p className="faint" style={{ fontSize: 11 }}>
                        {b.cycle.project.client.name ?? b.cycle.project.client.email}
                        {b.blockerResolver ? ` · waiting on ${b.blockerResolver.replace(/_/g, " ").toLowerCase()}` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Waiting on client */}
          <div className="card card-pad">
            <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
              <Icon name="clock" size={15} style={{ color: "var(--blue)" }} />
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Waiting on client</span>
              {waitingItems.length > 0 && <Pill color="blue" style={{ marginLeft: "auto" }}>{waitingItems.length}</Pill>}
            </div>
            {waitingItems.length === 0 ? (
              <p className="faint" style={{ fontSize: 12.5 }}>Nothing outstanding from clients.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {waitingItems.slice(0, 8).map((it) => (
                  <Link key={it.key} href={it.href} className="flex items-start gap-2.5">
                    <span style={{ marginTop: 5, width: 7, height: 7, borderRadius: "50%", background: VAR[it.dot], flexShrink: 0 }} />
                    <div className="min-w-0">
                      <p style={{ fontSize: 12.5, lineHeight: 1.35 }}>{it.label}</p>
                      <p className="faint truncate" style={{ fontSize: 11 }}>{it.sub}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Team capacity */}
          {team.length > 0 && (
            <div className="card card-pad">
              <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                <Icon name="users" size={15} style={{ color: "var(--text-2)" }} />
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>Team capacity</span>
                <Link href="/team" className="faint" style={{ marginLeft: "auto", fontSize: 11.5 }}>Team →</Link>
              </div>
              <div className="flex flex-col gap-3">
                {team.map((m) => {
                  const cc = capacityColor(m.capacity);
                  return (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <Avatar name={m.name} color={m.color} size={26} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
                          <span className="truncate">{m.name}</span>
                          <span className="tech" style={{ color: VAR[cc], fontSize: 11 }}>{Math.round(m.capacity * 100)}%</span>
                        </div>
                        <Health value={m.capacity} color={cc} w={"100%"} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Recent activity */}
      <div className="fade-up">
        <Eyebrow style={{ marginBottom: 14 }}>RECENT ACTIVITY</Eyebrow>
        {feed.length === 0 ? (
          <div className="card muted" style={{ padding: 20, fontSize: 13 }}>No recent activity recorded yet.</div>
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            {feed.map((item, i) => (
              <Link key={item.key} href={`/projects/${item.projectId}`} className="flex items-center gap-4" style={{ padding: "12px 18px", borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-4)", flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <span style={{ fontSize: 13 }}>{item.label}</span>
                  <span className="faint" style={{ fontSize: 13, marginLeft: 8 }}>· {item.projectName}</span>
                </div>
                <span className="faint" style={{ fontSize: 11.5, flexShrink: 0 }}>{timeAgo(item.at, now)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
