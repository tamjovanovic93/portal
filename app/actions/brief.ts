"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { mutateDoc } from "@/lib/intake/store";
import { notifyClient } from "@/lib/notifications";
import {
  PROFILE_DOC,
  STRATEGY_DOC,
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

function revalidate(clientId: string) {
  revalidatePath(`/clients/${clientId}/data`);
  revalidatePath(`/clients/${clientId}`);
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

export async function addRow(cfg: SectionConfig, clientId: string, formData: FormData) {
  await requireTeam();
  await mutateDoc<Row>(clientId, cfg.doc, (content) => {
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
  revalidate(clientId);
}

export async function deleteRow(cfg: SectionConfig, clientId: string, id: string) {
  await requireTeam();
  await mutateDoc<Row>(clientId, cfg.doc, (content) => {
    for (const arr of targetArrays(content, cfg.path)) {
      const idx = arr.findIndex((r) => r[cfg.idField] === id);
      if (idx !== -1) {
        arr.splice(idx, 1);
        return;
      }
    }
  });
  revalidate(clientId);
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

// Write a value into a JSON document at a dotted / indexed path such as
// "company.founded_year", "competitors[0].their_weakness", or
// "messaging.key_messages[2].message_text". Missing intermediate objects/arrays
// are created so a verification answer can *add* previously-missing information.
// Returns false when the path can't be resolved to a settable location.
type PathToken = { key: string } | { index: number };

function parsePath(path: string): PathToken[] {
  const tokens: PathToken[] = [];
  for (const segment of path.split(".")) {
    const m = segment.match(/^([^[\]]*)((\[\d+\])*)$/);
    if (!m) return [];
    if (m[1]) tokens.push({ key: m[1] });
    for (const idx of m[2].match(/\d+/g) ?? []) tokens.push({ index: Number(idx) });
  }
  return tokens;
}

function setByPath(root: Row, path: string, value: unknown): boolean {
  const tokens = parsePath(path);
  if (tokens.length === 0) return false;
  let node: unknown = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    const next = tokens[i + 1];
    const container = "index" in next ? [] : {};
    if ("key" in token) {
      const obj = node as Row;
      if (obj[token.key] == null) obj[token.key] = container;
      node = obj[token.key];
    } else {
      const arr = node as unknown[];
      if (!Array.isArray(arr)) return false;
      if (arr[token.index] == null) arr[token.index] = container;
      node = arr[token.index];
    }
  }
  const last = tokens[tokens.length - 1];
  if ("key" in last) {
    (node as Row)[last.key] = value;
  } else {
    if (!Array.isArray(node)) return false;
    (node as unknown[])[last.index] = value;
  }
  return true;
}

// Mark a verification-queue item confirmed / rejected (or back to pending), keep
// the queue meta counts in sync, and — crucially — when an item is confirmed
// with an answer, apply that answer back into the Client Data (client_profile or
// strategy) at the item's field_path so the Data screen shows the verified truth.
export async function resolveVerificationItem(
  clientId: string,
  itemId: string,
  status: "pending" | "confirmed" | "rejected",
  resolvedValue?: string
) {
  await requireTeam();

  let writeBack: { doc: IntakeDocType; path: string; value: string } | null = null;

  await mutateDoc<VerificationQueue>(clientId, VERIFICATION_DOC, (queue) => {
    const item = queue.items?.find((i) => i.item_id === itemId);
    if (!item) return;
    item.status = status;
    const value = status === "pending" ? null : (resolvedValue ?? item.resolved_value ?? null);
    item.resolved_value = value;
    item.date_resolved = status === "pending" ? null : new Date().toISOString();

    // Only a confirmed answer with an addressable field and a real value flows
    // back into Client Data. Rejections and blank confirmations leave data as-is.
    const path = (item.field_path as string) ?? "";
    if (status === "confirmed" && path && typeof value === "string" && value.trim() !== "") {
      const source = (item.source_document as string) ?? "";
      const doc: IntakeDocType = /strategy/i.test(source) ? STRATEGY_DOC : PROFILE_DOC;
      writeBack = { doc, path, value };
    }

    const items = queue.items ?? [];
    const pending = items.filter((i) => (i.status ?? "pending") === "pending").length;
    queue._meta = {
      ...queue._meta,
      total_items: items.length,
      pending_count: pending,
      resolved_count: items.length - pending,
    };
  });

  if (writeBack) {
    const { doc, path, value } = writeBack;
    try {
      await mutateDoc<Row>(clientId, doc, (content) => {
        setByPath(content, path, value);
      });
    } catch {
      // Target doc may not exist yet (e.g. strategy not generated) — the answer
      // is still recorded on the verification item; nothing else to do.
    }
  }

  revalidate(clientId);
}

// Add a custom (team-authored) verification question to the queue. It behaves
// like an agent-flagged item — the team can resolve it directly or send it to
// the client for verification.
export async function addCustomVerification(clientId: string, question: string) {
  await requireTeam();
  const q = question.trim();
  if (!q) return { error: "Question required." };
  await mutateDoc<VerificationQueue>(clientId, VERIFICATION_DOC, (queue) => {
    queue.items ??= [];
    const id = nextId([queue.items], "item_id", "VER");
    queue.items.push({
      item_id: id,
      source_document: "custom",
      field_path: "",
      current_value: "",
      question_for_client: q,
      status: "pending",
      resolved_value: null,
      date_raised: new Date().toISOString(),
      date_resolved: null,
      is_custom: true,
    });
    const pending = queue.items.filter((i) => (i.status ?? "pending") === "pending").length;
    queue._meta = {
      ...queue._meta,
      total_items: queue.items.length,
      pending_count: pending,
      resolved_count: queue.items.length - pending,
    };
  });
  revalidate(clientId);
  return { ok: true };
}

// Explicitly send a verification item to the client (nothing is sent until the
// team clicks this). Creates a client-facing Question linked to the item and
// marks it as sent.
export async function sendVerificationToClient(clientId: string, itemId: string) {
  await requireTeam();
  let questionText = "";
  await mutateDoc<VerificationQueue>(clientId, VERIFICATION_DOC, (queue) => {
    const item = queue.items?.find((i) => i.item_id === itemId);
    if (!item) return;
    questionText = (item.question_for_client as string) || "Please verify this detail.";
    item.sent_to_client_at = new Date().toISOString();
  });
  if (!questionText) return { error: "Item not found." };

  await prisma.question.create({
    data: {
      projectId: null,
      contextType: "VERIFICATION",
      contextId: itemId,
      kind: "ANSWER",
      recipientId: clientId,
      recipientRole: "CLIENT",
      questionText,
      status: "WAITING_CLIENT",
    },
  });
  await notifyClient(clientId, {
    type: "verification_asked",
    message: "Your team asked you to verify a detail.",
    link: "/portal",
  });
  revalidate(clientId);
  return { ok: true };
}

export async function upsertCompany(clientId: string, formData: FormData) {
  await requireTeam();
  await mutateDoc<ClientProfile>(clientId, PROFILE_DOC, (content) => {
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

  // Company name lives on the client. Keep the client's display name in sync,
  // but never touch project names (a project is a distinct engagement).
  const name = (formData.get("companyName") as string)?.trim();
  if (name) {
    await prisma.profile.update({ where: { id: clientId }, data: { name } }).catch(() => {});
  }

  revalidate(clientId);
}
