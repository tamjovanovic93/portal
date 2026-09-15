import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mutateDocumentContent } from "@/lib/documents/mutate";
import { TEMPLATE_TYPES } from "@/lib/documents/types";
import { briefId, PROJECT_TYPES, type ProjectBrief, type ScopeItem, type BriefItem, type SitemapNode } from "@/lib/brief/types";
import { runAgent, parseJsonResponse, type AgentUsage } from "../client";
import { MODELS } from "../models";
import { buildBriefDraftPrompt } from "../prompts/briefDraft";
import { getSecret } from "@/lib/secrets";

const draftSchema = z.object({
  project_type: z.string().nullable().optional(),
  overview: z.string().nullable().optional(),
  scope: z.array(z.string()).nullable().optional(),
  key_functions: z.array(z.string()).nullable().optional(),
  sitemap: z.array(z.object({ name: z.string(), children: z.array(z.string()).nullable().optional() })).nullable().optional(),
});

export async function checkBriefDraftPreconditions(briefDocId: string): Promise<{ error?: string; projectId?: string }> {
  if (!(await getSecret("ANTHROPIC_API_KEY"))) return { error: "ANTHROPIC_API_KEY is not set." };
  const brief = await prisma.document.findUnique({ where: { id: briefDocId }, select: { projectId: true } });
  if (!brief?.projectId) return { error: "Brief not found." };
  return { projectId: brief.projectId };
}

export async function runBriefDraftJob(briefDocId: string): Promise<{ result: { projectId: string }; usage: AgentUsage }> {
  const pre = await checkBriefDraftPreconditions(briefDocId);
  if (pre.error || !pre.projectId) throw new Error(pre.error ?? "Brief not found.");
  const projectId = pre.projectId;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, type: true, clientId: true },
  });
  if (!project) throw new Error("Project not found.");

  // The client's approved onboarding forms + shared profile — read-only inputs.
  const [intakeDoc, initialDoc, profileDoc] = await Promise.all([
    prisma.document.findFirst({ where: { clientId: project.clientId, templateType: TEMPLATE_TYPES.intakeForm, status: "APPROVED" }, orderBy: { completedAt: "desc" } }),
    prisma.document.findFirst({ where: { clientId: project.clientId, templateType: TEMPLATE_TYPES.initialClientForm, status: "APPROVED" }, orderBy: { completedAt: "desc" } }),
    prisma.document.findFirst({ where: { clientId: project.clientId, templateType: TEMPLATE_TYPES.clientProfile } }),
  ]);

  const sources = {
    project_name: project.name,
    project_type_hint: project.type,
    initial_client_form: initialDoc?.content ?? null,
    intake_form: intakeDoc?.content ?? null,
    company: (profileDoc?.content as { company?: unknown } | null)?.company ?? null,
  };

  const { text, usage } = await runAgent(buildBriefDraftPrompt(sources), {
    model: MODELS.deep,
    maxTokens: 8000,
    thinking: true,
  });
  const draft = parseJsonResponse(text, draftSchema);

  const validType = draft.project_type && (PROJECT_TYPES as readonly string[]).includes(draft.project_type)
    ? draft.project_type
    : undefined;
  const scope: ScopeItem[] = (draft.scope ?? []).filter(Boolean).map((t) => ({ id: briefId("s"), text: String(t) }));
  const keyFunctions: BriefItem[] = (draft.key_functions ?? []).filter(Boolean).map((t) => ({ id: briefId("f"), text: String(t) }));
  const sitemap: SitemapNode[] = (draft.sitemap ?? []).filter((n) => n && n.name).map((n) => ({
    id: briefId("p"),
    name: String(n.name),
    children: (n.children ?? []).filter(Boolean).map((c) => ({ id: briefId("p"), name: String(c) })),
  }));

  // Merge: fill draft-able fields where the agent produced something, never
  // clobber human-owned fields (owner, team, status, client contact).
  await mutateDocumentContent<ProjectBrief>(briefDocId, (b) => ({
    ...b,
    projectType: validType ?? b.projectType,
    overview: draft.overview || b.overview,
    scope: scope.length ? scope : b.scope,
    keyFunctions: keyFunctions.length ? keyFunctions : b.keyFunctions,
    sitemap: sitemap.length ? sitemap : b.sitemap,
    _meta: { ...b._meta, generatedAt: new Date().toISOString() },
  }));

  return { result: { projectId }, usage };
}
