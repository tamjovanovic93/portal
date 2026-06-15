import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import CompanyCard from "@/components/team/brief/CompanyCard";
import BriefTable from "@/components/team/brief/BriefTable";
import VerificationRow from "@/components/team/brief/VerificationRow";
import { Eyebrow, Pill } from "@/components/ui/kit";
import { getProfile, getStrategy, getVerificationQueue } from "@/lib/intake/store";
import { PROFILE_DOC, STRATEGY_DOC } from "@/lib/intake/types";
import { addRow, deleteRow, upsertCompany, type SectionConfig } from "@/app/actions/brief";

const TABS = [
  { id: "business", label: "Business" },
  { id: "audience", label: "Audience" },
  { id: "messaging", label: "Messaging" },
  { id: "strategy", label: "Strategy" },
  { id: "verify", label: "Verification" },
] as const;

type Tab = (typeof TABS)[number]["id"];
type Row = Record<string, unknown>;

function rowsOf(arr: Row[] | undefined, idField: string) {
  return (arr ?? []).map((r) => ({ ...r, id: String(r[idField] ?? "") }));
}

// Flatten a per-persona / per-objective nested array into one table.
function nestedRows(parents: Row[] | undefined, childKey: string, idField: string) {
  return (parents ?? []).flatMap((p) =>
    ((p[childKey] as Row[]) ?? []).map((r) => ({ ...r, id: String(r[idField] ?? "") }))
  );
}

