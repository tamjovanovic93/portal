import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { TEMPLATES } from "@/lib/templates/registry";
import type { Template } from "@/lib/templates/types";
import { isVisible } from "@/lib/templates/visibility";
import { applyConfig, getConfig } from "@/lib/templates/config";
import { PROFILE_DOC, STRATEGY_DOC, VERIFICATION_DOC, type ClientProfile, type VerificationQueue } from "@/lib/intake/types";
import { getProfile, upsertIntakeDoc } from "@/lib/intake/store";
import { TEMPLATE_TYPES } from "@/lib/documents/types";
import { runAgentWithSearchFallback, parseJsonResponse, type AgentUsage } from "../client";
import { MODELS } from "../models";
import { buildIntakePrompt } from "../prompts/intake";
import { buildStrategyPrompt } from "../prompts/strategy";

// ─── Form → readable text ────────────────────────────────────────────────────

function buildFormText(template: Template, content: Record<string, unknown>): string {
  const lines: string[] = [];
  // Honor the team's builder config (removed/reordered sections & fields).
  const configured = applyConfig(template, getConfig(content));
  for (const section of configured.sections) {
    if (section.teamOnly) continue;
    // Skip sections/fields hidden by unmet conditionals (e.g. the B2B branch
    // when the client answered B2C) so the agent only sees real answers.
    if (!isVisible(section.showIf, content)) continue;
    lines.push(`\n## ${section.title}`);
    for (const field of section.fields) {
      if (!isVisible(field.showIf, content)) continue;
      const value = content[field.key];
      if (value === undefined || value === null || value === "") continue;
      if (field.type === "repeatable" && Array.isArray(value)) {
        lines.push(`\n**${field.label}:**`);
        (value as Record<string, string>[]).forEach((row, i) => {
          const parts = (field.columns ?? [])
            .filter((col) => row[col.key])
            .map((col) => `${col.label}: ${row[col.key]}`);
          if (parts.length) lines.push(`  ${i + 1}. ${parts.join(" | ")}`);
        });
      } else {
        lines.push(`**${field.label}:** ${value}`);
      }
    }
  }
  return lines.join("\n");
}

// Precondition shared by the action (so the user sees the error immediately)
// and the runner (so a stale job cannot run on missing data).
export async function checkIntakePreconditions(clientId: string): Promise<{ error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not set in environment variables." };
  const doc = await prisma.document.findFirst({
    where: { clientId, templateType: TEMPLATE_TYPES.intakeForm, status: "APPROVED" },
    select: { id: true },
  });
  if (!doc) return { error: "No approved intake form found for this client." };
  const client = await prisma.profile.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return { error: "Client not found." };
  return {};
}

const intakeResultSchema = z.object({
  client_profile: z.object({}).passthrough(),
  verification_queue: z.object({ items: z.array(z.object({}).passthrough()).optional() }).passthrough(),
});

// ─── Agent 1 — Intake ─────────────────────────────────────────────────────────
export async function runIntakeJob(
  clientId: string
): Promise<{ result: { verificationCount: number }; usage: AgentUsage }> {
  const pre = await checkIntakePreconditions(clientId);
  if (pre.error) throw new Error(pre.error);

  const [doc, initialDoc, client] = await Promise.all([
    prisma.document.findFirst({
      where: { clientId, templateType: TEMPLATE_TYPES.intakeForm, status: "APPROVED" },
      orderBy: { completedAt: "desc" },
    }),
    // The Initial Client Form holds contact details and social/profile links —
    // feed it to the agent too so those are never re-asked.
    prisma.document.findFirst({
      where: { clientId, templateType: TEMPLATE_TYPES.initialClientForm },
      orderBy: { createdAt: "desc" },
    }),
    prisma.profile.findUnique({ where: { id: clientId }, select: { name: true, email: true } }),
  ]);
  if (!doc || !client) throw new Error("No approved intake form found for this client.");
  const clientName = client.name ?? client.email;

  const template = TEMPLATES[TEMPLATE_TYPES.intakeForm];
  const initialTemplate = TEMPLATES[TEMPLATE_TYPES.initialClientForm];
  const initialText =
    initialDoc && initialTemplate
      ? buildFormText(initialTemplate, (initialDoc.content ?? {}) as Record<string, unknown>)
      : "";
  const formText = [
    initialText && `# Initial Client Form (contact details & social/profile links)\n${initialText}`,
    `# Intake Form (business, brand, audience, competitors, goals)\n${buildFormText(template, (doc.content ?? {}) as Record<string, unknown>)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { text, usage } = await runAgentWithSearchFallback(buildIntakePrompt(clientName, formText), {
    model: MODELS.deep,
    maxTokens: 32000,
    thinking: true,
    effort: "high",
  });
  const parsed = parseJsonResponse(text, intakeResultSchema);
  const profile = parsed.client_profile as unknown as ClientProfile;
  const queue = parsed.verification_queue as unknown as VerificationQueue;

  const now = new Date().toISOString();
  // Stamp meta so it's authoritative regardless of what the model emitted.
  profile._meta = {
    ...profile._meta,
    client_id: clientId,
    company_name: profile.company?.company_name ?? clientName,
    brand_name: profile.company?.brand_name ?? "",
    created_date: now,
    created_by: "Agent 1 — Intake",
    schema_version: "1.0",
    status: "draft",
  };

  const items = queue.items ?? [];
  const pending = items.filter((i) => (i.status ?? "pending") === "pending").length;
  queue._meta = {
    ...queue._meta,
    client_id: clientId,
    company_name: profile._meta.company_name,
    generated_date: now,
    generated_by: "Agent 1 — Intake",
    schema_version: "1.0",
    total_items: items.length,
    pending_count: pending,
    resolved_count: items.length - pending,
  };

  await upsertIntakeDoc(clientId, PROFILE_DOC, profile);
  await upsertIntakeDoc(clientId, VERIFICATION_DOC, queue);

  return { result: { verificationCount: items.length }, usage };
}

// ─── Agent 2 — Strategy ─────────────────────────────────────────────────────────
export async function checkStrategyPreconditions(clientId: string): Promise<{ error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not set in environment variables." };
  const profile = await getProfile(clientId);
  if (!profile) return { error: "No client profile found. Run intake first." };
  // Hard gate — Agent 2 must not run on an unverified profile.
  if (profile._meta?.status !== "verified") {
    return { error: "Profile is not verified. Verify the client profile before generating strategy." };
  }
  return {};
}

export async function runStrategyJob(clientId: string): Promise<{ result: Record<string, never>; usage: AgentUsage }> {
  const pre = await checkStrategyPreconditions(clientId);
  if (pre.error) throw new Error(pre.error);
  const profile = (await getProfile(clientId))!;

  const { text, usage } = await runAgentWithSearchFallback(buildStrategyPrompt(profile), {
    model: MODELS.deep,
    maxTokens: 32000,
    thinking: true,
    effort: "high",
  });
  const strategy = parseJsonResponse<Record<string, unknown>>(text);

  const now = new Date().toISOString();
  strategy._meta = {
    ...(strategy._meta as Record<string, unknown>),
    client_id: clientId,
    company_name: profile._meta.company_name,
    brand_name: profile._meta.brand_name,
    created_date: now,
    created_by: "Agent 2 — Strategy",
    schema_version: "1.0",
    status: "draft",
    source: "Generated from verified client_profile.json",
  };

  await upsertIntakeDoc(clientId, STRATEGY_DOC, strategy);
  return { result: {}, usage };
}
