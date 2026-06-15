"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { mutateDoc } from "@/lib/intake/store";
import {
  PROFILE_DOC,
  VERIFICATION_DOC,
  type IntakeDocType,
  type ClientProfile,
  type VerificationQueue,
} from "@/lib/intake/types";

// Generic editor for the JSON intake documents (client_profile / strategy).
// Replaces the old per-table CRUD: every Brief & Data table now points at an
// array inside one of the two JSON docs, addressed by `path`.

type Row = Record<string, unknown>;

export type SectionConfig = {
  doc: IntakeDocType;
  // "services" | "messaging.key_messages" | "personas.*.pain_points"
  path: string;
  idField: string; // e.g. "service_id"
  idPrefix: string; // e.g. "SVC"
};

async function requireTeam() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (user.user_metadata?.role?.toLowerCase() === "client") throw new Error("Unauthorized");
}

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}/brief`);
  revalidatePath(`/projects/${projectId}`);
}

// Resolve a dotted path to the parent object + final key.
function resolveParent(content: Row, dotted: string): { parent: Row; key: string } {
  const parts = dotted.split(".");
  let node: Row = content;
  for (let i = 0; i < parts.length - 1; i++) {
    node[parts[i]] ??= {};
    node = node[parts[i]] as Row;
  }
  return { parent: node, key: parts[parts.length - 1] };
}

// Every array a `path` addresses. For "A.*.B" this is the B array of every
// element of A; otherwise it's the single array at `path`.
function targetArrays(content: Row, path: string): Row[][] {
  if (path.includes(".*.")) {
    const [parentPath, childKey] = path.split(".*.");
    const { parent, key } = resolveParent(content, parentPath);
    const elements = (parent[key] as Row[]) ?? [];
    return elements.map((el) => ((el[childKey] ??= []) as Row[]));
  }
  const { parent, key } = resolveParent(content, path);
  parent[key] ??= [];
  return [parent[key] as Row[]];
}

function nextId(arrays: Row[][], idField: string, prefix: string): string {
  let max = 0;
  for (const arr of arrays) {
    for (const row of arr) {
      const m = String(row[idField] ?? "").match(/(\d+)\s*$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `${prefix}_${String(max + 1).padStart(3, "0")}`;
}

// FormData arrives as strings; coerce the obvious booleans so the table renders
// Yes/No rather than the literal text.
function coerce(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

export async function addRow(cfg: SectionConfig, projectId: string, formData: FormData) {
  await requireTeam();
  await mutateDoc<Row>(projectId, cfg.doc, (content) => {
    const arrays = targetArrays(content, cfg.path);
    const target = arrays[0];
    if (!target) return; // aggregate path with no parent element — nothing to add to
    const row: Row = { [cfg.idField]: nextId(arrays, cfg.idField, cfg.idPrefix) };
    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string" || value === "") continue;
      row[key] = coerce(value);
    }
    target.push(row);
  });
  revalidate(projectId);
}

export async function deleteRow(cfg: SectionConfig, projectId: string, id: string) {
  await requireTeam();
  await mutateDoc<Row>(projectId, cfg.doc, (content) => {
    for (const arr of targetArrays(content, cfg.path)) {
      const idx = arr.findIndex((r) => r[cfg.idField] === id);
      if (idx !== -1) {
        arr.splice(idx, 1);
        return;
      }
    }
  });
  revalidate(projectId);
}

// Company is a single object (not an array). The CompanyCard form uses camelCase
// names; map them onto the snake_case profile fields.
const COMPANY_FIELD_MAP: Record<string, string> = {
  companyName: "company_name",
  brandName: "brand_name",
  industry: "industry",
  subIndustry: "sub_industry",
  foundedYear: "founded_year",
  geographicMarket: "geographic_market",
  websiteUrl: "website_url",
  marketPositioning: "market_positioning",
  brandEssence: "brand_essence",
  keyDifferentiators: "key_differentiators",
  currentChallenge: "current_challenge",
  businessType: "business_type",
};

// Mark a verification-queue item confirmed / rejected (or back to pending), and
// keep the queue meta counts in sync.
export async function resolveVerificationItem(
  projectId: string,
  itemId: string,
  status: "pending" | "confirmed" | "rejected",
  resolvedValue?: string
) {
  await requireTeam();
  await mutateDoc<VerificationQueue>(projectId, VERIFICATION_DOC, (queue) => {
    const item = queue.items?.find((i) => i.item_id === itemId);
    if (!item) return;
    item.status = status;
    item.resolved_value = status === "pending" ? null : (resolvedValue ?? item.resolved_value ?? null);
    item.date_resolved = status === "pending" ? null : new Date().toISOString();

    const items = queue.items ?? [];
    const pending = items.filter((i) => (i.status ?? "pending") === "pending").length;
    queue._meta = {
      ...queue._meta,
      total_items: items.length,
      pending_count: pending,
      resolved_count: items.length - pending,
    };
  });
  revalidate(projectId);
}

export async function upsertCompany(projectId: string, formData: FormData) {
  await requireTeam();
  await mutateDoc<ClientProfile>(projectId, PROFILE_DOC, (content) => {
    const company = (content.company ??= {});
    for (const [formKey, jsonKey] of Object.entries(COMPANY_FIELD_MAP)) {
      const value = formData.get(formKey);
      if (typeof value !== "string") continue;
      if (jsonKey === "key_differentiators") {
        company.key_differentiators = value
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (jsonKey === "founded_year") {
        company.founded_year = value ? Number(value) : null;
      } else {
        company[jsonKey] = value;
      }
    }
    if (content._meta && company.company_name) {
      content._meta.company_name = company.company_name as string;
    }
  });

  // Keep the project name in sync with the company name.
  const name = (formData.get("companyName") as string)?.trim();
  if (name) {
    await prisma.project.update({ where: { id: projectId }, data: { name } }).catch(() => {});
  }

  revalidate(projectId);
}
