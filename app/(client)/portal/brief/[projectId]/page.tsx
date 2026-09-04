import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getProfile, getStrategy } from "@/lib/intake/store";
import { getRoster } from "@/lib/team";
import {
  BRIEF_DOC,
  getBriefSections,
  type ProjectBrief,
  type ScopeItem,
  type SitemapNode,
} from "@/lib/brief/types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));

// Read-only client view. Shows any project briefs the team has published (only
// the sections marked visible to the client), plus the finished Brief & Strategy
// data once the onboarding publish gate (Project.briefPublishedAt) is set.
export default async function ClientBriefPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profileRow = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profileRow) redirect("/login");

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.clientId !== profileRow.id) notFound();

  const [briefDocs, roster] = await Promise.all([
    prisma.document.findMany({ where: { projectId, templateType: BRIEF_DOC }, orderBy: { createdAt: "asc" } }),
    getRoster(),
  ]);
  const publishedBriefs = briefDocs
    .map((d) => ({ id: d.id, content: (d.content as ProjectBrief) ?? {} }))
    .filter((b) => !!b.content.publishedAt);

  const strategyPublished = !!project.briefPublishedAt;

  if (publishedBriefs.length === 0 && !strategyPublished) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-neutral-500 text-sm">
          Your brief isn&apos;t ready to view yet. Your team will share it shortly.
        </p>
        <Link href="/portal" className="mt-6 inline-block text-sm text-neutral-900 underline underline-offset-2">
          Back to portal
        </Link>
      </div>
    );
  }

  const rosterName = (id?: string) => (id ? roster.find((m) => m.id === id)?.name ?? null : null);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      <div>
        <Link href="/portal" className="text-xs text-neutral-600 hover:text-neutral-700">← Back to portal</Link>
        <h1 className="text-2xl font-semibold text-neutral-900 mt-3">{project.name}</h1>
        <p className="text-sm text-neutral-500 mt-1">Your Brief{strategyPublished ? " & Strategy" : ""}</p>
      </div>

      {/* ── Published project briefs (client-visible sections only) ── */}
      {publishedBriefs.map((b) => {
        const sections = getBriefSections(b.content).filter((s) => !s.hidden && s.visibleToClient);
        if (sections.length === 0) return null;
        return (
          <div key={b.id} className="space-y-6">
            {publishedBriefs.length > 1 && (
              <h2 className="text-lg font-semibold text-neutral-900">{b.content.name || "Brief"}</h2>
            )}
            {sections.map((sec) => (
              <BriefSectionView key={sec.key} kind={sec.kind} label={sec.label} brief={b.content} text={sec.text} rosterName={rosterName} />
            ))}
          </div>
        );
      })}

      {/* ── Brief & Strategy data (onboarding publish) ── */}
      {strategyPublished && <StrategyData projectId={projectId} />}
    </div>
  );
}

