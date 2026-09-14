"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth/session";
import { mutateDocumentContent } from "@/lib/documents/mutate";
import { notifyClient } from "@/lib/notifications";
import { enqueueAiJob } from "@/lib/ai/jobs";
import { checkBriefDraftPreconditions } from "@/lib/ai/jobs/briefDraft";
import {
  BRIEF_DOC,
  type ProjectBrief,
  type BriefItem,
  type ScopeItem,
  type SitemapNode,
  type BriefTeamMember,
  type BriefListField,
  type BriefSection,
} from "@/lib/brief/types";

// ─── Exactly one brief per project (the project_brief Document) ───────────────

export type BriefSummary = {
  id: string;
  name: string;
  content: ProjectBrief;
  publishedAt: string | null;
  updatedAt: string;
};

function toSummary(d: { id: string; title: string; content: unknown; updatedAt: Date }): BriefSummary {
  const content = (d.content as ProjectBrief) ?? {};
  return {
    id: d.id,
    name: content.name || d.title || "Project Brief",
    content,
    publishedAt: content.publishedAt ?? null,
    updatedAt: d.updatedAt.toISOString(),
  };
}

// The single brief for a project (oldest wins if legacy data has more than one).
export async function getProjectBrief(projectId: string): Promise<BriefSummary | null> {
  const doc = await prisma.document.findFirst({
    where: { projectId, templateType: BRIEF_DOC },
    orderBy: { createdAt: "asc" },
  });
  return doc ? toSummary(doc) : null;
}

export async function renameBrief(briefDocId: string, name: string) {
  await requireTeam();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name required" };
  await mutateBrief(briefDocId, (b) => ({ ...b, name: trimmed }), { title: trimmed });
  return { ok: true };
}

// ─── Mutation core (by brief Document id) ─────────────────────────────────────
// Optimistically locked: a concurrent edit re-applies `fn` to the fresh brief.

async function mutateBrief(
  briefDocId: string,
  fn: (b: ProjectBrief) => ProjectBrief,
  extraData?: { title?: string }
) {
  const result = await mutateDocumentContent<ProjectBrief>(
    briefDocId,
    (current) => fn({ ...(current ?? {}) }),
    extraData ? { extraData } : undefined
  );
  if (result.projectId) {
    revalidatePath(`/projects/${result.projectId}`);
    revalidatePath(`/portal/brief/${result.projectId}`);
  }
  return result.projectId;
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
// Project.briefPublishedAt is the single source of truth for "the client can
// see the brief & strategy"; content.publishedAt is kept as a timestamp mirror.

export async function publishBrief(briefDocId: string): Promise<{ ok?: boolean; error?: string }> {
  await requireTeam();
  const doc = await prisma.document.findUnique({
    where: { id: briefDocId },
    include: { project: { select: { id: true, clientId: true, name: true } } },
  });
  if (!doc?.project) return { error: "Brief not found." };
  const content = (doc.content as ProjectBrief) ?? {};
  const name = content.name || doc.title || "Brief";
  const now = new Date();
  await mutateBrief(briefDocId, (b) => ({ ...b, publishedAt: now.toISOString() }));
  await prisma.project.update({ where: { id: doc.project.id }, data: { briefPublishedAt: now } });
  await notifyClient(doc.project.clientId, {
    projectId: doc.project.id,
    type: "brief_published",
    message: `${doc.project.name}: a new brief "${name}" is ready to view.`,
    link: `/portal/brief/${doc.project.id}`,
  });
  revalidatePath("/portal");
  return { ok: true };
}

export async function unpublishBrief(briefDocId: string): Promise<{ ok?: boolean; error?: string }> {
  await requireTeam();
  const projectId = await mutateBrief(briefDocId, (b) => ({ ...b, publishedAt: null }));
  if (projectId) {
    await prisma.project.update({ where: { id: projectId }, data: { briefPublishedAt: null } });
  }
  revalidatePath("/portal");
  return { ok: true };
}

// ─── AI first draft (background job — see lib/ai/jobs/briefDraft.ts) ────────

export async function generateBriefDraft(
  briefDocId: string
): Promise<{ jobId?: string; error?: string }> {
  const user = await requireTeam();
  const pre = await checkBriefDraftPreconditions(briefDocId);
  if (pre.error) return { error: pre.error };
  return enqueueAiJob("brief_draft", briefDocId, user.id);
}
