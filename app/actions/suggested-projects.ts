"use server";

import { revalidatePath } from "next/cache";
import { Prisma, ProjectType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth/session";
import { enqueueAiJob } from "@/lib/ai/jobs";
import { checkSuggestionsPreconditions } from "@/lib/ai/jobs/suggestions";
import { STAGE_COUNT } from "@/lib/stages";
import { BRIEF_DOC, type ProjectBrief } from "@/lib/brief/types";

// Map a free-form brief project-type string onto the Project.type enum.
function toProjectType(hint: string | null | undefined): ProjectType {
  const s = (hint ?? "").toLowerCase();
  if (/brand/.test(s)) return "BRANDING";
  if (/market|seo|ad|campaign|content|social|instagram|linkedin/.test(s)) return "MARKETING";
  if (/web|commerce|app|platform|site|landing/.test(s)) return "WEBSITE";
  if (/crm|software|system|dashboard|portal/.test(s)) return "SOFTWARE_CRM";
  return "OTHER";
}

// Analyze everything known about the client and propose Projects — runs as a
// background job (lib/ai/jobs/suggestions.ts); the UI polls the returned job.
export async function generateSuggestedProjects(
  clientId: string
): Promise<{ jobId?: string; error?: string }> {
  const user = await requireTeam();
  const pre = await checkSuggestionsPreconditions(clientId);
  if (pre.error) return { error: pre.error };
  return enqueueAiJob("suggestions", clientId, user.id);
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

  // Project + brief + suggestion status in one transaction so a double-click
  // or a failure never leaves an approved suggestion without a project.
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
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
    const claimed = await tx.suggestedProject.updateMany({
      where: { id, status: { not: "APPROVED" } },
      data: { status: "APPROVED", approvedProjectId: created.id },
    });
    if (claimed.count === 0) throw new Error("This suggestion was already approved.");
    return created;
  });

  revalidatePath(`/clients/${s.clientId}`);
  revalidatePath(`/clients/${s.clientId}/data`);
  revalidatePath("/dashboard");
  return { ok: true, projectId: project.id };
}
