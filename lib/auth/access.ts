import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError, type SessionUser } from "./session";

// Ownership guards. Each one loads the entity it checks and returns it so the
// caller does not query again. Team members pass every guard; clients only pass
// for records that belong to them.

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export async function requireProjectAccess(projectId: string) {
  const user = await requireUser();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, clientId: true, name: true, mode: true, currentStage: true },
  });
  if (!project) throw new NotFoundError("Project not found");
  if (user.role !== "TEAM" && project.clientId !== user.id) throw new UnauthorizedError();
  return { user, project };
}

// A document is owned by a client directly (client-scoped) or via its project.
export async function requireDocumentAccess(documentId: string) {
  const user = await requireUser();
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      project: { select: { id: true, clientId: true, name: true } },
      client: { select: { id: true, name: true, email: true } },
    },
  });
  if (!doc) throw new NotFoundError("Document not found");
  const ownerClientId = doc.clientId ?? doc.project?.clientId ?? null;
  if (user.role !== "TEAM" && ownerClientId !== user.id) throw new UnauthorizedError();
  return { user, doc, ownerClientId };
}

export async function requireTaskAccess(taskId: string) {
  const user = await requireUser();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      approvals: { where: { taskId: { not: null } }, select: { id: true } },
      cycle: { select: { project: { select: { id: true, clientId: true } } } },
    },
  });
  if (!task) throw new NotFoundError("Task not found");
  if (user.role !== "TEAM" && task.cycle.project.clientId !== user.id) throw new UnauthorizedError();
  return { user, task, projectId: task.cycle.project.id };
}

export function isClientOwner(user: SessionUser, clientId: string | null | undefined): boolean {
  return user.role === "TEAM" || (!!clientId && clientId === user.id);
}
