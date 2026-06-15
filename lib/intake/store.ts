import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PROFILE_DOC,
  STRATEGY_DOC,
  VERIFICATION_DOC,
  type IntakeDocType,
  type ClientProfile,
  type Strategy,
  type VerificationQueue,
} from "./types";

// The three intake docs are stored as Document rows (one of each per project),
// keyed by templateType. content is the raw template JSON.

const TITLE_SUFFIX: Record<IntakeDocType, string> = {
  [PROFILE_DOC]: "client_profile.json",
  [STRATEGY_DOC]: "strategy.json",
  [VERIFICATION_DOC]: "verification_queue.json",
};

export async function getDoc(projectId: string, templateType: IntakeDocType) {
  return prisma.document.findFirst({
    where: { projectId, templateType },
    orderBy: { createdAt: "desc" },
  });
}

async function getContent<T>(
  projectId: string,
  templateType: IntakeDocType
): Promise<T | null> {
  const doc = await getDoc(projectId, templateType);
  return doc ? (doc.content as T) : null;
}

export function getProfile(projectId: string) {
  return getContent<ClientProfile>(projectId, PROFILE_DOC);
}

export function getStrategy(projectId: string) {
  return getContent<Strategy>(projectId, STRATEGY_DOC);
}

export function getVerificationQueue(projectId: string) {
  return getContent<VerificationQueue>(projectId, VERIFICATION_DOC);
}

// Find-or-create + overwrite the content for one of the three intake docs.
export async function upsertIntakeDoc(
  projectId: string,
  templateType: IntakeDocType,
  content: unknown
) {
  const existing = await getDoc(projectId, templateType);
  const data = {
    title: `${projectId}_${TITLE_SUFFIX[templateType]}`,
    content: content as Prisma.InputJsonValue,
  };
  if (existing) {
    await prisma.document.update({ where: { id: existing.id }, data });
  } else {
    await prisma.document.create({
      data: { projectId, stageNumber: 1, templateType, ...data },
    });
  }
}

// Load a doc, hand its parsed content to `fn`, persist the (possibly returned)
// result. Mutating in place and returning void is fine; returning a new object
// also works. Throws if the doc does not exist. Callers handle revalidation.
export async function mutateDoc<T>(
  projectId: string,
  templateType: IntakeDocType,
  fn: (content: T) => T | void
): Promise<void> {
  const doc = await getDoc(projectId, templateType);
  if (!doc) throw new Error(`No ${templateType} document for project ${projectId}`);
  const content = doc.content as T;
  const next = fn(content) ?? content;
  await prisma.document.update({
    where: { id: doc.id },
    data: { content: next as Prisma.InputJsonValue },
  });
}
