import strategyTemplate from "@/lib/intake/templates/strategy.template.json";
import type { ClientProfile } from "@/lib/intake/types";

// Agent 2 — builds the strategy document from a verified client profile.
export function buildStrategyPrompt(profile: ClientProfile): string {
  return `You are a senior marketing strategist. Using the VERIFIED client profile below, build a complete strategy document that follows the provided template exactly.

Rules:
- Follow the template structure exactly. Strings like "primary | sub" are the ALLOWED VALUES — choose one per field, don't echo the menu.
- Build objectives with nested initiatives and key_results; add cross_cutting initiatives, the four funnel stages, a content calendar, and a risk_register grounded in this client's reality.
- Generate sequential ids per the template convention (OBJ_001, INI_001, KR_001, …).
- Ground every element in the client profile — personas, goals, services, competitors, budget.
- _meta.status MUST be "draft" and _meta.source "Generated from verified client_profile.json".
- Return ONLY one raw JSON object matching the strategy template, no markdown.

VERIFIED CLIENT PROFILE:
${JSON.stringify(profile)}

strategy TEMPLATE:
${JSON.stringify(strategyTemplate)}`;
}
