"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { Prisma, ProjectType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getStrategy } from "@/lib/intake/store";
import { getBrandKit } from "@/app/actions/brand-kit";
import { STAGE_COUNT } from "@/lib/stages";
import {
  BRIEF_DOC,
  briefId,
  PROJECT_TYPES,
  type ProjectBrief,
  type ScopeItem,
  type BriefItem,
  type SitemapNode,
} from "@/lib/brief/types";

const MODEL = "claude-opus-4-8";

async function requireTeam() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role?.toLowerCase() === "client") {
    throw new Error("Unauthorized");
  }
  return user;
}

function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model response.");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

// Map a free-form brief project-type string onto the Project.type enum.
function toProjectType(hint: string | null | undefined): ProjectType {
  const s = (hint ?? "").toLowerCase();
  if (/brand/.test(s)) return "BRANDING";
  if (/market|seo|ad|campaign|content|social|instagram|linkedin/.test(s)) return "MARKETING";
  if (/web|commerce|app|platform|site|landing/.test(s)) return "WEBSITE";
  if (/crm|software|system|dashboard|portal/.test(s)) return "SOFTWARE_CRM";
  return "OTHER";
}

type SuggestionDraft = {
  name?: string;
  project_type?: string;
  rationale?: string;
  overview?: string;
  scope?: string[];
  key_functions?: string[];
  sitemap?: { name: string; children?: string[] }[];
};

function draftToBrief(d: SuggestionDraft): ProjectBrief {
  const validType =
    d.project_type && (PROJECT_TYPES as readonly string[]).includes(d.project_type)
      ? d.project_type
      : undefined;
  const scope: ScopeItem[] = (d.scope ?? []).filter(Boolean).map((t) => ({ id: briefId("s"), text: String(t) }));
  const keyFunctions: BriefItem[] = (d.key_functions ?? []).filter(Boolean).map((t) => ({ id: briefId("f"), text: String(t) }));
  const sitemap: SitemapNode[] = (d.sitemap ?? [])
    .filter((n) => n && n.name)
    .map((n) => ({
      id: briefId("p"),
      name: String(n.name),
      children: (n.children ?? []).filter(Boolean).map((c) => ({ id: briefId("p"), name: String(c) })),
    }));
  return {
    name: d.name || "Untitled project",
    projectType: validType,
    overview: d.overview || "",
    scope,
    keyFunctions,
    sitemap,
    _meta: { generatedAt: new Date().toISOString() },
  };
}