export default async function BriefPage({
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

  const [profile, strategy, verification] = await Promise.all([
    getProfile(projectId),
    getStrategy(projectId),
    getVerificationQueue(projectId),
  ]);
  const company = profile?.company ?? null;
  const verificationItems = verification?.items ?? [];
  const pendingVerification = verificationItems.filter((i) => (i.status ?? "pending") === "pending").length;

  // Bind helpers — each table points at one array inside one JSON doc.
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

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 1100, margin: "0 auto" }} className="space-y-6">
      {/* Breadcrumb */}
      <nav className="faint flex items-center gap-1.5" style={{ fontSize: 12 }}>
        <Link href="/dashboard">Projects</Link>
        <span>›</span>
        <Link href={`/projects/${projectId}`}>{project.name}</Link>
        <span>›</span>
        <span style={{ color: "var(--text-2)" }}>Brief & Data</span>
      </nav>

      <div className="flex items-center justify-between gap-3 fade-up">
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>CLIENT DATABASE</Eyebrow>
          <h1 className="page-title" style={{ fontSize: 30 }}>Brief & Data</h1>
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

      {/* Tabs */}
      <nav className="flex gap-1" style={{ borderBottom: "1px solid var(--border)" }}>
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
            {id === "verify" && pendingVerification > 0 && (
              <span className="pill pill-amber" style={{ padding: "1px 6px" }}>{pendingVerification}</span>
            )}
          </Link>
        ))}
      </nav>

      {/* ── Business tab ────────────────────────────────────────────────────── */}
      {tab === "business" && (
        <div className="space-y-6">
          <CompanyCard company={companyData} saveAction={upsertCompany.bind(null, projectId)} />

          {(() => {
            const cfg: SectionConfig = { doc: PROFILE_DOC, path: "services", idField: "service_id", idPrefix: "SVC" };
            return (
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
                rows={rowsOf(profile?.services, cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: PROFILE_DOC, path: "contacts", idField: "contact_id", idPrefix: "CON" };
            return (
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
                rows={rowsOf(profile?.contacts, cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: PROFILE_DOC, path: "stats", idField: "stat_id", idPrefix: "STAT" };
            return (
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
                rows={rowsOf(profile?.stats, cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: PROFILE_DOC, path: "competitors", idField: "competitor_id", idPrefix: "COMP" };
            return (
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
                rows={rowsOf(profile?.competitors, cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: PROFILE_DOC, path: "goals", idField: "goal_id", idPrefix: "GOAL" };
            return (
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
                rows={rowsOf(profile?.goals, cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: PROFILE_DOC, path: "budget", idField: "budget_id", idPrefix: "BUD" };
            return (
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
                rows={rowsOf(profile?.budget, cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}
        </div>
      )}

      {/* ── Audience tab ────────────────────────────────────────────────────── */}
      {tab === "audience" && (
        <div className="space-y-6">
          {(() => {
            const cfg: SectionConfig = { doc: PROFILE_DOC, path: "personas", idField: "persona_id", idPrefix: "P" };
            return (
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
                rows={rowsOf(profile?.personas, cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: PROFILE_DOC, path: "personas.*.pain_points", idField: "pain_id", idPrefix: "PAIN" };
            return (
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
                rows={nestedRows(profile?.personas, "pain_points", cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: PROFILE_DOC, path: "personas.*.needs", idField: "need_id", idPrefix: "NEED" };
            return (
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
                rows={nestedRows(profile?.personas, "needs", cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: PROFILE_DOC, path: "personas.*.objections", idField: "objection_id", idPrefix: "OBJ" };
            return (
              <BriefTable
                title="Objections"
                description="Why customers hesitate (added to the first persona)"
                columns={[
                  { key: "objection_text", label: "Objection", type: "textarea" },
                  { key: "objection_type", label: "Type" },
                  { key: "response_text", label: "Response", type: "textarea" },
                  { key: "notes", label: "Notes", type: "textarea" },
                ]}
                rows={nestedRows(profile?.personas, "objections", cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: PROFILE_DOC, path: "benefits", idField: "benefit_id", idPrefix: "BEN" };
            return (
              <BriefTable
                title="Benefits"
                description="What the client's offering delivers"
                columns={[
                  { key: "benefit_description", label: "Benefit", type: "textarea" },
                  { key: "proof_point", label: "Proof point", type: "textarea" },
                  { key: "notes", label: "Notes", type: "textarea" },
                ]}
                rows={rowsOf(profile?.benefits, cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}
        </div>
      )}

      {/* ── Messaging tab ───────────────────────────────────────────────────── */}
      {tab === "messaging" && (
        <div className="space-y-6">
          {(() => {
            const cfg: SectionConfig = { doc: PROFILE_DOC, path: "messaging.key_messages", idField: "message_id", idPrefix: "MSG" };
            return (
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
                rows={rowsOf(profile?.messaging?.key_messages, cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: PROFILE_DOC, path: "messaging.slogans", idField: "slogan_id", idPrefix: "SLG" };
            return (
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
                rows={rowsOf(profile?.messaging?.slogans, cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: PROFILE_DOC, path: "messaging.brand_voice", idField: "observation_id", idPrefix: "BV" };
            return (
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
                rows={rowsOf(profile?.messaging?.brand_voice, cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}
        </div>
      )}

      {/* ── Strategy tab ────────────────────────────────────────────────────── */}
      {tab === "strategy" && (
        <div className="space-y-6">
          {!strategy && (
            <p className="muted card" style={{ fontSize: 13.5, padding: "16px 18px", borderStyle: "dashed" }}>
              No strategy yet. Verify the profile and run Agent 2 from the project page.
            </p>
          )}

          {(() => {
            const cfg: SectionConfig = { doc: STRATEGY_DOC, path: "objectives", idField: "objective_id", idPrefix: "OBJ" };
            return (
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
                rows={rowsOf(strategy?.objectives, cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: STRATEGY_DOC, path: "objectives.*.initiatives", idField: "initiative_id", idPrefix: "INI" };
            return (
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
                rows={nestedRows(strategy?.objectives, "initiatives", cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: STRATEGY_DOC, path: "objectives.*.key_results", idField: "kr_id", idPrefix: "KR" };
            return (
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
                rows={nestedRows(strategy?.objectives, "key_results", cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: STRATEGY_DOC, path: "funnel", idField: "stage_id", idPrefix: "FS" };
            return (
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
                rows={rowsOf(strategy?.funnel, cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: STRATEGY_DOC, path: "calendar", idField: "calendar_id", idPrefix: "CAL" };
            return (
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
                rows={rowsOf(strategy?.calendar, cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}

          {(() => {
            const cfg: SectionConfig = { doc: STRATEGY_DOC, path: "risk_register", idField: "risk_id", idPrefix: "RISK" };
            return (
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
                rows={rowsOf(strategy?.risk_register, cfg.idField)}
                addAction={add(cfg)}
                deleteAction={del(cfg)}
              />
            );
          })()}
        </div>
      )}

      {/* ── Verification tab ────────────────────────────────────────────────── */}
      {tab === "verify" && (
        <div className="space-y-4">
          <p className="muted" style={{ fontSize: 13.5 }}>
            Fields Agent 1 was unsure about. Check each against the source, correct the value
            in the other tabs if needed, then Confirm or Reject. Resolving everything here is the
            cue that the profile is ready to verify.
          </p>
          {verificationItems.length === 0 ? (
            <p className="muted card" style={{ fontSize: 13.5, padding: "16px 18px", borderStyle: "dashed" }}>
              {profile ? "Nothing flagged for verification." : "No verification queue yet — run intake first."}
            </p>
          ) : (
            <div className="space-y-3">
              <p className="faint" style={{ fontSize: 12 }}>
                {pendingVerification} pending · {verificationItems.length - pendingVerification} resolved
              </p>
              {verificationItems.map((item) => (
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
      )}
    </div>
  );
}
