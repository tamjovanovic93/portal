import { z } from "zod";
import {
  EventType,
  MaterialItemStatus,
  ProjectMode,
  ProjectType,
  TaskOwnerRole,
  TaskStatus,
  TaskType,
} from "@prisma/client";
import { STAGE_COUNT } from "@/lib/stages";
import { checkbox, email, optionalDate, optionalText, requiredDate, requiredText, trimmed, uuid } from "./form";

export const MATERIAL_CATEGORY_VALUES = ["copy", "visuals", "info", "access", "approval"] as const;
export const ACCENT_VALUES = ["mint", "blue", "amber", "rose", "purple"] as const;

const enumOf = <T extends Record<string, string>>(e: T, params?: { message?: string }) =>
  z.nativeEnum(e, params ? { errorMap: () => ({ message: params.message ?? "Invalid value." }) } : undefined);

// ── Materials ──
export const addMaterialSchema = z.object({
  projectId: uuid,
  label: requiredText("Label"),
  category: z.enum(MATERIAL_CATEGORY_VALUES, { message: "Pick a category." }),
  notes: optionalText,
  dueDate: optionalDate,
});

export const updateMaterialSchema = z.object({
  itemId: uuid,
  label: requiredText("Label"),
  category: z.enum(MATERIAL_CATEGORY_VALUES, { message: "Pick a category." }),
  notes: optionalText,
  dueDate: optionalDate,
  status: enumOf(MaterialItemStatus).optional(),
});

// ── Calendar events ──
export const eventSchema = z.object({
  title: requiredText("Title"),
  startAt: requiredDate("Start date"),
  endAt: optionalDate,
  type: enumOf(EventType).catch("APPOINTMENT"),
  description: optionalText,
  projectId: trimmed.optional().transform((v) => (v ? v : null)),
  allDay: checkbox,
});

// ── Retainer cycles & tasks ──
export const createCycleSchema = z.object({
  name: requiredText("Name"),
  focus: optionalText,
  startDate: requiredDate("Start date"),
  endDate: optionalDate,
});

export const addTaskSchema = z.object({
  name: requiredText("Name"),
  type: enumOf(TaskType).catch("DELIVERABLE"),
  description: optionalText,
  dueDate: optionalDate,
  ownerRole: enumOf(TaskOwnerRole).optional().catch(undefined),
  assigneeId: trimmed.optional().transform((v) => (v ? v : null)),
  status: enumOf(TaskStatus).catch("PLANNING"),
  blockerResolver: enumOf(TaskOwnerRole).optional().catch(undefined),
  requiresClientApproval: checkbox,
  isBlocker: checkbox,
});

export const stageNumberSchema = z.number().int().min(1).max(STAGE_COUNT);

// ── Clients / projects / team ──
export const createClientSchema = z.object({
  name: requiredText("Business name"),
  email,
  mode: enumOf(ProjectMode).catch("PROJECT"),
});

export const createProjectSchema = z.object({
  name: requiredText("Project name"),
  clientChoice: z.enum(["new", "existing"]).catch("new"),
  existingClientId: trimmed.optional(),
  clientEmail: trimmed.toLowerCase().optional(),
  type: enumOf(ProjectType, { message: "Project type is required." }),
  mode: enumOf(ProjectMode).catch("PROJECT"),
});

export const teamMemberSchema = z.object({
  email: email.optional(),
  name: optionalText,
  title: optionalText,
  skills: trimmed.optional().transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  ),
  bio: optionalText,
  photoUrl: optionalText,
  accent: z.enum(ACCENT_VALUES).optional().catch(undefined),
  availHours: trimmed.optional().default(""),
  availTz: trimmed.optional().default(""),
  availNote: trimmed.optional().default(""),
});
