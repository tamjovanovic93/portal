"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { notifyClient } from "@/lib/notifications";
import {
  BRIEF_DOC,
  briefId,
  PROJECT_TYPES,
  type ProjectBrief,
  type BriefItem,
  type ScopeItem,
  type SitemapNode,
  type BriefTeamMember,
  type BriefListField,
  type BriefSection,
} from "@/lib/brief/types";

const MODEL = "claude-opus-4-8";

// ─── Auth ────────────────────────────────────────────────────────────────────
async function requireTeam() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (user.user_metadata?.role?.toLowerCase() === "client") throw new Error("Unauthorized");
  return user;
}

// ─── Multiple briefs per project (each is a project_brief Document) ───────────

export type BriefSummary = {
  id: string;
  name: string;
  content: ProjectBrief;
  publishedAt: string | null;
  updatedAt: string;
};

export async function getBriefs(projectId: string): Promise<BriefSummary[]> {
  const docs = await prisma.document.findMany({
    where: { projectId, templateType: BRIEF_DOC },
    orderBy: { createdAt: "asc" },
  });
  return docs.map((d) => {
    const content = (d.content as ProjectBrief) ?? {};
    return {
      id: d.id,
      name: content.name || d.title || "Untitled Brief",
      content,
      publishedAt: content.publishedAt ?? null,
      updatedAt: d.updatedAt.toISOString(),
    };
  });
}

// Single brief by its Document id.
export async function getBrief(briefDocId: string): Promise<ProjectBrief> {
  const doc = await prisma.document.findUnique({ where: { id: briefDocId } });
  return (doc?.content as ProjectBrief) ?? {};
}

