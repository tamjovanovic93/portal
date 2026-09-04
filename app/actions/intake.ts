"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATES } from "@/lib/templates/registry";
import type { Template } from "@/lib/templates/types";
import { isVisible } from "@/lib/templates/visibility";
import { applyConfig, getConfig } from "@/lib/templates/config";
import {
  PROFILE_DOC,
  STRATEGY_DOC,
  VERIFICATION_DOC,
  type ClientProfile,
  type VerificationQueue,
} from "@/lib/intake/types";
import { getProfile, upsertIntakeDoc, mutateDoc } from "@/lib/intake/store";

import clientProfileTemplate from "@/lib/intake/templates/client_profile.template.json";
import strategyTemplate from "@/lib/intake/templates/strategy.template.json";
import verificationQueueTemplate from "@/lib/intake/templates/verification_queue.template.json";

// The two-agent intake pipeline. Agent 1 turns the approved intake form into a
// client_profile + verification_queue (status: draft). A human verifies the
// profile (markProfileVerified). Agent 2 then builds the strategy — but only if
// the profile is verified (hard gate).

const MODEL = "claude-opus-4-8";

// ─── Auth ────────────────────────────────────────────────────────────────────

async function requireTeam() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (user.user_metadata?.role?.toLowerCase() === "client") throw new Error("Unauthorized");
  return user;
}

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

// ─── Claude call ─────────────────────────────────────────────────────────────

// Run one agent turn. Streams (outputs are large), enables web search for the
// research step, and resumes automatically on `pause_turn` (server-tool loop
// limit). Falls back to a no-tools call if web search is unavailable.
async function callAgent(prompt: string, useWebSearch: boolean): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tools = useWebSearch
    ? [{ type: "web_search_20260209" as const, name: "web_search" as const }]
    : [];

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];

  for (let i = 0; i < 6; i++) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      tools,
      messages,
    });
    const message = await stream.finalMessage();
    messages.push({ role: "assistant", content: message.content });
    if (message.stop_reason === "pause_turn") continue;

    return message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }
  throw new Error("Agent did not finish within the allotted turns.");
}

// Models can wrap JSON in prose or code fences; extract the outermost object.
function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model response.");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

async function runWithFallback(prompt: string): Promise<string> {
  try {
    return await callAgent(prompt, true);
  } catch (err) {
    const msg = (err as Error).message ?? "";
    // Web search not enabled / unsupported on this key — retry without it.
    if (/web_search|tool|permission|not.*enabled/i.test(msg)) {
      return callAgent(prompt, false);
    }
    throw err;
  }
}

// ─── Agent 1 — Intake ─────────────────────────────────────────────────────────

function buildIntakePrompt(projectName: string, formText: string): string {
  return `You are a senior business analyst at a marketing agency. The client "${projectName}" has submitted their intake form. Produce two JSON documents that follow the provided templates exactly.

Your job:
1. Fill the client_profile from the intake form. Copy answers faithfully; make reasonable inferences where data is implied.
2. RESEARCH what the form does not cover — use web search to fill gaps about the company, its market, competitors, and industry where you can find reliable public information.
3. For every value you inferred, guessed, or could not confirm, add an item to the verification_queue so a human can confirm it. Use field_path (e.g. "company.founded_year", "competitors[0].their_weakness") and a plain-language question_for_client.

Rules:
- Follow the template structures exactly. The strings like "primary | sub | tactical" are the ALLOWED VALUES — replace each with a single chosen value, not the menu.
- Generate sequential ids per the template convention (SVC_001, CON_001, COMP_001, P001, PAIN_001, …).
- Use null / empty arrays for genuinely unknown values rather than inventing facts.
- client_profile._meta.status MUST be "draft".
- Return ONLY one raw JSON object, no markdown, with exactly two top-level keys: "client_profile" and "verification_queue".

INTAKE FORM:
${formText}

client_profile TEMPLATE:
${JSON.stringify(clientProfileTemplate)}

verification_queue TEMPLATE:
${JSON.stringify(verificationQueueTemplate)}`;
}

type IntakeResult = {
  client_profile: ClientProfile;
  verification_queue: VerificationQueue;
};

