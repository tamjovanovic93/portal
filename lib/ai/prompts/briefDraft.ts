import { PROJECT_TYPES } from "@/lib/brief/types";

// First draft of the internal Project Brief from approved onboarding data.
export function buildBriefDraftPrompt(sources: unknown): string {
  return `You are preparing the internal PROJECT BRIEF for a web/design agency ("Zero Point"). The brief defines ONLY what this project is and what we are building — NOT the client's audience, brand, positioning, messaging, competitors, business info, or budget (those live in a separate "Data" section — do not restate them).

Using ONLY the approved information below, draft these fields. If you cannot confidently determine a field from the information, leave it empty (null or []). DO NOT invent facts.

Return ONLY one raw JSON object with exactly these keys:
{
  "project_type": one of ${JSON.stringify(PROJECT_TYPES)} or null,
  "overview": "1–2 sentences describing what we are building for this client (project-focused, not company description)" or null,
  "scope": ["deliverables Zero Point is responsible for, e.g. UX strategy, Wireframes, UI design, Development, CMS setup, QA, Launch"] or [],
  "key_functions": ["the most important functionality, e.g. Product catalogue, Search, Cart, Checkout, User accounts, CMS"] or [],
  "sitemap": [{ "name": "Home", "children": ["optional child page names"] }] (proposed top-level pages; [] if unknown)
}

APPROVED INFORMATION:
${JSON.stringify(sources)}`;
}