// ── One client-visible brief section ──
function BriefSectionView({ kind, label, brief, text, rosterName }: {
  kind: string; label: string; brief: ProjectBrief; text?: string; rosterName: (id?: string) => string | null;
}) {
  switch (kind) {
    case "meta": {
      const owner = rosterName(brief.ownerId);
      const dates = brief.dates;
      return (
        <Section title={label}>
          <Field label="Project type" value={str(brief.projectType)} />
          <Field label="Status" value={str(brief.status)} />
          {owner && <Field label="Owner" value={owner} />}
          {dates?.start && <Field label="Start" value={str(dates.start)} />}
          {dates?.end && <Field label="Target" value={str(dates.end)} />}
        </Section>
      );
    }
    case "overview":
      if (!brief.overview) return null;
      return <Section title={label}><p className="text-sm text-neutral-800 whitespace-pre-wrap">{brief.overview}</p></Section>;
    case "scope": {
      const items = (brief.scope ?? []) as ScopeItem[];
      if (items.length === 0) return null;
      return (
        <Section title={label}>
          <ul className="space-y-1.5">
            {items.map((it) => (
              <li key={it.id} className="text-sm text-neutral-800 flex items-baseline justify-between gap-3">
                <span>• {it.text}</span>
                {(it.startDate || it.dueDate) && (
                  <span className="text-xs text-neutral-500 shrink-0">{[it.startDate, it.dueDate].filter(Boolean).join(" → ")}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      );
    }
    case "keyFunctions": {
      const items = brief.keyFunctions ?? [];
      if (items.length === 0) return null;
      return (
        <Section title={label}>
          <ul className="space-y-1.5">{items.map((it) => <li key={it.id} className="text-sm text-neutral-800">• {it.text}</li>)}</ul>
        </Section>
      );
    }
    case "sitemap": {
      const nodes = (brief.sitemap ?? []) as SitemapNode[];
      if (nodes.length === 0) return null;
      return (
        <Section title={label}>
          <ul className="space-y-1.5">
            {nodes.map((n) => (
              <li key={n.id} className="text-sm text-neutral-800">
                {n.name}
                {(n.children ?? []).length > 0 && (
                  <ul className="pl-5 mt-1 space-y-0.5">
                    {n.children!.map((c) => <li key={c.id} className="text-sm text-neutral-500">→ {c.name}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Section>
      );
    }
    case "team": {
      const team = brief.team ?? [];
      if (team.length === 0) return null;
      return (
        <Section title={label}>
          <ul className="space-y-1.5">
            {team.map((t) => (
              <li key={t.memberId} className="text-sm text-neutral-800">
                {rosterName(t.memberId) ?? "Team member"}
                {t.roles.length > 0 && <span className="text-neutral-500"> — {t.roles.join(", ")}</span>}
              </li>
            ))}
          </ul>
        </Section>
      );
    }
    case "text":
      if (!text) return null;
      return <Section title={label}><p className="text-sm text-neutral-800 whitespace-pre-wrap">{text}</p></Section>;
    default:
      return null;
  }
}

// ── Brief & Strategy data block (unchanged content, from intake docs) ──
async function StrategyData({ projectId }: { projectId: string }) {
  const [profile, strategy] = await Promise.all([getProfile(projectId), getStrategy(projectId)]);
  const company = (profile?.company ?? {}) as Row;
  const goals = (profile?.goals ?? []) as Row[];
  const personas = (profile?.personas ?? []) as Row[];
  const messaging = profile?.messaging ?? { brand_voice: [], key_messages: [], slogans: [] };
  const objectives = ((strategy?.objectives ?? []) as Row[]) ?? [];
  const funnel = ((strategy?.funnel ?? []) as Row[]) ?? [];
  const calendar = ((strategy?.calendar ?? []) as Row[]) ?? [];

  return (
    <>
      <Section title="Business">
        <Field label="Industry" value={str(company.industry)} />
        <Field label="Positioning" value={str(company.market_positioning)} />
        <Field label="Brand essence" value={str(company.brand_essence)} />
        <Field label="Key differentiators" value={Array.isArray(company.key_differentiators) ? (company.key_differentiators as string[]).join(", ") : str(company.key_differentiators)} />
        <Field label="Current challenge" value={str(company.current_challenge)} />
      </Section>

      {goals.length > 0 && (
        <Section title="Goals">
          <ul className="space-y-1.5">
            {goals.map((g, i) => <li key={i} className="text-sm text-neutral-800">• {str(g.goal_description) || str(g.goal_text) || str(g.description)}</li>)}
          </ul>
        </Section>
      )}

      {personas.length > 0 && (
        <Section title="Audience">
          <div className="space-y-4">
            {personas.map((p, i) => (
              <div key={i} className="border border-neutral-200 rounded-md p-4">
                <p className="text-sm font-medium text-neutral-900">{str(p.persona_name) || `Persona ${i + 1}`}</p>
                {Array.isArray(p.pain_points) && (p.pain_points as Row[]).length > 0 && (
                  <p className="text-sm text-neutral-700 mt-1">
                    <span className="text-neutral-500">Pain points: </span>
                    {(p.pain_points as Row[]).map((x) => str(x.pain_point) || str(x.text) || str(x.description)).filter(Boolean).join("; ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {((messaging.key_messages?.length ?? 0) > 0 || (messaging.slogans?.length ?? 0) > 0) && (
        <Section title="Messaging">
          {messaging.key_messages && messaging.key_messages.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-neutral-500 mb-1">Key messages</p>
              <ul className="space-y-1">{messaging.key_messages.map((m, i) => <li key={i} className="text-sm text-neutral-800">• {str(m.message_text)}</li>)}</ul>
            </div>
          )}
          {messaging.slogans && messaging.slogans.length > 0 && (
            <div>
              <p className="text-xs text-neutral-500 mb-1">Slogans</p>
              <ul className="space-y-1">{messaging.slogans.map((s, i) => <li key={i} className="text-sm text-neutral-800">• {str(s.slogan_text)}</li>)}</ul>
            </div>
          )}
        </Section>
      )}

      {objectives.length > 0 && (
        <Section title="Strategy — Objectives">
          <div className="space-y-4">
            {objectives.map((o, i) => (
              <div key={i} className="border border-neutral-200 rounded-md p-4">
                <p className="text-sm font-medium text-neutral-900">{str(o.objective_text) || `Objective ${i + 1}`}</p>
                {Array.isArray(o.initiatives) && (o.initiatives as Row[]).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {(o.initiatives as Row[]).map((ini, j) => <li key={j} className="text-sm text-neutral-700">— {str(ini.initiative_text) || str(ini.text) || str(ini.description)}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {funnel.length > 0 && (
        <Section title="Strategy — Funnel">
          <ul className="space-y-1.5">
            {funnel.map((f, i) => (
              <li key={i} className="text-sm text-neutral-800">
                <span className="font-medium">{str(f.stage) || str(f.stage_name)}:</span> {str(f.approach) || str(f.description) || str(f.focus)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {calendar.length > 0 && (
        <Section title="Strategy — Content Calendar">
          <div className="border border-neutral-200 rounded-md overflow-hidden">
            <ul className="divide-y divide-neutral-100">
              {calendar.map((c, i) => (
                <li key={i} className="px-4 py-2.5 text-sm text-neutral-800">
                  <span className="text-neutral-500">{str(c.month) || str(c.period) || str(c.date)}</span> — {str(c.theme) || str(c.focus) || str(c.description)}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">{title}</h2>
      <div className="border border-neutral-200 rounded-lg bg-white px-5 py-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-1">
      <span className="text-xs text-neutral-500 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-neutral-800 whitespace-pre-wrap">{value}</span>
    </div>
  );
}
