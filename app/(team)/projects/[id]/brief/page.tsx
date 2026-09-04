import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import CompanyCard from "@/components/team/brief/CompanyCard";
import BriefTable from "@/components/team/brief/BriefTable";
import VerificationRow from "@/components/team/brief/VerificationRow";
import { Eyebrow, Pill } from "@/components/ui/kit";
import {
  Snapshot,
  Chip,
  InsightCard,
  Disclosure,
  GroupHeading,
  PersonaCard,
  type ChipItem,
} from "@/components/team/data/ui";
import { getProfile, getStrategy, getVerificationQueue } from "@/lib/intake/store";
import { listForContext } from "@/lib/questions";
import { getRoster } from "@/lib/team";
import QuestionsPanel from "@/components/team/QuestionsPanel";
import { getBrandKit, getBrandLogos } from "@/app/actions/brand-kit";
import BrandKitCard from "@/components/team/data/BrandKitCard";
import { PROFILE_DOC, STRATEGY_DOC } from "@/lib/intake/types";
import { addRow, deleteRow, upsertCompany, type SectionConfig } from "@/app/actions/brief";

const TABS = [
  { id: "business", label: "Business" },
  { id: "audience", label: "Audience" },
  { id: "messaging", label: "Messaging" },
  { id: "strategy", label: "Strategy" },
  { id: "brand", label: "Brand Kit" },
  { id: "verify", label: "Verification" },
] as const;

type Tab = (typeof TABS)[number]["id"];
type Row = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? "" : String(v));
const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const isYes = (v: unknown) => v === true || v === "yes" || v === "true";

function rowsOf(arr: Row[] | undefined, idField: string) {
  return (arr ?? []).map((r) => ({ ...r, id: String(r[idField] ?? "") }));
}

function nestedRows(parents: Row[] | undefined, childKey: string, idField: string) {
  return (parents ?? []).flatMap((p) =>
    ((p[childKey] as Row[]) ?? []).map((r) => ({ ...r, id: String(r[idField] ?? "") }))
  );
}

