import { PROJECT_TYPES } from "@/lib/brief/types";

// Proposes distinct Projects (each with a pre-filled Brief) from Client Data.
export function buildSuggestionsPrompt(input: {
  profile: unknown;
  strategy: unknown;
  brandKit: unknown;
  existingNames: string[];
}): string {
  const { profile, strategy, brandKit, existingNames } = input;
  return `You are a senior strategist at a web/design/marketing agency. Using everything known about this client below, propose the distinct PROJECTS the agency should deliver. Decide what actually makes sense for THIS client — do not use a fixed list. Examples of possible projects: Website, E-commerce, Brand identity, SEO, Advertising campaign, Landing page, Content strategy, LinkedIn, Instagram — but choose only what the data supports.

For each project, pre-fill the existing PROJECT BRIEF using known information; leave a field empty ([] or "") if you cannot confidently determine it — never invent facts.

${existingNames.length ? `Do NOT re-propose these already-suggested projects: ${JSON.stringify(existingNames)}.` : ""}

Return ONLY one raw JSON object:
{
  "projects": [
    {
      "name": "short project name",
      "project_type": one of ${JSON.stringify(PROJECT_TYPES)} or null,
      "rationale": "1 sentence on why this project, grounded in the client data",
      "overview": "1-2 sentences on what we're building (project-focused)",
      "scope": ["deliverables"],
      "key_functions": ["important functionality"],
      "sitemap": [{ "name": "Page", "children": ["optional child pages"] }]
    }
  ]
}

CLIENT PROFILE:
${JSON.stringify(profile)}

STRATEGY:
${JSON.stringify(strategy)}

BRAND KIT:
${JSON.stringify(brandKit ?? {})}`;
}
