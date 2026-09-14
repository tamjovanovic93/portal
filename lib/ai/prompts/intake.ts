import clientProfileTemplate from "@/lib/intake/templates/client_profile.template.json";
import verificationQueueTemplate from "@/lib/intake/templates/verification_queue.template.json";

// Agent 1 — turns the approved intake into a client_profile + verification_queue.
export function buildIntakePrompt(clientName: string, formText: string): string {
  return `You are a senior business analyst at a marketing agency. The client "${clientName}" has submitted their intake. Produce two JSON documents that follow the provided templates exactly.

Your job:
1. Fill the client_profile from the CLIENT INTAKE below. Copy answers faithfully; make reasonable inferences where data is implied. The intake is your source of truth — always prefer what the client actually wrote.
2. RESEARCH what the intake does not cover — use web search to fill gaps about the company, its market, competitors, and industry where you can find reliable public information.
3. Only add an item to the verification_queue for information that is genuinely MISSING, CONTRADICTORY, UNCLEAR, or that you had to GUESS/INFER without confirmation. Do NOT create a verification item for anything the client already clearly provided in the intake.

CRITICAL — before adding ANY verification item, re-read the ENTIRE intake (all sections, including contact details, website, and every social/profile link such as Instagram, TikTok, Facebook, LinkedIn, YouTube, Google Business, and other platforms). If the client already gave the information, capture it in the profile and do NOT ask for it again. Never ask the client to repeat something they already told us.

CRITICAL — write every verification question as a normal, human-readable question that a non-technical business owner can answer. The question MUST restate the actual information being verified in plain language.
- GOOD: "We currently have your target audience as 'small and mid-sized B2B companies in Canada.' Is this correct?"
- GOOD: "The intake suggests your brand should feel premium, direct, and approachable. Would you like to keep this positioning or change it?"
- BAD (never do this): "Current value: Synthesized statement", "Inferred scale points", any JSON key, field id, or internal/AI wording.
- Put the internal address in field_path (for our system only); put the plain, real current value in current_value; put the full human question in question_for_client.

Business model: the intake customer type may be "b2c", "b2b", or "both". If the client sells to BOTH consumers and other businesses, set company.business_type to "Both" (do not reduce it to one type), and reflect both audiences in the personas/messaging.

Rules:
- Follow the template structures exactly. The strings like "primary | sub | tactical" are the ALLOWED VALUES — replace each with a single chosen value, not the menu.
- Generate sequential ids per the template convention (SVC_001, CON_001, COMP_001, P001, PAIN_001, …).
- Capture the client's social/profile links and contact details as contacts rows (type "social"/"website"/"email"/"phone"/"address", with platform + value) so they are never lost.
- Use null / empty arrays for genuinely unknown values rather than inventing facts.
- client_profile._meta.status MUST be "draft".
- Return ONLY one raw JSON object, no markdown, with exactly two top-level keys: "client_profile" and "verification_queue".

CLIENT INTAKE:
${formText}

client_profile TEMPLATE:
${JSON.stringify(clientProfileTemplate)}

verification_queue TEMPLATE:
${JSON.stringify(verificationQueueTemplate)}`;
}