export default async function DataPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id: projectId } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = (rawTab as Tab) ?? "business";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) redirect("/dashboard");

  const [profile, strategy, verification, verifyQuestions, roster, brandKit, brandLogos] = await Promise.all([
    getProfile(projectId),
    getStrategy(projectId),
    getVerificationQueue(projectId),
    listForContext("VERIFICATION", projectId),
    getRoster(),
    getBrandKit(projectId),
    getBrandLogos(projectId),
  ]);
  const company = (profile?.company ?? null) as Row | null;
  const verificationItems = verification?.items ?? [];
  const activeVerification = verificationItems.filter((i) => (i.status ?? "pending") === "pending");
  const resolvedVerification = verificationItems.filter((i) => (i.status ?? "pending") !== "pending");
  const pendingVerification = activeVerification.length;
  const openVerifyQuestions = verifyQuestions.filter((q) => q.status !== "ANSWERED" && q.status !== "RESOLVED").length;

  const add = (cfg: SectionConfig) => addRow.bind(null, cfg, projectId);
  const del = (cfg: SectionConfig) => deleteRow.bind(null, cfg, projectId);

  const companyData = company
    ? {
        companyName: (company.company_name as string) ?? null,
        brandName: (company.brand_name as string) ?? null,
        industry: (company.industry as string) ?? null,
        subIndustry: (company.sub_industry as string) ?? null,
        foundedYear: (company.founded_year as number) ?? null,
        geographicMarket: (company.geographic_market as string) ?? null,
        websiteUrl: (company.website_url as string) ?? null,
        marketPositioning: (company.market_positioning as string) ?? null,
        brandEssence: (company.brand_essence as string) ?? null,
        keyDifferentiators: Array.isArray(company.key_differentiators)
          ? company.key_differentiators.join(", ")
          : (typeof company.key_differentiators === "string" ? company.key_differentiators : null),
        currentChallenge: (company.current_challenge as string) ?? null,
        businessType: (company.business_type as string) ?? null,
      }
    : null;

  // ── Derivations for snapshots / counts / highlights ──
  const services = (profile?.services as Row[]) ?? [];
  const goals = (profile?.goals as Row[]) ?? [];
  const personas = (profile?.personas as Row[]) ?? [];
  const keyMessages = (profile?.messaging?.key_messages as Row[]) ?? [];
  const slogans = (profile?.messaging?.slogans as Row[]) ?? [];
  const brandVoice = (profile?.messaging?.brand_voice as Row[]) ?? [];
  const objectives = (strategy?.objectives as Row[]) ?? [];
  const funnel = (strategy?.funnel as Row[]) ?? [];

  const needsCount = personas.reduce((n, p) => n + (((p.needs as Row[]) ?? []).length), 0);
  const objectionsCount = personas.reduce((n, p) => n + (((p.objections as Row[]) ?? []).length), 0);

  const counts: Record<Tab, string> = {
    business: services.length ? String(services.length) : "",
    audience: personas.length ? `${personas.length}·${needsCount}·${objectionsCount}` : "",
    messaging: keyMessages.length + slogans.length ? String(keyMessages.length + slogans.length) : "",
    strategy: objectives.length ? String(objectives.length) : "",
    brand: (brandKit.typography?.length ?? 0) + (brandKit.colors?.length ?? 0) + brandLogos.length
      ? String((brandKit.typography?.length ?? 0) + (brandKit.colors?.length ?? 0) + brandLogos.length) : "",
    verify: "",
  };

  // Business snapshot bits
  const positioning = str(company?.market_positioning);
  const industry = str(company?.industry);
  const market = str(company?.geographic_market);
  const businessType = str(company?.business_type);
  let businessSummary = "";
  if (positioning || industry) {
    businessSummary =
      [cap(positioning), industry.toLowerCase()].filter(Boolean).join(" ") + " brand";
    if (market) businessSummary += ` focused on ${market}`;
    businessSummary += ".";
  } else {
    businessSummary = str(company?.brand_essence);
  }
  const businessChips: ChipItem[] = [
    industry,
    /b2[bc]/i.test(businessType) ? businessType.toUpperCase() : businessType,
    market,
    company?.founded_year ? `Founded ${company.founded_year}` : "",
    positioning ? cap(positioning) : "",
  ];
  const keyDiffs = Array.isArray(company?.key_differentiators)
    ? (company!.key_differentiators as unknown[]).map(String)
    : str(company?.key_differentiators).split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const primaryGoal = goals.find((g) => str(g.goal_level) === "primary");
  const mostPopular = services.find((s) => isYes(s.is_most_popular));
  const mostProfitable = services.find((s) => isYes(s.is_most_profitable));

  const primaryObjective = objectives.find((o) => str(o.level) === "primary") ?? objectives[0];

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 1100, margin: "0 auto" }} className="space-y-6">
      {/* Breadcrumb */}
      <nav className="faint flex items-center gap-1.5" style={{ fontSize: 12 }}>
        <Link href="/dashboard">Projects</Link>
        <span>›</span>
        <Link href={`/projects/${projectId}`}>{project.name}</Link>
        <span>›</span>
        <span style={{ color: "var(--text-2)" }}>Data</span>
      </nav>

      <div className="flex items-center justify-between gap-3 fade-up">
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>CLIENT DATA</Eyebrow>
          <h1 className="page-title" style={{ fontSize: 30 }}>Data</h1>
        </div>
        {profile && (
          <Pill color={profile._meta?.status === "verified" ? "mint" : "amber"}>
            Profile {profile._meta?.status ?? "draft"}
          </Pill>
        )}
      </div>

      {!profile && (
        <p className="muted card" style={{ fontSize: 13.5, padding: "16px 18px", borderStyle: "dashed" }}>
          No client profile yet. Run the intake pipeline from the project page to generate it.
        </p>
      )}

      {/* Sticky tabs */}
      <nav
        className="flex gap-1"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          borderBottom: "1px solid var(--border)",
          background: "color-mix(in srgb, var(--bg) 88%, transparent)",
          backdropFilter: "blur(10px)",
          margin: "0 -32px",
          padding: "0 32px",
        }}
      >
        {TABS.map(({ id, label }) => (
          <Link
            key={id}
            href={`/projects/${projectId}/brief?tab=${id}`}
            className="flex items-center gap-1.5"
            style={{
              padding: "10px 16px",
              fontSize: 13.5,
              fontWeight: 600,
              marginBottom: -1,
              borderBottom: `2px solid ${tab === id ? "var(--mint)" : "transparent"}`,
              color: tab === id ? "var(--text)" : "var(--text-3)",
            }}
          >
            {label}
            {counts[id] && (
              <span className="pill" style={{ padding: "1px 6px", fontSize: 10.5 }}>{counts[id]}</span>
            )}
            {id === "verify" && pendingVerification > 0 && (
              <span className="pill pill-amber" style={{ padding: "1px 6px" }}>{pendingVerification}</span>
            )}
          </Link>
        ))}
      </nav>

      {/* ── Business ─────────────────────────────────────────────────────────── */}
      {tab === "business" && (
        <div className="space-y-8">
          <Snapshot
            title={str(company?.company_name) || project.name}
            summary={businessSummary}
            chips={businessChips}
          >
            <InsightCard label="Brand Essence" value={str(company?.brand_essence)} accent />
            <InsightCard label="Current Challenge" value={str(company?.current_challenge)} />
          </Snapshot>

          {(keyDiffs.length > 0 || mostPopular || mostProfitable || primaryGoal) && (
            <div className="grid gap-x-8 gap-y-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {keyDiffs.length > 0 && (
                <InsightCard
                  label="Key differentiators"
                  accent
                  value={
                    <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 2 }}>
                      {keyDiffs.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  }
                />
              )}
              {primaryGoal && (
                <InsightCard label="Primary goal" accent value={str(primaryGoal.goal_description)} />
              )}
              {(mostPopular || mostProfitable) && (
                <InsightCard
                  label="Standout services"
                  value={
                    <div style={{ display: "grid", gap: 2 }}>
                      {mostPopular && <span>Most popular · {str(mostPopular.service_name)}</span>}
                      {mostProfitable && <span>Most profitable · {str(mostProfitable.service_name)}</span>}
                    </div>
                  }
                />
              )}
            </div>
          )}

          {/* Structured detail (editable) */}
          <div className="space-y-6">
            <GroupHeading>Business details</GroupHeading>
            <CompanyCard company={companyData} saveAction={upsertCompany.bind(null, projectId)} />

            <BriefTable
              title="Services"
              description="What the client sells or delivers"
              columns={[
                { key: "service_name", label: "Name" },
                { key: "category", label: "Category" },
                { key: "description", label: "Description", type: "textarea" },
                { key: "price_min", label: "Price min", type: "number" },
                { key: "price_max", label: "Price max", type: "number" },
                { key: "price_currency", label: "Currency" },
                { key: "is_most_popular", label: "Most popular", type: "boolean" },
                { key: "is_most_profitable", label: "Most profitable", type: "boolean" },
                { key: "notes", label: "Notes", type: "textarea" },
              ]}
              rows={rowsOf(profile?.services, "service_id")}
              addAction={add({ doc: PROFILE_DOC, path: "services", idField: "service_id", idPrefix: "SVC" })}
              deleteAction={del({ doc: PROFILE_DOC, path: "services", idField: "service_id", idPrefix: "SVC" })}
            />

            <BriefTable
              title="Contacts"
              description="Phone, email, social, addresses"
              columns={[
                { key: "type", label: "Type", type: "select", options: [
                  { value: "phone", label: "Phone" },
                  { value: "email", label: "Email" },
                  { value: "social", label: "Social" },
                  { value: "address", label: "Address" },
                  { value: "website", label: "Website" },
                ]},
                { key: "platform", label: "Platform" },
                { key: "value", label: "Value" },
                { key: "is_primary", label: "Primary", type: "boolean" },
                { key: "is_public", label: "Public", type: "boolean" },
                { key: "notes", label: "Notes", type: "textarea" },
              ]}
              rows={rowsOf(profile?.contacts, "contact_id")}
              addAction={add({ doc: PROFILE_DOC, path: "contacts", idField: "contact_id", idPrefix: "CON" })}
              deleteAction={del({ doc: PROFILE_DOC, path: "contacts", idField: "contact_id", idPrefix: "CON" })}
            />

            <BriefTable
              title="Competitors"
              description="Competitive landscape"
              columns={[
                { key: "name", label: "Name" },
                { key: "website", label: "Website" },
                { key: "market_positioning", label: "Positioning", type: "textarea" },
                { key: "price_range", label: "Price range" },
                { key: "their_strength", label: "Strength", type: "textarea" },
                { key: "their_weakness", label: "Weakness", type: "textarea" },
                { key: "our_opportunity", label: "Our opportunity", type: "textarea" },
              ]}
              rows={rowsOf(profile?.competitors, "competitor_id")}
              addAction={add({ doc: PROFILE_DOC, path: "competitors", idField: "competitor_id", idPrefix: "COMP" })}
              deleteAction={del({ doc: PROFILE_DOC, path: "competitors", idField: "competitor_id", idPrefix: "COMP" })}
            />

            <BriefTable
              title="Goals"
              description="Business objectives for this engagement"
              columns={[
                { key: "goal_level", label: "Level", type: "select", options: [
                  { value: "primary", label: "Primary" },
                  { value: "sub", label: "Sub" },
                  { value: "tactical", label: "Tactical" },
                ]},
                { key: "goal_description", label: "Goal", type: "textarea" },
                { key: "timeframe", label: "Timeframe" },
                { key: "success_metric", label: "Success metric", type: "textarea" },
                { key: "current_status", label: "Status", type: "select", options: [
                  { value: "not started", label: "Not started" },
                  { value: "in progress", label: "In progress" },
                  { value: "complete", label: "Complete" },
                ]},
                { key: "priority", label: "Priority", type: "number" },
                { key: "notes", label: "Notes", type: "textarea" },
              ]}
              rows={rowsOf(profile?.goals, "goal_id")}
              addAction={add({ doc: PROFILE_DOC, path: "goals", idField: "goal_id", idPrefix: "GOAL" })}
              deleteAction={del({ doc: PROFILE_DOC, path: "goals", idField: "goal_id", idPrefix: "GOAL" })}
            />

            <Disclosure summary="More data — stats & budget">
              <div className="space-y-6">
                <BriefTable
                  title="Company Stats"
                  description="Key figures and data points"
                  columns={[
                    { key: "stat_name", label: "Stat" },
                    { key: "stat_value", label: "Value" },
                    { key: "stat_unit", label: "Unit" },
                    { key: "source", label: "Source" },
                    { key: "notes", label: "Notes", type: "textarea" },
                  ]}
                  rows={rowsOf(profile?.stats, "stat_id")}
                  addAction={add({ doc: PROFILE_DOC, path: "stats", idField: "stat_id", idPrefix: "STAT" })}
                  deleteAction={del({ doc: PROFILE_DOC, path: "stats", idField: "stat_id", idPrefix: "STAT" })}
                />
                <BriefTable
                  title="Budget"
                  description="Channel-level budget allocation"
                  columns={[
                    { key: "channel", label: "Channel" },
                    { key: "monthly_allocation", label: "Monthly", type: "number" },
                    { key: "currency", label: "Currency" },
                    { key: "percentage_of_total", label: "% of total", type: "number" },
                    { key: "priority_level", label: "Priority", type: "select", options: [
                      { value: "high", label: "High" },
                      { value: "medium", label: "Medium" },
                      { value: "low", label: "Low" },
                    ]},
                    { key: "notes", label: "Notes", type: "textarea" },
                  ]}
                  rows={rowsOf(profile?.budget, "budget_id")}
                  addAction={add({ doc: PROFILE_DOC, path: "budget", idField: "budget_id", idPrefix: "BUD" })}
                  deleteAction={del({ doc: PROFILE_DOC, path: "budget", idField: "budget_id", idPrefix: "BUD" })}
                />
              </div>
            </Disclosure>
          </div>
        </div>
      )}

      {/* ── Audience ─────────────────────────────────────────────────────────── */}
      {tab === "audience" && (
        <div className="space-y-8">
          <Snapshot
            title="Audience"
            summary={
              personas.length
                ? `${personas.length} persona${personas.length !== 1 ? "s" : ""} · ${needsCount} need${needsCount !== 1 ? "s" : ""} · ${objectionsCount} objection${objectionsCount !== 1 ? "s" : ""}`
                : "No personas yet — add them below."
            }
          />

          {personas.length > 0 && (
            <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
              {personas.map((p, i) => (
                <PersonaCard key={str(p.persona_id) || i} persona={p} />
              ))}
            </div>
          )}

          <Disclosure summary="Edit audience records" open={personas.length === 0}>
            <div className="space-y-6">
              <BriefTable
                title="Personas"
                description="Detailed customer archetypes"
                columns={[
                  { key: "persona_name", label: "Name" },
                  { key: "age_range", label: "Age range" },
                  { key: "gender", label: "Gender" },
                  { key: "location", label: "Location" },
                  { key: "occupation", label: "Occupation" },
                  { key: "income_level", label: "Income level" },
                  { key: "core_values", label: "Core values", type: "textarea" },
                ]}
                rows={rowsOf(profile?.personas, "persona_id")}
                addAction={add({ doc: PROFILE_DOC, path: "personas", idField: "persona_id", idPrefix: "P" })}
                deleteAction={del({ doc: PROFILE_DOC, path: "personas", idField: "persona_id", idPrefix: "P" })}
              />
              <BriefTable
                title="Pain Points"
                description="Customer frustrations (added to the first persona)"
                columns={[
                  { key: "pain_description", label: "Pain point", type: "textarea" },
                  { key: "severity", label: "Severity (1–5)", type: "number" },
                  { key: "category", label: "Category", type: "select", options: [
                    { value: "product", label: "Product" },
                    { value: "price", label: "Price" },
                    { value: "trust", label: "Trust" },
                    { value: "fit", label: "Fit" },
                    { value: "experience", label: "Experience" },
                  ]},
                  { key: "surfaces_at_stage", label: "Funnel stage" },
                  { key: "strategic_implication", label: "Strategic implication", type: "textarea" },
                ]}
                rows={nestedRows(profile?.personas, "pain_points", "pain_id")}
                addAction={add({ doc: PROFILE_DOC, path: "personas.*.pain_points", idField: "pain_id", idPrefix: "PAIN" })}
                deleteAction={del({ doc: PROFILE_DOC, path: "personas.*.pain_points", idField: "pain_id", idPrefix: "PAIN" })}
              />
              <BriefTable
                title="Needs"
                description="What customers are looking for (added to the first persona)"
                columns={[
                  { key: "need_description", label: "Need", type: "textarea" },
                  { key: "need_type", label: "Type", type: "select", options: [
                    { value: "functional", label: "Functional" },
                    { value: "emotional", label: "Emotional" },
                    { value: "social", label: "Social" },
                    { value: "identity", label: "Identity" },
                  ]},
                  { key: "priority", label: "Priority", type: "number" },
                  { key: "notes", label: "Notes", type: "textarea" },
                ]}
                rows={nestedRows(profile?.personas, "needs", "need_id")}
                addAction={add({ doc: PROFILE_DOC, path: "personas.*.needs", idField: "need_id", idPrefix: "NEED" })}
                deleteAction={del({ doc: PROFILE_DOC, path: "personas.*.needs", idField: "need_id", idPrefix: "NEED" })}
              />
              <BriefTable
                title="Objections"
                description="Why customers hesitate (added to the first persona)"
                columns={[
                  { key: "objection_text", label: "Objection", type: "textarea" },
                  { key: "objection_type", label: "Type" },
                  { key: "response_text", label: "Response", type: "textarea" },
                  { key: "notes", label: "Notes", type: "textarea" },
                ]}
                rows={nestedRows(profile?.personas, "objections", "objection_id")}
                addAction={add({ doc: PROFILE_DOC, path: "personas.*.objections", idField: "objection_id", idPrefix: "OBJ" })}
                deleteAction={del({ doc: PROFILE_DOC, path: "personas.*.objections", idField: "objection_id", idPrefix: "OBJ" })}
              />
              <BriefTable
                title="Benefits"
                description="What the client's offering delivers"
                columns={[
                  { key: "benefit_description", label: "Benefit", type: "textarea" },
                  { key: "proof_point", label: "Proof point", type: "textarea" },
                  { key: "notes", label: "Notes", type: "textarea" },
                ]}
                rows={rowsOf(profile?.benefits, "benefit_id")}
                addAction={add({ doc: PROFILE_DOC, path: "benefits", idField: "benefit_id", idPrefix: "BEN" })}
                deleteAction={del({ doc: PROFILE_DOC, path: "benefits", idField: "benefit_id", idPrefix: "BEN" })}
              />
            </div>
          </Disclosure>
        </div>
      )}

      {/* ── Messaging ────────────────────────────────────────────────────────── */}
      {tab === "messaging" && (
        <div className="space-y-8">
          <Snapshot
            title="Messaging"
            summary={`${keyMessages.length} key message${keyMessages.length !== 1 ? "s" : ""} · ${slogans.length} slogan${slogans.length !== 1 ? "s" : ""} · ${brandVoice.length} voice rule${brandVoice.length !== 1 ? "s" : ""}`}
          />

          {keyMessages.length > 0 && (
            <div>
              <GroupHeading count={keyMessages.length}>Key messages</GroupHeading>
              <div className="space-y-2">
                {keyMessages.map((m, i) => (
                  <div key={i} style={{ borderLeft: "2px solid var(--border-2)", paddingLeft: 14 }}>
                    <p style={{ fontSize: 13.5, color: "var(--text)" }}>{str(m.message_text)}</p>
                    <div className="flex flex-wrap" style={{ gap: 6, marginTop: 6 }}>
                      {str(m.message_type) && <Chip>{str(m.message_type)}</Chip>}
                      {str(m.approved) === "yes" && <Chip accent>Approved</Chip>}
                      {str(m.approved) === "pending" && <Chip>Pending</Chip>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {slogans.length > 0 && (
            <div>
              <GroupHeading count={slogans.length}>Slogans</GroupHeading>
              <div className="space-y-2">
                {slogans.map((s, i) => (
                  <div key={i} style={{ borderLeft: "2px solid var(--border-2)", paddingLeft: 14 }}>
                    <p style={{ fontSize: 14, color: "var(--text)" }}>{str(s.slogan_text)}</p>
                    <div className="flex flex-wrap" style={{ gap: 6, marginTop: 6 }}>
                      {str(s.type) && <Chip>{str(s.type)}</Chip>}
                      {str(s.approved) === "yes" && <Chip accent>Approved</Chip>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {brandVoice.length > 0 && (
            <div>
              <GroupHeading>Brand voice</GroupHeading>
              <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                {(["DO", "DONT"] as const).map((kind) => {
                  const items = brandVoice.filter((v) => str(v.type) === kind);
                  if (items.length === 0) return null;
                  const isDo = kind === "DO";
                  return (
                    <div key={kind}>
                      <div className="eyebrow" style={{ marginBottom: 6, color: isDo ? "var(--mint)" : "var(--rose)" }}>
                        {isDo ? "DO" : "DON'T"}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 4 }}>
                        {items.map((v, i) => (
                          <li key={i} style={{ fontSize: 13.5, color: "var(--text)" }}>{str(v.observation)}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Structured detail (editable) */}
          <div className="space-y-6">
            <GroupHeading>Messaging records</GroupHeading>
            <BriefTable
              title="Key Messages"
              description="Headlines, hooks, CTAs, and captions"
              columns={[
                { key: "message_text", label: "Message", type: "textarea" },
                { key: "message_type", label: "Type", type: "select", options: [
                  { value: "headline", label: "Headline" },
                  { value: "hook", label: "Hook" },
                  { value: "body", label: "Body" },
                  { value: "cta", label: "CTA" },
                  { value: "caption", label: "Caption" },
                ]},
                { key: "tone_notes", label: "Tone notes" },
                { key: "use_at_stage", label: "Funnel stage" },
                { key: "channel_suitability", label: "Channels" },
                { key: "approved", label: "Approved", type: "select", options: [
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                  { value: "pending", label: "Pending" },
                ]},
              ]}
              rows={rowsOf(profile?.messaging?.key_messages, "message_id")}
              addAction={add({ doc: PROFILE_DOC, path: "messaging.key_messages", idField: "message_id", idPrefix: "MSG" })}
              deleteAction={del({ doc: PROFILE_DOC, path: "messaging.key_messages", idField: "message_id", idPrefix: "MSG" })}
            />
            <BriefTable
              title="Slogans"
              description="Taglines, campaign lines, and seasonal copy"
              columns={[
                { key: "slogan_text", label: "Slogan" },
                { key: "type", label: "Type", type: "select", options: [
                  { value: "tagline", label: "Tagline" },
                  { value: "service_slogan", label: "Service slogan" },
                  { value: "campaign", label: "Campaign" },
                  { value: "seasonal", label: "Seasonal" },
                ]},
                { key: "persona_fit", label: "Persona fit" },
                { key: "approved", label: "Approved", type: "select", options: [
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                  { value: "pending", label: "Pending" },
                ]},
                { key: "usage_notes", label: "Usage notes", type: "textarea" },
              ]}
              rows={rowsOf(profile?.messaging?.slogans, "slogan_id")}
              addAction={add({ doc: PROFILE_DOC, path: "messaging.slogans", idField: "slogan_id", idPrefix: "SLG" })}
              deleteAction={del({ doc: PROFILE_DOC, path: "messaging.slogans", idField: "slogan_id", idPrefix: "SLG" })}
            />
            <BriefTable
              title="Brand Voice"
              description="DOs and DON'Ts for communication style"
              columns={[
                { key: "type", label: "DO / DON'T", type: "select", options: [
                  { value: "DO", label: "DO" },
                  { value: "DONT", label: "DON'T" },
                ]},
                { key: "observation", label: "Rule", type: "textarea" },
                { key: "example", label: "Example", type: "textarea" },
                { key: "applies_to_channel", label: "Channel" },
                { key: "rationale", label: "Why" },
                { key: "priority", label: "Priority", type: "select", options: [
                  { value: "high", label: "High" },
                  { value: "medium", label: "Medium" },
                  { value: "low", label: "Low" },
                ]},
              ]}
              rows={rowsOf(profile?.messaging?.brand_voice, "observation_id")}
              addAction={add({ doc: PROFILE_DOC, path: "messaging.brand_voice", idField: "observation_id", idPrefix: "BV" })}
              deleteAction={del({ doc: PROFILE_DOC, path: "messaging.brand_voice", idField: "observation_id", idPrefix: "BV" })}
            />
          </div>
        </div>
      )}

      {/* ── Strategy ─────────────────────────────────────────────────────────── */}
      {tab === "strategy" && (
        <div className="space-y-8">
          <Snapshot
            title="Strategy"
            summary={
              primaryObjective
                ? str(primaryObjective.objective_text)
                : strategy
                ? `${objectives.length} objective${objectives.length !== 1 ? "s" : ""} · ${funnel.length} funnel stage${funnel.length !== 1 ? "s" : ""}`
                : "No strategy yet. Verify the profile and run Agent 2 from the project page."
            }
          />

          {objectives.length > 0 && (
            <div className="space-y-4">
              {objectives.map((o, i) => {
                const inis = (o.initiatives as Row[]) ?? [];
                const krs = (o.key_results as Row[]) ?? [];
                const primary = str(o.level) === "primary";
                return (
                  <div key={i} style={{ borderLeft: `2px solid ${primary ? "var(--mint)" : "var(--border-2)"}`, paddingLeft: 14 }}>
                    <div className="flex items-center" style={{ gap: 8 }}>
                      {primary && <Chip accent>Primary</Chip>}
                      {str(o.status) && <Chip>{str(o.status)}</Chip>}
                      {str(o.timeframe) && <Chip>{str(o.timeframe)}</Chip>}
                    </div>
                    <p style={{ fontSize: 14.5, color: "var(--text)", marginTop: 6, fontWeight: 500 }}>
                      {str(o.objective_text)}
                    </p>
                    {(inis.length > 0 || krs.length > 0) && (
                      <Disclosure summary={`Initiatives (${inis.length}) & key results (${krs.length})`}>
                        {inis.length > 0 && (
                          <ul style={{ margin: "0 0 8px", paddingLeft: 16, display: "grid", gap: 3 }}>
                            {inis.map((x, k) => (
                              <li key={k} style={{ fontSize: 13, color: "var(--text-2)" }}>{str(x.initiative_name) || str(x.description)}</li>
                            ))}
                          </ul>
                        )}
                        {krs.length > 0 && (
                          <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 3 }}>
                            {krs.map((x, k) => (
                              <li key={k} style={{ fontSize: 13, color: "var(--text-2)" }}>{str(x.kr_description)}</li>
                            ))}
                          </ul>
                        )}
                      </Disclosure>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {funnel.length > 0 && (
            <div>
              <GroupHeading count={funnel.length}>Funnel</GroupHeading>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                {[...funnel].sort((a, b) => (Number(a.stage_order) || 0) - (Number(b.stage_order) || 0)).map((f, i) => (
                  <div key={i} className="card" style={{ padding: "12px 14px" }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600 }}>{str(f.stage_name)}</p>
                    {str(f.stage_description) && (
                      <p className="faint" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>{str(f.stage_description)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Structured detail (editable) */}
          <div className="space-y-6">
            <GroupHeading>Strategy records</GroupHeading>
            <BriefTable
              title="Strategic Objectives"
              description="What success looks like at a high level"
              columns={[
                { key: "level", label: "Level", type: "select", options: [
                  { value: "primary", label: "Primary" },
                  { value: "sub", label: "Sub" },
                ]},
                { key: "objective_text", label: "Objective", type: "textarea" },
                { key: "timeframe", label: "Timeframe" },
                { key: "owner", label: "Owner" },
                { key: "priority", label: "Priority", type: "number" },
                { key: "status", label: "Status", type: "select", options: [
                  { value: "not started", label: "Not started" },
                  { value: "in progress", label: "In progress" },
                  { value: "complete", label: "Complete" },
                  { value: "at risk", label: "At risk" },
                ]},
                { key: "notes", label: "Notes", type: "textarea" },
              ]}
              rows={rowsOf(strategy?.objectives, "objective_id")}
              addAction={add({ doc: STRATEGY_DOC, path: "objectives", idField: "objective_id", idPrefix: "OBJ" })}
              deleteAction={del({ doc: STRATEGY_DOC, path: "objectives", idField: "objective_id", idPrefix: "OBJ" })}
            />
            <BriefTable
              title="Funnel Stages"
              description="Customer journey from awareness to conversion"
              columns={[
                { key: "stage_name", label: "Stage name" },
                { key: "stage_order", label: "Order", type: "number" },
                { key: "stage_description", label: "Description", type: "textarea" },
                { key: "entry_criteria", label: "Entry criteria", type: "textarea" },
                { key: "exit_criteria", label: "Exit criteria", type: "textarea" },
                { key: "key_metrics", label: "Key metrics" },
              ]}
              rows={rowsOf(strategy?.funnel, "stage_id")}
              addAction={add({ doc: STRATEGY_DOC, path: "funnel", idField: "stage_id", idPrefix: "FS" })}
              deleteAction={del({ doc: STRATEGY_DOC, path: "funnel", idField: "stage_id", idPrefix: "FS" })}
            />

            <Disclosure summary="More data — initiatives, key results, calendar & risks">
              <div className="space-y-6">
                <BriefTable
                  title="Initiatives"
                  description="Specific actions (added to the first objective)"
                  columns={[
                    { key: "initiative_name", label: "Initiative" },
                    { key: "description", label: "Description", type: "textarea" },
                    { key: "viability_score", label: "Viability (1–5)", type: "number" },
                    { key: "effort_score", label: "Effort (1–5)", type: "number" },
                    { key: "status", label: "Status" },
                    { key: "timeline", label: "Timeline" },
                    { key: "budget_estimate", label: "Budget estimate" },
                  ]}
                  rows={nestedRows(strategy?.objectives, "initiatives", "initiative_id")}
                  addAction={add({ doc: STRATEGY_DOC, path: "objectives.*.initiatives", idField: "initiative_id", idPrefix: "INI" })}
                  deleteAction={del({ doc: STRATEGY_DOC, path: "objectives.*.initiatives", idField: "initiative_id", idPrefix: "INI" })}
                />
                <BriefTable
                  title="Key Results"
                  description="Measurable outcomes (added to the first objective)"
                  columns={[
                    { key: "kr_description", label: "Key result", type: "textarea" },
                    { key: "measurement_type", label: "Measurement" },
                    { key: "baseline", label: "Baseline" },
                    { key: "target", label: "Target" },
                    { key: "current_value", label: "Current" },
                    { key: "status", label: "Status" },
                  ]}
                  rows={nestedRows(strategy?.objectives, "key_results", "kr_id")}
                  addAction={add({ doc: STRATEGY_DOC, path: "objectives.*.key_results", idField: "kr_id", idPrefix: "KR" })}
                  deleteAction={del({ doc: STRATEGY_DOC, path: "objectives.*.key_results", idField: "kr_id", idPrefix: "KR" })}
                />
                <BriefTable
                  title="Content Calendar"
                  description="Quarterly and monthly themes"
                  columns={[
                    { key: "period_type", label: "Period type", type: "select", options: [
                      { value: "month", label: "Month" },
                      { value: "quarter", label: "Quarter" },
                    ]},
                    { key: "period_label", label: "Period" },
                    { key: "theme", label: "Theme" },
                    { key: "focus_area", label: "Focus area" },
                    { key: "key_campaigns", label: "Key campaigns", type: "textarea" },
                    { key: "channel_focus", label: "Channel focus" },
                  ]}
                  rows={rowsOf(strategy?.calendar, "calendar_id")}
                  addAction={add({ doc: STRATEGY_DOC, path: "calendar", idField: "calendar_id", idPrefix: "CAL" })}
                  deleteAction={del({ doc: STRATEGY_DOC, path: "calendar", idField: "calendar_id", idPrefix: "CAL" })}
                />
                <BriefTable
                  title="Risks"
                  description="Known risks and mitigation plans"
                  columns={[
                    { key: "risk_category", label: "Category" },
                    { key: "risk_description", label: "Risk", type: "textarea" },
                    { key: "probability", label: "Prob (1–5)", type: "number" },
                    { key: "impact", label: "Impact (1–5)", type: "number" },
                    { key: "mitigation_strategy", label: "Mitigation", type: "textarea" },
                    { key: "owner", label: "Owner" },
                    { key: "status", label: "Status" },
                  ]}
                  rows={rowsOf(strategy?.risk_register, "risk_id")}
                  addAction={add({ doc: STRATEGY_DOC, path: "risk_register", idField: "risk_id", idPrefix: "RISK" })}
                  deleteAction={del({ doc: STRATEGY_DOC, path: "risk_register", idField: "risk_id", idPrefix: "RISK" })}
                />
              </div>
            </Disclosure>
          </div>
        </div>
      )}

      {/* ── Brand Kit ────────────────────────────────────────────────────────── */}
      {tab === "brand" && (
        <div className="space-y-4">
          <Snapshot
            title="Brand Kit"
            summary="The central home for this client's brand identity — logo, typography, and colours. Used across all briefs; never duplicated per brief."
          />
          <BrandKitCard
            projectId={projectId}
            typography={brandKit.typography ?? []}
            colors={brandKit.colors ?? []}
            logos={brandLogos}
          />
        </div>
      )}

      {/* ── Verification ─────────────────────────────────────────────────────── */}
      {tab === "verify" && (
        <div className="space-y-5">
          <Snapshot
            title="Verification"
            summary={
              verificationItems.length
                ? `${pendingVerification} pending · ${resolvedVerification.length} resolved`
                : profile
                ? "Nothing flagged for verification."
                : "No verification queue yet — run intake first."
            }
          />

          {/* Manual client/team questions */}
          <div className="space-y-2">
            <GroupHeading>Questions</GroupHeading>
            <p className="muted" style={{ fontSize: 13 }}>
              Ask the client for an answer or to confirm a proposed answer, or ask a team member.
            </p>
            <QuestionsPanel projectId={projectId} contextType="VERIFICATION" contextId={projectId} questions={verifyQuestions} roster={roster} />
          </div>

          {/* Auto-flagged verification items — active only */}
          <div className="space-y-2">
            <GroupHeading>Flagged fields — need action</GroupHeading>
            <p className="muted" style={{ fontSize: 13 }}>
              Fields the intake agent was unsure about. Check against the source, then Confirm or Reject.
            </p>
            {activeVerification.length === 0 ? (
              <p className="faint" style={{ fontSize: 13 }}>Nothing needs action — all flagged fields are resolved.</p>
            ) : (
              <div className="space-y-3">
                {activeVerification.map((item) => (
                  <VerificationRow
                    key={item.item_id}
                    projectId={projectId}
                    itemId={item.item_id}
                    fieldPath={(item.field_path as string) ?? ""}
                    currentValue={(item.current_value as string) ?? ""}
                    question={(item.question_for_client as string) ?? ""}
                    source={(item.source_document as string) ?? ""}
                    status={((item.status as string) ?? "pending") as "pending" | "confirmed" | "rejected"}
                    resolvedValue={item.resolved_value ?? ""}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Resolved history */}
          {resolvedVerification.length > 0 && (
            <Disclosure summary={`Resolved (${resolvedVerification.length})`}>
              <div className="space-y-3">
                {resolvedVerification.map((item) => (
                  <VerificationRow
                    key={item.item_id}
                    projectId={projectId}
                    itemId={item.item_id}
                    fieldPath={(item.field_path as string) ?? ""}
                    currentValue={(item.current_value as string) ?? ""}
                    question={(item.question_for_client as string) ?? ""}
                    source={(item.source_document as string) ?? ""}
                    status={((item.status as string) ?? "pending") as "pending" | "confirmed" | "rejected"}
                    resolvedValue={item.resolved_value ?? ""}
                  />
                ))}
              </div>
            </Disclosure>
          )}
        </div>
      )}
    </div>
  );
}