// Analyze everything known about the client and propose Projects (each with a
// pre-filled Brief). Re-runnable — appends new PENDING suggestions; never
// auto-approves. Requires Client Data to be ready (verified profile + strategy).
export async function generateSuggestedProjects(
  clientId: string
): Promise<{ success?: boolean; count?: number; error?: string }> {
  await requireTeam();
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not set." };

  const [profile, strategy, brandKit] = await Promise.all([
    getProfile(clientId),
    getStrategy(clientId),
    getBrandKit(clientId),
  ]);
  if (!profile) return { error: "No client profile yet. Run the intake pipeline first." };
  if (profile._meta?.status !== "verified") return { error: "Verify the client profile first." };
  if (!strategy) return { error: "No strategy yet. Generate the strategy first." };

  const existing = await prisma.suggestedProject.findMany({
    where: { clientId },
    select: { name: true, status: true },
  });
  const existingNames = existing.map((s) => s.name);

  const prompt = `You are a senior strategist at a web/design/marketing agency. Using everything known about this client below, propose the distinct PROJECTS the agency should deliver. Decide what actually makes sense for THIS client — do not use a fixed list. Examples of possible projects: Website, E-commerce, Brand identity, SEO, Advertising campaign, Landing page, Content strategy, LinkedIn, Instagram — but choose only what the data supports.

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

  let result: { projects?: SuggestionDraft[] };
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });
    const message = await stream.finalMessage();
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    result = extractJson(text);
  } catch (err) {
    return { error: `Suggestion agent failed: ${(err as Error).message}` };
  }

  const drafts = (result.projects ?? []).filter((p) => p && p.name);
  if (drafts.length === 0) return { error: "The agent did not return any project suggestions." };

  await prisma.suggestedProject.createMany({
    data: drafts.map((d) => ({
      clientId,
      name: String(d.name),
      projectType: d.project_type ?? null,
      rationale: d.rationale ?? null,
      briefDraft: draftToBrief(d) as unknown as Prisma.InputJsonValue,
      status: "PENDING" as const,
    })),
  });

  revalidatePath(`/clients/${clientId}/data`);
  return { success: true, count: drafts.length };
}

export async function updateSuggestion(
  id: string,
  patch: { name?: string; projectType?: string | null }
): Promise<{ ok?: boolean; error?: string }> {
  await requireTeam();
  const s = await prisma.suggestedProject.findUnique({ where: { id }, select: { clientId: true, briefDraft: true } });
  if (!s) return { error: "Suggestion not found." };
  const brief = (s.briefDraft as ProjectBrief) ?? {};
  await prisma.suggestedProject.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.projectType !== undefined ? { projectType: patch.projectType } : {}),
      briefDraft: {
        ...brief,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.projectType !== undefined ? { projectType: patch.projectType ?? undefined } : {}),
      } as unknown as Prisma.InputJsonValue,
    },
  });
  revalidatePath(`/clients/${s.clientId}/data`);
  return { ok: true };
}

export async function updateSuggestionBrief(
  id: string,
  briefDraft: ProjectBrief
): Promise<{ ok?: boolean; error?: string }> {
  await requireTeam();
  const s = await prisma.suggestedProject.findUnique({ where: { id }, select: { clientId: true } });
  if (!s) return { error: "Suggestion not found." };
  await prisma.suggestedProject.update({
    where: { id },
    data: { briefDraft: briefDraft as unknown as Prisma.InputJsonValue },
  });
  revalidatePath(`/clients/${s.clientId}/data`);
  return { ok: true };
}

export async function rejectSuggestion(id: string): Promise<{ ok?: boolean; error?: string }> {
  await requireTeam();
  const s = await prisma.suggestedProject.findUnique({ where: { id }, select: { clientId: true, status: true } });
  if (!s) return { error: "Suggestion not found." };
  if (s.status === "APPROVED") return { error: "This suggestion is already an approved project." };
  await prisma.suggestedProject.update({ where: { id }, data: { status: "REJECTED" } });
  revalidatePath(`/clients/${s.clientId}/data`);
  return { ok: true };
}

// Approve → create a real Project for the client, seed its 7 stages (Strategy=1),
// and save the approved brief as the project's single Brief. Idempotent.
export async function approveSuggestion(id: string): Promise<{ ok?: boolean; projectId?: string; error?: string }> {
  await requireTeam();
  const s = await prisma.suggestedProject.findUnique({ where: { id } });
  if (!s) return { error: "Suggestion not found." };
  if (s.status === "APPROVED" && s.approvedProjectId) {
    return { ok: true, projectId: s.approvedProjectId };
  }

  const brief = (s.briefDraft as ProjectBrief) ?? {};
  const briefName = brief.name || s.name;

  const project = await prisma.project.create({
    data: {
      name: s.name,
      clientId: s.clientId,
      type: toProjectType(s.projectType),
      mode: "PROJECT",
      currentStage: 1,
      stages: {
        create: Array.from({ length: STAGE_COUNT }, (_, i) => ({
          stageNumber: i + 1,
          status: i === 0 ? "IN_PROGRESS" : "NOT_STARTED",
        })),
      },
      documents: {
        create: {
          stageNumber: 1,
          templateType: BRIEF_DOC,
          title: briefName,
          content: { ...brief, name: briefName } as unknown as Prisma.InputJsonValue,
          status: "DRAFT",
        },
      },
    },
  });

  await prisma.suggestedProject.update({
    where: { id },
    data: { status: "APPROVED", approvedProjectId: project.id },
  });

  revalidatePath(`/clients/${s.clientId}`);
  revalidatePath(`/clients/${s.clientId}/data`);
  revalidatePath("/dashboard");
  return { ok: true, projectId: project.id };
}