export async function createBrief(
  projectId: string,
  name?: string
): Promise<{ id?: string; error?: string }> {
  await requireTeam();
  const count = await prisma.document.count({ where: { projectId, templateType: BRIEF_DOC } });
  const title = (name && name.trim()) || (count === 0 ? "Project Brief" : `Brief ${count + 1}`);
  const doc = await prisma.document.create({
    data: {
      projectId,
      stageNumber: 1,
      templateType: BRIEF_DOC,
      title,
      content: { name: title } as unknown as Prisma.InputJsonValue,
      status: "DRAFT",
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return { id: doc.id };
}

export async function renameBrief(briefDocId: string, name: string) {
  await requireTeam();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name required" };
  await mutateBrief(briefDocId, (b) => ({ ...b, name: trimmed }));
  await prisma.document.update({ where: { id: briefDocId }, data: { title: trimmed } });
  return { ok: true };
}

export async function deleteBrief(briefDocId: string) {
  await requireTeam();
  const doc = await prisma.document.findUnique({ where: { id: briefDocId }, select: { projectId: true } });
  await prisma.document.delete({ where: { id: briefDocId } });
  if (doc) revalidatePath(`/projects/${doc.projectId}`);
  return { ok: true };
}

// ─── Mutation core (by brief Document id) ─────────────────────────────────────

async function mutateBrief(briefDocId: string, fn: (b: ProjectBrief) => ProjectBrief) {
  const existing = await prisma.document.findUnique({ where: { id: briefDocId } });
  if (!existing) throw new Error("Brief not found");
  const current = (existing.content as ProjectBrief) ?? {};
  const next = fn({ ...current });
  await prisma.document.update({
    where: { id: briefDocId },
    data: { content: next as unknown as Prisma.InputJsonValue },
  });
  revalidatePath(`/projects/${existing.projectId}`);
  revalidatePath(`/projects/${existing.projectId}/brief`);
  revalidatePath(`/portal/brief/${existing.projectId}`);
  return existing.projectId;
}

// ─── Field / list mutators ───────────────────────────────────────────────────

export async function saveBriefFields(
  briefDocId: string,
  patch: Partial<Pick<ProjectBrief, "projectType" | "status" | "ownerId" | "clientContact" | "overview">>
) {
  await requireTeam();
  await mutateBrief(briefDocId, (b) => ({ ...b, ...patch }));
  return { ok: true };
}

export async function updateBriefDates(briefDocId: string, dates: { start?: string | null; end?: string | null }) {
  await requireTeam();
  await mutateBrief(briefDocId, (b) => ({ ...b, dates }));
  return { ok: true };
}

export async function updateBriefList(briefDocId: string, field: BriefListField, items: BriefItem[] | ScopeItem[]) {
  await requireTeam();
  await mutateBrief(briefDocId, (b) => ({ ...b, [field]: items }));
  return { ok: true };
}

export async function updateBriefSitemap(briefDocId: string, nodes: SitemapNode[]) {
  await requireTeam();
  await mutateBrief(briefDocId, (b) => ({ ...b, sitemap: nodes }));
  return { ok: true };
}

export async function updateBriefTeam(briefDocId: string, team: BriefTeamMember[]) {
  await requireTeam();
  await mutateBrief(briefDocId, (b) => ({ ...b, team }));
  return { ok: true };
}

// Full section config (order / hidden / visibility / custom text). One call
// handles add / remove / hide / reorder / rename / visibility.
export async function updateBriefSections(briefDocId: string, sections: BriefSection[]) {
  await requireTeam();
  await mutateBrief(briefDocId, (b) => ({ ...b, sections }));
  return { ok: true };
}

export async function setSectionVisibility(briefDocId: string, key: string, visibleToClient: boolean) {
  await requireTeam();
  await mutateBrief(briefDocId, (b) => {
    const base = b.sections && b.sections.length > 0 ? b.sections : undefined;
    if (!base) return b; // no explicit config yet — caller sends full config instead
    return { ...b, sections: base.map((s) => (s.key === key ? { ...s, visibleToClient } : s)) };
  });
  return { ok: true };
}

// ─── Publish to client ────────────────────────────────────────────────────────

export async function publishBrief(briefDocId: string): Promise<{ ok?: boolean; error?: string }> {
  await requireTeam();
  const doc = await prisma.document.findUnique({
    where: { id: briefDocId },
    include: { project: { select: { id: true, clientId: true, name: true } } },
  });
  if (!doc) return { error: "Brief not found." };
  const content = (doc.content as ProjectBrief) ?? {};
  const name = content.name || doc.title || "Brief";
  await mutateBrief(briefDocId, (b) => ({ ...b, publishedAt: new Date().toISOString() }));
  await notifyClient(doc.project.clientId, {
    projectId: doc.project.id,
    type: "brief_published",
    message: `${doc.project.name}: a new brief "${name}" is ready to view.`,
    link: `/portal/brief/${doc.project.id}`,
  });
  return { ok: true };
}

export async function unpublishBrief(briefDocId: string): Promise<{ ok?: boolean; error?: string }> {
  await requireTeam();
  await mutateBrief(briefDocId, (b) => ({ ...b, publishedAt: null }));
  return { ok: true };
}

// ─── AI first draft ──────────────────────────────────────────────────────────

function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model response.");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

type DraftResult = {
  project_type?: string;
  overview?: string;
  scope?: string[];
  key_functions?: string[];
  sitemap?: { name: string; children?: string[] }[];
};

export async function generateBriefDraft(
  briefDocId: string
): Promise<{ success?: boolean; error?: string }> {
  await requireTeam();
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not set." };

  const briefDocRow = await prisma.document.findUnique({ where: { id: briefDocId }, select: { projectId: true } });
  if (!briefDocRow) return { error: "Brief not found." };
  const projectId = briefDocRow.projectId;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, type: true },
  });
  if (!project) return { error: "Project not found." };

  // Approved source docs + Data profile — read-only inputs for the draft.
  const [intakeDoc, initialDoc, profileDoc] = await Promise.all([
    prisma.document.findFirst({ where: { projectId, templateType: "intake_form", status: "APPROVED" }, orderBy: { completedAt: "desc" } }),
    prisma.document.findFirst({ where: { projectId, templateType: "initial_client_form", status: "APPROVED" }, orderBy: { completedAt: "desc" } }),
    prisma.document.findFirst({ where: { projectId, templateType: "client_profile" } }),
  ]);

  const sources = {
    project_name: project.name,
    project_type_hint: project.type,
    initial_client_form: initialDoc?.content ?? null,
    intake_form: intakeDoc?.content ?? null,
    company: (profileDoc?.content as { company?: unknown } | null)?.company ?? null,
  };

  const prompt = `You are preparing the internal PROJECT BRIEF for a web/design agency ("Zero Point"). The brief defines ONLY what this project is and what we are building — NOT the client's audience, brand, positioning, messaging, competitors, business info, or budget (those live in a separate "Data" section — do not restate them).

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

  let draft: DraftResult;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });
    const message = await stream.finalMessage();
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    draft = extractJson<DraftResult>(text);
  } catch (err) {
    return { error: `Brief draft failed: ${(err as Error).message}` };
  }

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
  await mutateBrief(briefDocId, (b) => ({
    ...b,
    projectType: validType ?? b.projectType,
    overview: draft.overview || b.overview,
    scope: scope.length ? scope : b.scope,
    keyFunctions: keyFunctions.length ? keyFunctions : b.keyFunctions,
    sitemap: sitemap.length ? sitemap : b.sitemap,
    _meta: { ...b._meta, generatedAt: new Date().toISOString() },
  }));

  return { success: true };
}
