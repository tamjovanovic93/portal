import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProfile, getStrategy } from "@/lib/intake/store";
import { getBrandKit } from "@/app/actions/brand-kit";
import { briefId, PROJECT_TYPES, type ProjectBrief, type ScopeItem, type BriefItem, type SitemapNode } from "@/lib/brief/types";
import { runAgent, parseJsonResponse, type AgentUsage } from "../client";
import { MODELS } from "../models";
import { buildSuggestionsPrompt } from "../prompts/suggestions";

const suggestionSchema = z.object({
  name: z.string().min(1),
  project_type: z.string().nullable().optional(),
  rationale: z.string().nullable().optional(),
  overview: z.string().nullable().optional(),
  scope: z.array(z.string()).optional(),
  key_functions: z.array(z.string()).optional(),
  sitemap: z.array(z.object({ name: z.string(), children: z.array(z.string()).optional() })).optional(),
});
const resultSchema = z.object({ projects: z.array(suggestionSchema).optional() });
type SuggestionDraft = z.infer<typeof suggestionSchema>;

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

export async function checkSuggestionsPreconditions(clientId: string): Promise<{ error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not set." };
  const [profile, strategy] = await Promise.all([getProfile(clientId), getStrategy(clientId)]);
  if (!profile) return { error: "No client profile yet. Run the intake pipeline first." };
  if (profile._meta?.status !== "verified") return { error: "Verify the client profile first." };
  if (!strategy) return { error: "No strategy yet. Generate the strategy first." };
  return {};
}

// Analyze everything known about the client and propose Projects (each with a
// pre-filled Brief). Re-runnable — appends new PENDING suggestions; never
// auto-approves.
export async function runSuggestionsJob(clientId: string): Promise<{ result: { count: number }; usage: AgentUsage }> {
  const pre = await checkSuggestionsPreconditions(clientId);
  if (pre.error) throw new Error(pre.error);

  const [profile, strategy, brandKit, existing] = await Promise.all([
    getProfile(clientId),
    getStrategy(clientId),
    getBrandKit(clientId),
    prisma.suggestedProject.findMany({ where: { clientId }, select: { name: true } }),
  ]);

  const { text, usage } = await runAgent(
    buildSuggestionsPrompt({ profile, strategy, brandKit, existingNames: existing.map((s) => s.name) }),
    { model: MODELS.deep, maxTokens: 16000, thinking: true }
  );
  const result = parseJsonResponse(text, resultSchema);
  const drafts = (result.projects ?? []).filter((p) => p && p.name);
  if (drafts.length === 0) throw new Error("The agent did not return any project suggestions.");

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

  return { result: { count: drafts.length }, usage };
}
