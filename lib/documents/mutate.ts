import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Read-modify-write on Document.content with optimistic locking. The update is
// conditional on the version we read; if another writer got there first the
// mutator is re-applied to the fresh content. Mutators must therefore be pure
// functions of the content (mutating the passed object in place is fine —
// a retry starts from a freshly loaded copy).

export class DocumentNotFoundError extends Error {
  constructor(message = "Document not found") {
    super(message);
    this.name = "DocumentNotFoundError";
  }
}

export class ConcurrentUpdateError extends Error {
  constructor() {
    super("The document was changed by someone else. Please try again.");
    this.name = "ConcurrentUpdateError";
  }
}

const MAX_ATTEMPTS = 4;

type MutateOptions = {
  // Extra scalar columns written in the same statement (e.g. title).
  extraData?: Omit<Prisma.DocumentUpdateManyMutationInput, "content" | "version">;
};

export type MutatedDocument<T> = {
  id: string;
  projectId: string | null;
  clientId: string | null;
  templateType: string;
  content: T;
};

export async function mutateDocumentContent<T>(
  documentId: string,
  fn: (content: T) => T | void,
  options: MutateOptions = {}
): Promise<MutatedDocument<T>> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, projectId: true, clientId: true, templateType: true, content: true, version: true },
    });
    if (!doc) throw new DocumentNotFoundError();

    const current = ((doc.content ?? {}) as T);
    const next = fn(current) ?? current;

    const result = await prisma.document.updateMany({
      where: { id: documentId, version: doc.version },
      data: {
        ...options.extraData,
        content: next as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
    if (result.count === 1) {
      return { id: doc.id, projectId: doc.projectId, clientId: doc.clientId, templateType: doc.templateType, content: next };
    }
  }
  throw new ConcurrentUpdateError();
}

// Merge a full form submission over the latest stored content so a concurrent
// collaboration edit (a team question added while the client was typing) is
// not clobbered. Scalars from the submission win; `_collab` is merged per field.
type Collab = Record<string, Record<string, unknown>>;

export function mergeFormContent(
  latest: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const latestCollab = (latest._collab as Collab | undefined) ?? {};
  const incomingCollab = (incoming._collab as Collab | undefined) ?? {};
  const keys = new Set([...Object.keys(latestCollab), ...Object.keys(incomingCollab)]);
  const collab: Collab = {};
  for (const k of keys) collab[k] = { ...latestCollab[k], ...incomingCollab[k] };

  const merged: Record<string, unknown> = { ...latest, ...incoming };
  if (keys.size > 0) merged._collab = collab;
  if (incoming._config === undefined && latest._config !== undefined) merged._config = latest._config;
  return merged;
}
