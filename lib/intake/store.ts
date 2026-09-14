import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mutateDocumentContent } from "@/lib/documents/mutate";
import {
  PROFILE_DOC,
  STRATEGY_DOC,
  VERIFICATION_DOC,
  type IntakeDocType,
  type ClientProfile,
  type Strategy,
  type VerificationQueue,
} from "./types";

// The three intake docs are the shared CLIENT DATA — stored as Document rows
// (one of each per CLIENT, projectId null, clientId set), keyed by templateType.
// content is the raw template JSON. All of a client's projects reference the
// same record; a project resolves its client via clientIdForProject().

const TITLE_SUFFIX: Record<IntakeDocType, string> = {
  [PROFILE_DOC]: "client_profile.json",
  [STRATEGY_DOC]: "strategy.json",
  [VERIFICATION_DOC]: "verification_queue.json",
};

// Resolve the parent client id for a project. Client Data lives on the client,
// so callers holding only a projectId use this to reach the shared record.
export async function clientIdForProject(projectId: string): Promise<string | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { clientId: true },
  });
  return project?.clientId ?? null;
}

export async function getDoc(clientId: string, templateType: IntakeDocType) {
  return prisma.document.findFirst({
    where: { clientId, templateType },
    orderBy: { createdAt: "desc" },
  });
}

async function getContent<T>(
  clientId: string,
  templateType: IntakeDocType
): Promise<T | null> {
  const doc = await getDoc(clientId, templateType);
  return doc ? (doc.content as T) : null;
}

export function getProfile(clientId: string) {
  return getContent<ClientProfile>(clientId, PROFILE_DOC);
}

export function getStrategy(clientId: string) {
  return getContent<Strategy>(clientId, STRATEGY_DOC);
}

export function getVerificationQueue(clientId: string) {
  return getContent<VerificationQueue>(clientId, VERIFICATION_DOC);
}

// Find-or-create + overwrite the content for one of the client-data docs
// (agent output replaces the whole document, so no merge is attempted).
export async function upsertIntakeDoc(
  clientId: string,
  templateType: IntakeDocType,
  content: unknown
) {
  const existing = await getDoc(clientId, templateType);
  const title = `${clientId}_${TITLE_SUFFIX[templateType]}`;
  if (existing) {
    await mutateDocumentContent(existing.id, () => content, { extraData: { title } });
  } else {
    await prisma.document.create({
      data: { clientId, stageNumber: 1, templateType, title, content: content as Prisma.InputJsonValue },
    });
  }
}

// Load a doc, hand its parsed content to `fn`, persist the (possibly returned)
// result under an optimistic lock — a concurrent write makes `fn` run again on
// the fresh content. Mutating in place and returning void is fine; returning a
// new object also works. Throws if the doc does not exist. Callers handle
// revalidation.
export async function mutateDoc<T>(
  clientId: string,
  templateType: IntakeDocType,
  fn: (content: T) => T | void
): Promise<void> {
  const doc = await getDoc(clientId, templateType);
  if (!doc) throw new Error(`No ${templateType} document for client ${clientId}`);
  await mutateDocumentContent<T>(doc.id, fn);
}
