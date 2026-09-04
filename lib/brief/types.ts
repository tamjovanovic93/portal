// ─── Project Brief ───────────────────────────────────────────────────────────
// The internal project-definition doc: what this project is, what we're
// building, who's on it, and where it stands. Stored as a Document row
// (templateType "project_brief", content = ProjectBrief). Deliberately holds
// NONE of the Data fields (audience/brand/business/budget/etc.).

export const BRIEF_DOC = "project_brief";

export type BriefItem = { id: string; text: string };
export type SitemapNode = { id: string; name: string; children?: { id: string; name: string }[] };
export type BriefTeamMember = { memberId: string; roles: string[] };
export type TypeStyle = { id: string; label: string; font?: string; size?: string; style?: string };
export type BrandColor = { id: string; name?: string; hex: string };

// A Scope item can carry its own dates (drive the tasks generated from it).
export type ScopeItem = BriefItem & { startDate?: string | null; dueDate?: string | null };

// Which sections a brief contains, in what order, whether they're hidden
// internally, and whether the client can see them. Treating the brief as a
// template/default: sections can be added, removed, hidden, reordered.
export type BriefSectionKind =
  | "meta"        // project type / status / stage / owner / client contact / dates
  | "overview"
  | "scope"
  | "keyFunctions"
  | "sitemap"
  | "team"
  | "text";       // free custom section

export type BriefSection = {
  key: string;              // stable id — default kind key, or "sec_xxx" for custom
  label: string;
  kind: BriefSectionKind;
  hidden?: boolean;         // removed from the brief view (kept in data)
  visibleToClient?: boolean;
  text?: string;            // body for kind "text"
};

export type ProjectBrief = {
  name?: string;            // brief title (also mirrored to Document.title)
  projectType?: string;
  status?: string;
  ownerId?: string;
  clientContact?: { name?: string; email?: string };
  dates?: { start?: string | null; end?: string | null };
  overview?: string;
  scope?: ScopeItem[];
  keyFunctions?: BriefItem[];
  sitemap?: SitemapNode[];
  team?: BriefTeamMember[];
  sections?: BriefSection[]; // section config (order / hidden / visibility / custom)
  publishedAt?: string | null; // set when published to the client
  // Deprecated on the brief — brand identity now lives in Data → Brand Kit.
  typography?: TypeStyle[];
  colors?: BrandColor[];
  _meta?: { generatedAt?: string };
};

// Default section set (order + client-visibility defaults). Used when a brief
// has no explicit `sections` config yet.
export const DEFAULT_BRIEF_SECTIONS: BriefSection[] = [
  { key: "meta", label: "Project Details", kind: "meta", visibleToClient: false },
  { key: "overview", label: "Project Overview", kind: "overview", visibleToClient: true },
  { key: "scope", label: "Scope of Work", kind: "scope", visibleToClient: true },
  { key: "keyFunctions", label: "Key Functions", kind: "keyFunctions", visibleToClient: true },
  { key: "sitemap", label: "Sitemap", kind: "sitemap", visibleToClient: true },
  { key: "team", label: "Project Team", kind: "team", visibleToClient: false },
];

export function getBriefSections(brief: ProjectBrief): BriefSection[] {
  return brief.sections && brief.sections.length > 0 ? brief.sections : DEFAULT_BRIEF_SECTIONS;
}

// Quick-add labels for typography styles.
export const TYPE_PRESETS = ["H1", "H2", "H3", "H4", "Body", "Small", "Caption", "Button", "Quote"] as const;

export type BriefListField = "scope" | "keyFunctions";

export const PROJECT_TYPES = [
  "Website",
  "E-commerce Website",
  "Web Application",
  "Mobile Application",
  "Branding",
  "Website Redesign",
  "Custom Platform",
  "Other",
] as const;

export const STATUSES = ["Not Started", "In Progress", "On Hold", "Completed"] as const;

export const TEAM_ROLES = [
  "Project Manager",
  "UX Designer",
  "UI Designer",
  "Developer",
  "Technical Lead",
  "Strategist",
  "Content",
  "QA",
  "Coordinator",
] as const;

// Short unique id for list items / sitemap nodes.
export function briefId(prefix = "b"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}