export async function runIntakeAgent(
  projectId: string
): Promise<{ success?: boolean; verificationCount?: number; error?: string }> {
  await requireTeam();

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "ANTHROPIC_API_KEY is not set in environment variables." };
  }

  const doc = await prisma.document.findFirst({
    where: { projectId, templateType: "intake_form", status: "APPROVED" },
    orderBy: { completedAt: "desc" },
  });
  if (!doc) return { error: "No approved intake form found for this project." };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  if (!project) return { error: "Project not found." };

  const template = TEMPLATES["intake_form"];
  if (!template) return { error: "Intake form template not found." };

  const formText = buildFormText(template, (doc.content ?? {}) as Record<string, unknown>);

  let result: IntakeResult;
  try {
    const text = await runWithFallback(buildIntakePrompt(project.name, formText));
    result = extractJson<IntakeResult>(text);
  } catch (err) {
    return { error: `Intake agent failed: ${(err as Error).message}` };
  }

  const now = new Date().toISOString();
  const profile = result.client_profile;
  const queue = result.verification_queue;

  // Stamp meta so it's authoritative regardless of what the model emitted.
  profile._meta = {
    ...profile._meta,
    client_id: projectId,
    company_name: profile.company?.company_name ?? project.name,
    brand_name: profile.company?.brand_name ?? "",
    created_date: now,
    created_by: "Agent 1 — Intake",
    schema_version: "1.0",
    status: "draft",
  };

  const items = queue?.items ?? [];
  const pending = items.filter((i) => (i.status ?? "pending") === "pending").length;
  queue._meta = {
    ...queue?._meta,
    client_id: projectId,
    company_name: profile._meta.company_name,
    generated_date: now,
    generated_by: "Agent 1 — Intake",
    schema_version: "1.0",
    total_items: items.length,
    pending_count: pending,
    resolved_count: items.length - pending,
  };

  await upsertIntakeDoc(projectId, PROFILE_DOC, profile);
  await upsertIntakeDoc(projectId, VERIFICATION_DOC, queue);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/brief`);

  return { success: true, verificationCount: items.length };
}

// ─── Verification gate ─────────────────────────────────────────────────────────

export async function markProfileVerified(
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  await requireTeam();
  try {
    await mutateDoc<ClientProfile>(projectId, PROFILE_DOC, (profile) => {
      profile._meta.status = "verified";
    });
  } catch {
    return { error: "No client profile to verify. Run intake first." };
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/brief`);
  return { success: true };
}

export async function markProfileDraft(
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  await requireTeam();
  try {
    await mutateDoc<ClientProfile>(projectId, PROFILE_DOC, (profile) => {
      profile._meta.status = "draft";
    });
  } catch {
    return { error: "No client profile found." };
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/brief`);
  return { success: true };
}

// ─── Agent 2 — Strategy ─────────────────────────────────────────────────────────

function buildStrategyPrompt(profile: ClientProfile): string {
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

export async function runStrategyAgent(
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  await requireTeam();

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "ANTHROPIC_API_KEY is not set in environment variables." };
  }

  const profile = await getProfile(projectId);
  if (!profile) return { error: "No client profile found. Run intake first." };

  // Hard gate — Agent 2 must not run on an unverified profile.
  if (profile._meta?.status !== "verified") {
    return { error: "Profile is not verified. Verify the client profile before generating strategy." };
  }

  let strategy: Record<string, unknown>;
  try {
    const text = await runWithFallback(buildStrategyPrompt(profile));
    strategy = extractJson<Record<string, unknown>>(text);
  } catch (err) {
    return { error: `Strategy agent failed: ${(err as Error).message}` };
  }

  const now = new Date().toISOString();
  strategy._meta = {
    ...(strategy._meta as Record<string, unknown>),
    client_id: projectId,
    company_name: profile._meta.company_name,
    brand_name: profile._meta.brand_name,
    created_date: now,
    created_by: "Agent 2 — Strategy",
    schema_version: "1.0",
    status: "draft",
    source: "Generated from verified client_profile.json",
  };

  await upsertIntakeDoc(projectId, STRATEGY_DOC, strategy);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/brief`);

  return { success: true };
}
