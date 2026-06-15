import type { TaskOwnerRole } from "@prisma/client";

// Plain module (no "use client") so both server and client components get the
// real values — importing these from a client component into a server component
// yields client references, not the objects themselves.

export const OWNER_ROLES: { value: TaskOwnerRole; label: string }[] = [
  { value: "PROJECT_MANAGER", label: "Project Manager" },
  { value: "DEV_TEAM", label: "Dev Team" },
  { value: "DESIGN_TEAM", label: "Design Team" },
  { value: "CLIENT", label: "Client" },
];

export const OWNER_ROLE_LABEL: Record<TaskOwnerRole, string> = {
  PROJECT_MANAGER: "Project Manager",
  DEV_TEAM: "Dev Team",
  DESIGN_TEAM: "Design Team",
  CLIENT: "Client",
};
