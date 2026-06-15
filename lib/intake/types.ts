// ─── Intake pipeline JSON shapes ───────────────────────────────────────────────
// These mirror the three templates the two-agent pipeline fills:
//   client_profile.json · verification_queue.json · strategy.json
// Stored as Document rows (Document.content is JSONB). Keys are snake_case to
// match the templates verbatim. Row types carry an index signature so the generic
// brief mutators (lib/intake/store.ts → app/actions/brief.ts) can treat them as
// editable records.

export const PROFILE_DOC = "client_profile";
export const STRATEGY_DOC = "strategy";
export const VERIFICATION_DOC = "verification_queue";

export type IntakeDocType =
  | typeof PROFILE_DOC
  | typeof STRATEGY_DOC
  | typeof VERIFICATION_DOC;

export type ProfileStatus = "draft" | "verified";

type Row = Record<string, unknown>;

// ── client_profile.json ──
export type ProfileMeta = {
  client_id: string;
  company_name: string;
  brand_name: string;
  created_date: string;
  created_by: string;
  schema_version: string;
  status: ProfileStatus;
};

export type Company = Row & {
  company_id?: string;
  company_name?: string;
  brand_name?: string;
  industry?: string;
  sub_industry?: string;
  founded_year?: number | null;
  geographic_market?: string;
  website_url?: string;
  market_positioning?: string;
  brand_essence?: string;
  key_differentiators?: string[];
  current_challenge?: string;
  business_type?: string;
  verification_status?: string;
};

export type KeyMessage = Row & {
  message_id: string;
  message_text?: string;
  approved?: string;
  team_acknowledged_at?: string | null;
  team_acknowledged_by?: string | null;
};

export type Slogan = Row & {
  slogan_id: string;
  slogan_text?: string;
  approved?: string;
  team_acknowledged_at?: string | null;
  team_acknowledged_by?: string | null;
};

export type Persona = Row & {
  persona_id: string;
  persona_name?: string;
  group?: Row;
  pain_points?: Row[];
  needs?: Row[];
  objections?: Row[];
};

export type ClientProfile = {
  _meta: ProfileMeta;
  company: Company;
  contacts: Row[];
  services: Row[];
  pricing_modifiers: Row[];
  budget: Row[];
  goals: Row[];
  stats: Row[];
  competitors: Row[];
  personas: Persona[];
  benefits: Row[];
  messaging: {
    brand_voice: Row[];
    key_messages: KeyMessage[];
    slogans: Slogan[];
  };
};

// ── strategy.json ──
export type Objective = Row & {
  objective_id: string;
  objective_text?: string;
  initiatives?: Row[];
  key_results?: Row[];
};

export type Strategy = {
  _meta: ProfileMeta & { source?: string };
  objectives: Objective[];
  cross_cutting: Row[];
  funnel: Row[];
  calendar: Row[];
  risk_register: Row[];
};

// ── verification_queue.json ──
export type VerificationItem = Row & {
  item_id: string;
  source_document?: string;
  field_path?: string;
  current_value?: string;
  question_for_client?: string;
  status?: string;
  resolved_value?: string | null;
  date_raised?: string;
  date_resolved?: string | null;
};

export type VerificationQueue = {
  _meta: {
    client_id: string;
    company_name: string;
    generated_date: string;
    generated_by: string;
    schema_version: string;
    total_items: number;
    pending_count: number;
    resolved_count: number;
  };
  items: VerificationItem[];
};
