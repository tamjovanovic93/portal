"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/kit";
import Icon from "@/components/ui/Icon";
import { Chip } from "@/components/team/data/ui";
import {
  saveBriefFields,
  updateBriefList,
  updateBriefSitemap,
  updateBriefTeam,
  updateBriefDates,
  updateBriefSections,
  generateBriefDraft,
  publishBrief,
  unpublishBrief,
  renameBrief,
} from "@/app/actions/project-brief";
import { syncScopeTasks } from "@/app/actions/scope";
import { useAiJob } from "@/components/ai/useAiJob";
import {
  PROJECT_TYPES,
  STATUSES,
  TEAM_ROLES,
  briefId,
  getBriefSections,
  DEFAULT_BRIEF_SECTIONS,
  type ProjectBrief,
  type BriefItem,
  type ScopeItem,
  type SitemapNode,
  type BriefTeamMember,
  type BriefListField,
  type BriefSection,
  type BriefSectionKind,
} from "@/lib/brief/types";
import type { RosterMember } from "@/lib/team";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";

type Props = {
  projectId: string;
  briefId: string;
  projectName: string;
  currentStageLabel: string;
  brief: ProjectBrief;
  publishedAt: string | null;
  roster: RosterMember[];
  dataContacts: { label: string; value: string }[];
  clientDefault: { name?: string; email?: string };
  // A brief-draft job already queued/running for this brief (resume polling).
  activeDraftJobId?: string | null;
};

// Sections that can be re-added from the "Add section" menu if removed.
const ADDABLE_DEFAULTS: BriefSectionKind[] = ["meta", "overview", "scope", "keyFunctions", "sitemap", "team"];

export default function ProjectBriefCard(props: Props) {
  const { briefId: id, currentStageLabel, brief, publishedAt, roster } = props;
  const [expanded, setExpanded] = useState(false);
  // The AI draft runs as a background job; the hook polls it to completion.
  const draftJob = useAiJob({ initialJobId: props.activeDraftJobId });
  const genPending = draftJob.running;
  const genError = draftJob.error;
  const [busy, startBusy] = useTransition();

  const name = brief.name || props.projectName;
  const owner = brief.ownerId ? roster.find((m) => m.id === brief.ownerId) : undefined;
  const sections = getBriefSections(brief).filter((s) => !s.hidden);
  const visibleToClientCount = sections.filter((s) => s.visibleToClient).length;
  const scopeCount = brief.scope?.length ?? 0;
  const sitemapCount = brief.sitemap?.length ?? 0;
  const teamCount = brief.team?.length ?? 0;
  const published = !!publishedAt;

  function persistSections(next: BriefSection[]) {
    startBusy(async () => { await updateBriefSections(id, next); });
  }

  function generate() {
    if (brief.overview || brief.scope?.length) {
      if (!confirm("Re-generate the AI draft? Project Type, Overview, Scope, Key Functions and Sitemap may be replaced. Owner, team, status and contact are kept.")) return;
    }
    void draftJob.start(() => generateBriefDraft(id));
  }

  function togglePublish() {
    startBusy(async () => {
      if (published) await unpublishBrief(id);
      else await publishBrief(id);
    });
  }

  function rename() {
    const next = prompt("Rename brief", name);
    if (next && next.trim() && next.trim() !== name) {
      startBusy(async () => { await renameBrief(id, next.trim()); });
    }
  }

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Compact header */}
      <div style={{ padding: "16px 18px" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
              <span className="eyebrow">Brief</span>
              {published ? <Chip accent>Published</Chip> : <Chip>Draft</Chip>}
            </div>
            <div className="flex items-center gap-2">
              <h3 style={{ fontSize: 17, fontWeight: 600 }}>{name}</h3>
              <button type="button" onClick={rename} className="faint" style={{ fontSize: 12 }} title="Rename">✎</button>
            </div>
            <div className="flex flex-wrap" style={{ gap: 6, marginTop: 8 }}>
              <Chip>{brief.projectType || "Type —"}</Chip>
              <Chip accent={brief.status === "In Progress"}>{brief.status || "Status —"}</Chip>
              <Chip>{currentStageLabel}</Chip>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 10, maxWidth: 620, lineHeight: 1.5 }}
               className={expanded ? "" : "line-clamp-1"}>
              {brief.overview?.trim() || "No overview yet."}
            </p>
            {/* summary counts */}
            <div className="flex flex-wrap items-center" style={{ gap: 12, marginTop: 10, fontSize: 12 }}>
              <span className="faint">Scope · {scopeCount}</span>
              <span className="faint">Sitemap · {sitemapCount} page{sitemapCount !== 1 ? "s" : ""}</span>
              <span className="faint">Team · {teamCount}</span>
              <span className="faint">Client-visible · {visibleToClientCount} section{visibleToClientCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              {owner ? (
                <>
                  <Avatar name={owner.name} photo={owner.photo} size={24} />
                  <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{owner.name}</span>
                </>
              ) : (
                <span className="faint" style={{ fontSize: 12 }}>No owner</span>
              )}
            </div>
            <button type="button" onClick={togglePublish} disabled={busy} className={`btn btn-sm ${published ? "btn-ghost" : "btn-primary"}`}>
              {published ? "Unpublish" : "Publish to client"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3" style={{ marginTop: 12 }}>
          <Button variant="secondary" size="sm" type="button" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide Brief ↑" : "View / Edit Brief ↓"}
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={generate} disabled={genPending}>
            {genPending ? "Generating…" : "Generate draft (AI)"}
          </Button>
          {genPending && <Loader label="Writing the draft" />}
          <div className="flex-1" />
          {genError && <span style={{ fontSize: 12, color: "var(--rose)" }}>{genError}</span>}
        </div>
      </div>

      {/* Expanded, editable — sections in configured order */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "18px", background: "var(--surface-2)" }} className="space-y-5">
          {sections.map((sec, idx) => (
            <SectionFrame
              key={sec.key}
              section={sec}
              first={idx === 0}
              last={idx === sections.length - 1}
              onToggleVisible={() => {
                const full = getBriefSections(brief).map((s) => (s.key === sec.key ? { ...s, visibleToClient: !s.visibleToClient } : s));
                persistSections(full);
              }}
              onHide={() => {
                const full = getBriefSections(brief).map((s) => (s.key === sec.key ? { ...s, hidden: true } : s));
                persistSections(full);
              }}
              onMove={(dir) => {
                const full = getBriefSections(brief);
                const visibleKeys = full.filter((s) => !s.hidden);
                const pos = visibleKeys.findIndex((s) => s.key === sec.key);
                const swapWith = visibleKeys[pos + dir];
                if (!swapWith) return;
                const a = full.findIndex((s) => s.key === sec.key);
                const b = full.findIndex((s) => s.key === swapWith.key);
                const next = [...full];
                [next[a], next[b]] = [next[b], next[a]];
                persistSections(next);
              }}
              onRemove={sec.kind === "text" ? () => {
                persistSections(getBriefSections(brief).filter((s) => s.key !== sec.key));
              } : undefined}
            >
              <SectionBody section={sec} briefDocId={id} brief={brief} props={props}
                onSaveText={(text) => {
                  persistSections(getBriefSections(brief).map((s) => (s.key === sec.key ? { ...s, text } : s)));
                }} />
            </SectionFrame>
          ))}

          <AddSection brief={brief} onAdd={persistSections} />
        </div>
      )}
    </div>
  );
}

// ── Section frame: header row with visibility / hide / reorder controls ──
function SectionFrame({ section, first, last, children, onToggleVisible, onHide, onMove, onRemove }: {
  section: BriefSection; first: boolean; last: boolean; children: React.ReactNode;
  onToggleVisible: () => void; onHide: () => void; onMove: (dir: -1 | 1) => void; onRemove?: () => void;
}) {
  return (
    <div className="card" style={{ padding: "12px 14px" }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{section.label}</span>
        <Button variant="ghost" size="sm" type="button" onClick={onToggleVisible} title={section.visibleToClient ? "Visible to client" : "Internal only"}
          style={{ padding: "2px 8px", color: section.visibleToClient ? "var(--mint)" : "var(--text-3)" }}>
          <Icon name={section.visibleToClient ? "eye" : "eyeOff"} size={14} /> {section.visibleToClient ? "Client" : "Internal"}
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" type="button" onClick={() => onMove(-1)} disabled={first} style={{ padding: "2px 6px" }}>↑</Button>
        <Button variant="ghost" size="sm" type="button" onClick={() => onMove(1)} disabled={last} style={{ padding: "2px 6px" }}>↓</Button>
        {onRemove
          ? <button type="button" onClick={onRemove} className="faint" style={{ fontSize: 12 }}>Remove</button>
          : <button type="button" onClick={onHide} className="faint" style={{ fontSize: 12 }}>Hide</button>}
      </div>
      {children}
    </div>
  );
}

// ── Add-section control (re-add removed defaults or a custom text section) ──
function AddSection({ brief, onAdd }: { brief: ProjectBrief; onAdd: (next: BriefSection[]) => void }) {
  const current = getBriefSections(brief);
  const presentKinds = new Set(current.filter((s) => !s.hidden).map((s) => s.kind));
  const removable = current.filter((s) => s.hidden);
  const [customLabel, setCustomLabel] = useState("");

  function readd(key: string) {
    onAdd(current.map((s) => (s.key === key ? { ...s, hidden: false } : s)));
  }
  function addMissingDefault(kind: BriefSectionKind) {
    const def = DEFAULT_BRIEF_SECTIONS.find((d) => d.kind === kind);
    if (!def) return;
    onAdd([...current, { ...def }]);
  }
  function addCustom() {
    const label = customLabel.trim();
    if (!label) return;
    onAdd([...current, { key: briefId("sec"), label, kind: "text", visibleToClient: false, text: "" }]);
    setCustomLabel("");
  }

  const missingDefaults = ADDABLE_DEFAULTS.filter((k) => !current.some((s) => s.kind === k));

  return (
    <div className="card" style={{ padding: "12px 14px", borderStyle: "dashed" }}>
      <div className="flex items-center flex-wrap gap-2">
        <span className="zp-label" style={{ marginBottom: 0 }}>Add section:</span>
        {missingDefaults.map((k) => {
          const def = DEFAULT_BRIEF_SECTIONS.find((d) => d.kind === k)!;
          return <Button variant="ghost" size="sm" key={k} type="button" onClick={() => addMissingDefault(k)}>+ {def.label}</Button>;
        })}
        {removable.map((s) => (
          <Button variant="ghost" size="sm" key={s.key} type="button" onClick={() => readd(s.key)}>+ {s.label} (hidden)</Button>
        ))}
        {presentKinds.size === 0 && removable.length === 0 && missingDefaults.length === 0 && (
          <span className="faint" style={{ fontSize: 12 }}>All default sections in use.</span>
        )}
      </div>
      <div className="flex items-center gap-2" style={{ marginTop: 10 }}>
        <input className="zp-input" style={{ flex: 1 }} placeholder="Custom section title…" value={customLabel}
          onChange={(e) => setCustomLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
        <Button variant="primary" size="sm" type="button" onClick={addCustom}>+ Custom</Button>
      </div>
    </div>
  );
}

// ── Render the right editor for a section kind ──
function SectionBody({ section, briefDocId, brief, props, onSaveText }: {
  section: BriefSection; briefDocId: string; brief: ProjectBrief; props: Props; onSaveText: (t: string) => void;
}) {
  switch (section.kind) {
    case "meta":
      return (
        <div className="space-y-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <SelectField label="Project Type" value={brief.projectType ?? ""} options={[...PROJECT_TYPES]}
              onSave={(v) => saveBriefFields(briefDocId, { projectType: v })} />
            <SelectField label="Status" value={brief.status ?? ""} options={[...STATUSES]}
              onSave={(v) => saveBriefFields(briefDocId, { status: v })} />
            <div>
              <label className="zp-label">Current Stage</label>
              <p style={{ fontSize: 13.5, padding: "7px 0" }}>{props.currentStageLabel} <span className="faint" style={{ fontSize: 11 }}>· from workflow</span></p>
            </div>
            <OwnerSelect briefDocId={briefDocId} value={brief.ownerId ?? ""} roster={props.roster} />
          </div>
          <DatesEditor briefDocId={briefDocId} dates={brief.dates ?? {}} />
          <ClientContact briefDocId={briefDocId} value={brief.clientContact ?? {}} clientDefault={props.clientDefault} dataContacts={props.dataContacts} />
        </div>
      );
    case "overview":
      return <TextField label="Project Overview" value={brief.overview ?? ""} placeholder="What are we building for this client?"
        onSave={(v) => saveBriefFields(briefDocId, { overview: v })} />;
    case "scope":
      return (
        <div className="space-y-3">
          <ScopeSyncBar briefDocId={briefDocId} />
          <ScopeList briefDocId={briefDocId} items={brief.scope ?? []} />
        </div>
      );
    case "keyFunctions":
      return <EditableList briefDocId={briefDocId} field="keyFunctions" items={brief.keyFunctions ?? []} placeholder="Add a function (e.g. Checkout)" />;
    case "sitemap":
      return <SitemapEditor briefDocId={briefDocId} nodes={brief.sitemap ?? []} />;
    case "team":
      return <TeamAssign briefDocId={briefDocId} team={brief.team ?? []} roster={props.roster} />;
    case "text":
      return <CustomText value={section.text ?? ""} onSave={onSaveText} />;
    default:
      return null;
  }
}

// ── Dates ──
function DatesEditor({ briefDocId, dates }: { briefDocId: string; dates: { start?: string | null; end?: string | null } }) {
  const [start, setStart] = useState(dates.start ?? "");
  const [end, setEnd] = useState(dates.end ?? "");
  const [pending, start2] = useTransition();
  function save(s = start, e = end) {
    start2(async () => { await updateBriefDates(briefDocId, { start: s || null, end: e || null }); });
  }
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div><label className="zp-label">Start date</label>
        <input type="date" className="zp-input" value={start} disabled={pending} onChange={(e) => setStart(e.target.value)} onBlur={() => save()} /></div>
      <div><label className="zp-label">End date</label>
        <input type="date" className="zp-input" value={end} disabled={pending} onChange={(e) => setEnd(e.target.value)} onBlur={() => save()} /></div>
    </div>
  );
}

function CustomText({ value, onSave }: { value: string; onSave: (t: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <textarea className="zp-textarea" rows={3} value={text} placeholder="Section content…"
      onChange={(e) => setText(e.target.value)} onBlur={() => { if (text !== value) onSave(text); }} />
  );
}

// ── Select field (immediate save) ──
function SelectField({ label, value, options, onSave }: {
  label: string; value: string; options: string[]; onSave: (v: string) => Promise<unknown>;
}) {
  const [pending, start] = useTransition();
  return (
    <div>
      <label className="zp-label">{label}</label>
      <select className="zp-select" value={value} disabled={pending}
        onChange={(e) => { const v = e.target.value; start(async () => { await onSave(v); }); }}>
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ── Owner select with avatar ──
function OwnerSelect({ briefDocId, value, roster }: {
  briefDocId: string; value: string; roster: RosterMember[];
}) {
  const [pending, start] = useTransition();
  const owner = roster.find((m) => m.id === value);
  return (
    <div>
      <label className="zp-label">Project Owner</label>
      <div className="flex items-center gap-2">
        {owner && <Avatar name={owner.name} photo={owner.photo} size={22} />}
        <select className="zp-select" value={value} disabled={pending}
          onChange={(e) => { const v = e.target.value; start(async () => { await saveBriefFields(briefDocId, { ownerId: v || undefined }); }); }}>
          <option value="">Unassigned</option>
          {roster.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.title}</option>)}
        </select>
      </div>
    </div>
  );
}

// ── Client contact ──
function ClientContact({ briefDocId, value, clientDefault, dataContacts }: {
  briefDocId: string; value: { name?: string; email?: string }; clientDefault: { name?: string; email?: string };
  dataContacts: { label: string; value: string }[];
}) {
  const [name, setName] = useState(value.name ?? clientDefault.name ?? "");
  const [email, setEmail] = useState(value.email ?? clientDefault.email ?? "");
  const [pending, start] = useTransition();
  function save(n = name, e = email) {
    start(async () => { await saveBriefFields(briefDocId, { clientContact: { name: n, email: e } }); });
  }
  return (
    <div>
      <label className="zp-label">Client Contact</label>
      <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <input className="zp-input" value={name} placeholder="Name" onChange={(e) => setName(e.target.value)} onBlur={() => save()} disabled={pending} />
        <input className="zp-input" value={email} placeholder="Email" onChange={(e) => setEmail(e.target.value)} onBlur={() => save()} disabled={pending} />
      </div>
      {dataContacts.length > 0 && (
        <select className="zp-select" style={{ marginTop: 8 }} value=""
          onChange={(e) => { const v = e.target.value; if (v) { setEmail(v); save(name, v); } }}>
          <option value="">Pick from Data contacts…</option>
          {dataContacts.map((c, i) => <option key={i} value={c.value}>{c.label}</option>)}
        </select>
      )}
    </div>
  );
}

// ── Text field (save on blur) ──
function TextField({ label, value, placeholder, onSave }: {
  label: string; value: string; placeholder?: string; onSave: (v: string) => Promise<unknown>;
}) {
  const [text, setText] = useState(value);
  const [pending, start] = useTransition();
  return (
    <div>
      <label className="zp-label">{label}</label>
      <textarea className="zp-textarea" rows={2} value={text} placeholder={placeholder} disabled={pending}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { if (text !== value) start(async () => { await onSave(text); }); }} />
    </div>
  );
}

// ── Scope → Tasks sync bar ──
function ScopeSyncBar({ briefDocId }: { briefDocId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  function sync() {
    setMsg(null);
    start(async () => {
      const res = await syncScopeTasks(briefDocId);
      if (res.error) setMsg(res.error);
      else setMsg(`${res.created ?? 0} created · ${res.updated ?? 0} updated${res.removed ? ` · ${res.removed} removed` : ""}`);
    });
  }
  return (
    <div className="flex items-center gap-3" style={{ padding: "8px 10px", borderRadius: "var(--r-md)", background: "var(--surface)", border: "1px solid var(--border)" }}>
      <Button variant="primary" size="sm" type="button" onClick={sync} disabled={pending}>
        {pending ? "Syncing…" : "Sync tasks from Scope"}
      </Button>
      <span className="faint" style={{ fontSize: 12 }}>
        {msg ?? "Generates / updates project tasks from these items (dates carry over; your edits are kept)."}
      </span>
    </div>
  );
}

// ── Scope list with per-item dates (drives generated tasks) ──
function ScopeList({ briefDocId, items: initial }: {
  briefDocId: string; items: ScopeItem[];
}) {
  const [items, setItems] = useState<ScopeItem[]>(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  // Date inputs fire onChange per keystroke; batch those into one save.
  const dateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (dateTimer.current) clearTimeout(dateTimer.current); }, []);
  function commit(next: ScopeItem[]) {
    if (dateTimer.current) { clearTimeout(dateTimer.current); dateTimer.current = null; }
    setItems(next);
    start(async () => { await updateBriefList(briefDocId, "scope", next); });
  }
  function commitDate(id: string, patch: Partial<ScopeItem>) {
    const next = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    setItems(next);
    if (dateTimer.current) clearTimeout(dateTimer.current);
    dateTimer.current = setTimeout(() => { dateTimer.current = null; commit(next); }, 600);
  }
  function add() { const t = text.trim(); if (!t) return; commit([...items, { id: briefId("s"), text: t }]); setText(""); }
  function remove(id: string) { commit(items.filter((i) => i.id !== id)); }
  function move(idx: number, dir: -1 | 1) { const j = idx + dir; if (j < 0 || j >= items.length) return; const next = [...items]; [next[idx], next[j]] = [next[j], next[idx]]; commit(next); }
  function edit(id: string, patch: Partial<ScopeItem>) { setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i))); }
  return (
    <div>
      <div className="space-y-1.5">
        {items.map((it, idx) => (
          <div key={it.id} className="flex items-center gap-2 flex-wrap">
            <span className="faint" style={{ fontSize: 11, width: 14 }}>{idx + 1}.</span>
            <input className="zp-input" style={{ flex: 1, minWidth: 160 }} value={it.text}
              onChange={(e) => edit(it.id, { text: e.target.value })} onBlur={() => commit(items)} disabled={pending} />
            <input type="date" className="zp-input" style={{ width: 140 }} title="Start" value={it.startDate ?? ""}
              onChange={(e) => commitDate(it.id, { startDate: e.target.value || null })} onBlur={() => { if (dateTimer.current) commit(items); }} />
            <input type="date" className="zp-input" style={{ width: 140 }} title="Due" value={it.dueDate ?? ""}
              onChange={(e) => commitDate(it.id, { dueDate: e.target.value || null })} onBlur={() => { if (dateTimer.current) commit(items); }} />
            <Button variant="ghost" size="sm" type="button" onClick={() => move(idx, -1)} disabled={idx === 0} style={{ padding: "2px 6px" }}>↑</Button>
            <Button variant="ghost" size="sm" type="button" onClick={() => move(idx, 1)} disabled={idx === items.length - 1} style={{ padding: "2px 6px" }}>↓</Button>
            <button type="button" onClick={() => remove(it.id)} className="faint" style={{ fontSize: 12 }}>✕</button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
        <input className="zp-input" style={{ flex: 1 }} value={text} placeholder="Add a deliverable (e.g. Homepage design)"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button variant="primary" size="sm" type="button" onClick={add}>+ Add</Button>
      </div>
    </div>
  );
}

// ── Editable ordered list (key functions) ──
function EditableList({ briefDocId, field, items: initial, placeholder }: {
  briefDocId: string; field: BriefListField; items: BriefItem[]; placeholder: string;
}) {
  const [items, setItems] = useState<BriefItem[]>(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  function commit(next: BriefItem[]) {
    setItems(next);
    start(async () => { await updateBriefList(briefDocId, field, next); });
  }
  function add() { const t = text.trim(); if (!t) return; commit([...items, { id: briefId("i"), text: t }]); setText(""); }
  function remove(id: string) { commit(items.filter((i) => i.id !== id)); }
  function move(idx: number, dir: -1 | 1) { const j = idx + dir; if (j < 0 || j >= items.length) return; const next = [...items]; [next[idx], next[j]] = [next[j], next[idx]]; commit(next); }
  function editText(id: string, t: string) { setItems(items.map((i) => (i.id === id ? { ...i, text: t } : i))); }
  return (
    <div>
      <div className="space-y-1.5">
        {items.map((it, idx) => (
          <div key={it.id} className="flex items-center gap-2">
            <span className="faint" style={{ fontSize: 11, width: 14 }}>{idx + 1}.</span>
            <input className="zp-input" style={{ flex: 1 }} value={it.text}
              onChange={(e) => editText(it.id, e.target.value)} onBlur={() => commit(items)} disabled={pending} />
            <Button variant="ghost" size="sm" type="button" onClick={() => move(idx, -1)} disabled={idx === 0} style={{ padding: "2px 6px" }}>↑</Button>
            <Button variant="ghost" size="sm" type="button" onClick={() => move(idx, 1)} disabled={idx === items.length - 1} style={{ padding: "2px 6px" }}>↓</Button>
            <button type="button" onClick={() => remove(it.id)} className="faint" style={{ fontSize: 12 }}>✕</button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
        <input className="zp-input" style={{ flex: 1 }} value={text} placeholder={placeholder}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button variant="primary" size="sm" type="button" onClick={add}>+ Add</Button>
      </div>
    </div>
  );
}

// ── Sitemap editor (pages + one level of children) ──
function SitemapEditor({ briefDocId, nodes: initial }: {
  briefDocId: string; nodes: SitemapNode[];
}) {
  const [nodes, setNodes] = useState<SitemapNode[]>(initial);
  const [page, setPage] = useState("");
  const [childInput, setChildInput] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  function commit(next: SitemapNode[]) {
    setNodes(next);
    start(async () => { await updateBriefSitemap(briefDocId, next); });
  }
  function addPage() { const t = page.trim(); if (!t) return; commit([...nodes, { id: briefId("p"), name: t, children: [] }]); setPage(""); }
  function removePage(id: string) { commit(nodes.filter((n) => n.id !== id)); }
  function movePage(idx: number, dir: -1 | 1) { const j = idx + dir; if (j < 0 || j >= nodes.length) return; const next = [...nodes]; [next[idx], next[j]] = [next[j], next[idx]]; commit(next); }
  function renamePage(id: string, name: string) { setNodes(nodes.map((n) => (n.id === id ? { ...n, name } : n))); }
  function addChild(pid: string) {
    const t = (childInput[pid] ?? "").trim(); if (!t) return;
    commit(nodes.map((n) => n.id === pid ? { ...n, children: [...(n.children ?? []), { id: briefId("p"), name: t }] } : n));
    setChildInput({ ...childInput, [pid]: "" });
  }
  function removeChild(pid: string, cid: string) {
    commit(nodes.map((n) => n.id === pid ? { ...n, children: (n.children ?? []).filter((c) => c.id !== cid) } : n));
  }

  return (
    <div className="space-y-3">
      {nodes.map((n, idx) => (
        <div key={n.id} className="card" style={{ padding: "10px 12px" }}>
          <div className="flex items-center gap-2">
            <input className="zp-input" style={{ flex: 1 }} value={n.name} onChange={(e) => renamePage(n.id, e.target.value)} onBlur={() => commit(nodes)} disabled={pending} />
            <Button variant="ghost" size="sm" type="button" onClick={() => movePage(idx, -1)} disabled={idx === 0} style={{ padding: "2px 6px" }}>↑</Button>
            <Button variant="ghost" size="sm" type="button" onClick={() => movePage(idx, 1)} disabled={idx === nodes.length - 1} style={{ padding: "2px 6px" }}>↓</Button>
            <button type="button" onClick={() => removePage(n.id)} className="faint" style={{ fontSize: 12 }}>✕</button>
          </div>
          <div style={{ paddingLeft: 16, marginTop: 6 }} className="space-y-1.5">
            {(n.children ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="faint" style={{ fontSize: 12 }}>→</span>
                <span style={{ fontSize: 13, flex: 1 }}>{c.name}</span>
                <button type="button" onClick={() => removeChild(n.id, c.id)} className="faint" style={{ fontSize: 12 }}>✕</button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input className="zp-input" style={{ flex: 1 }} placeholder="Add child page" value={childInput[n.id] ?? ""}
                onChange={(e) => setChildInput({ ...childInput, [n.id]: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChild(n.id); } }} />
              <Button variant="ghost" size="sm" type="button" onClick={() => addChild(n.id)}>+ Child</Button>
            </div>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input className="zp-input" style={{ flex: 1 }} placeholder="Add page (e.g. Home)" value={page}
          onChange={(e) => setPage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPage(); } }} />
        <Button variant="primary" size="sm" type="button" onClick={addPage}>+ Page</Button>
      </div>
    </div>
  );
}

// ── Project team assignment ──
function TeamAssign({ briefDocId, team: initial, roster }: {
  briefDocId: string; team: BriefTeamMember[]; roster: RosterMember[];
}) {
  const [team, setTeam] = useState<BriefTeamMember[]>(initial);
  const [addId, setAddId] = useState("");
  const [addRole, setAddRole] = useState<string>(TEAM_ROLES[0]);
  const [pending, start] = useTransition();
  function commit(next: BriefTeamMember[]) {
    setTeam(next);
    start(async () => { await updateBriefTeam(briefDocId, next); });
  }
  const available = roster.filter((m) => !team.some((t) => t.memberId === m.id));
  function addMember() { if (!addId) return; commit([...team, { memberId: addId, roles: [addRole] }]); setAddId(""); }
  function removeMember(id: string) { commit(team.filter((t) => t.memberId !== id)); }
  function addRoleTo(id: string, role: string) { commit(team.map((t) => t.memberId === id && !t.roles.includes(role) ? { ...t, roles: [...t.roles, role] } : t)); }
  function removeRole(id: string, role: string) { commit(team.map((t) => t.memberId === id ? { ...t, roles: t.roles.filter((r) => r !== role) } : t)); }

  return (
    <div>
      <div className="space-y-2">
        {team.length === 0 && <p className="faint" style={{ fontSize: 13 }}>No team members assigned yet.</p>}
        {team.map((t) => {
          const m = roster.find((r) => r.id === t.memberId);
          return (
            <div key={t.memberId} className="flex items-center gap-3 card" style={{ padding: "8px 12px" }}>
              <Avatar name={m?.name ?? t.memberId} photo={m?.photo} size={26} />
              <div className="min-w-0 flex-1">
                <p style={{ fontSize: 13.5, fontWeight: 500 }}>{m?.name ?? t.memberId}{m?.title ? <span className="faint" style={{ fontSize: 11, marginLeft: 6 }}>{m.title}</span> : null}</p>
                <div className="flex flex-wrap items-center" style={{ gap: 5, marginTop: 3 }}>
                  {t.roles.map((r) => (
                    <span key={r} className="pill" style={{ padding: "1px 7px", fontSize: 11 }}>
                      {r}
                      <button type="button" onClick={() => removeRole(t.memberId, r)} style={{ marginLeft: 5 }} className="faint">✕</button>
                    </span>
                  ))}
                  <select className="zp-select" style={{ width: "auto", padding: "2px 6px", fontSize: 11 }} value=""
                    onChange={(e) => { if (e.target.value) addRoleTo(t.memberId, e.target.value); }} disabled={pending}>
                    <option value="">+ role</option>
                    {TEAM_ROLES.filter((r) => !t.roles.includes(r)).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <button type="button" onClick={() => removeMember(t.memberId)} className="faint" style={{ fontSize: 12 }}>Remove</button>
            </div>
          );
        })}
      </div>

      {available.length > 0 && (
        <div className="flex items-center gap-2" style={{ marginTop: 10 }}>
          <select className="zp-select" style={{ flex: 1 }} value={addId} onChange={(e) => setAddId(e.target.value)}>
            <option value="">Add team member…</option>
            {available.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.title}</option>)}
          </select>
          <select className="zp-select" style={{ width: "auto" }} value={addRole} onChange={(e) => setAddRole(e.target.value)}>
            {TEAM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <Button variant="primary" size="sm" type="button" onClick={addMember} disabled={!addId || pending}>Add</Button>
        </div>
      )}
    </div>
  );
}
