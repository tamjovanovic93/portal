"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PROJECT_TYPES, type ProjectBrief, briefId } from "@/lib/brief/types";
import {
  generateSuggestedProjects,
  updateSuggestion,
  updateSuggestionBrief,
  rejectSuggestion,
  approveSuggestion,
} from "@/app/actions/suggested-projects";

type Suggestion = {
  id: string;
  name: string;
  projectType: string | null;
  rationale: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approvedProjectId: string | null;
  brief: { overview: string; scope: string[]; keyFunctions: string[]; sitemap: string[] };
};

const input =
  "w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900";

export default function SuggestedProjectsPanel({
  clientId,
  dataReady,
  notReadyReason,
  suggestions,
}: {
  clientId: string;
  dataReady: boolean;
  notReadyReason: string | null;
  suggestions: Suggestion[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = suggestions.filter((s) => s.status === "PENDING");
  const approved = suggestions.filter((s) => s.status === "APPROVED");
  const rejected = suggestions.filter((s) => s.status === "REJECTED");

  async function generate() {
    setBusy(true);
    setError(null);
    const res = await generateSuggestedProjects(clientId);
    if (res.error) setError(res.error);
    setBusy(false);
    router.refresh();
  }

  if (!dataReady) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white px-6 py-10 text-center">
        <p className="text-sm font-medium text-neutral-900">Projects can&apos;t be generated yet</p>
        <p className="text-sm text-neutral-500 mt-1">{notReadyReason}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-neutral-600 max-w-xl">
          The agent analyzes everything known about this client and proposes projects, each with a
          pre-filled brief. Review, edit, then approve to create real projects.
        </p>
        <button
          onClick={generate}
          disabled={busy}
          className="shrink-0 px-4 py-2 bg-neutral-900 text-white text-sm rounded-md hover:bg-neutral-800 disabled:opacity-50 transition-colors"
        >
          {busy ? "Analyzing…" : suggestions.length ? "Generate more" : "Generate suggestions"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {suggestions.length === 0 && !busy && (
        <p className="text-sm text-neutral-500">No suggestions yet — generate them above.</p>
      )}

      {pending.length > 0 && (
        <Section title={`Pending review (${pending.length})`}>
          {pending.map((s) => (
            <PendingCard key={s.id} s={s} onChanged={() => router.refresh()} />
          ))}
        </Section>
      )}

      {approved.length > 0 && (
        <Section title={`Approved (${approved.length})`}>
          {approved.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-green-900">{s.name}</p>
                {s.projectType && <p className="text-xs text-green-700">{s.projectType}</p>}
              </div>
              {s.approvedProjectId && (
                <Link href={`/projects/${s.approvedProjectId}`} className="text-xs font-medium text-green-800 underline underline-offset-2">
                  Open project →
                </Link>
              )}
            </div>
          ))}
        </Section>
      )}

      {rejected.length > 0 && (
        <Section title={`Rejected (${rejected.length})`}>
          {rejected.map((s) => (
            <div key={s.id} className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5 opacity-70">
              <p className="text-sm text-neutral-600 line-through">{s.name}</p>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PendingCard({ s, onChanged }: { s: Suggestion; onChanged: () => void }) {
  const [name, setName] = useState(s.name);
  const [type, setType] = useState(s.projectType ?? "");
  const [overview, setOverview] = useState(s.brief.overview);
  const [scope, setScope] = useState(s.brief.scope.join("\n"));
  const [funcs, setFuncs] = useState(s.brief.keyFunctions.join("\n"));
  const [sitemap, setSitemap] = useState(s.brief.sitemap.join("\n"));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);

  async function save() {
    setBusy("save");
    setError(null);
    await updateSuggestion(s.id, { name, projectType: type || null });
    const brief: ProjectBrief = {
      name,
      projectType: type || undefined,
      overview,
      scope: lines(scope).map((t) => ({ id: briefId("s"), text: t })),
      keyFunctions: lines(funcs).map((t) => ({ id: briefId("f"), text: t })),
      sitemap: lines(sitemap).map((n) => ({ id: briefId("p"), name: n })),
    };
    const res = await updateSuggestionBrief(s.id, brief);
    setBusy(null);
    if (res.error) setError(res.error);
    else onChanged();
  }

  async function approve() {
    if (!confirm(`Approve "${name}"? This creates a real project with this brief.`)) return;
    setBusy("approve");
    setError(null);
    const res = await approveSuggestion(s.id);
    setBusy(null);
    if (res.error) setError(res.error);
    else onChanged();
  }

  async function reject() {
    if (!confirm(`Reject the "${name}" suggestion?`)) return;
    setBusy("reject");
    const res = await rejectSuggestion(s.id);
    setBusy(null);
    if (res.error) setError(res.error);
    else onChanged();
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
      <div className="flex gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} className={`${input} font-medium`} />
        <select value={type} onChange={(e) => setType(e.target.value)} className={`${input} bg-white max-w-[190px]`}>
          <option value="">Type…</option>
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      {s.rationale && <p className="text-xs text-neutral-500">{s.rationale}</p>}

      <button onClick={() => setOpen((o) => !o)} className="text-xs text-neutral-600 hover:text-neutral-900">
        {open ? "Hide brief ▲" : "Edit brief ▼"}
      </button>
      {open && (
        <div className="space-y-3 border-t border-neutral-100 pt-3">
          <Field label="Overview">
            <textarea value={overview} onChange={(e) => setOverview(e.target.value)} rows={2} className={input} />
          </Field>
          <Field label="Scope (one per line)">
            <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={3} className={input} />
          </Field>
          <Field label="Key functions (one per line)">
            <textarea value={funcs} onChange={(e) => setFuncs(e.target.value)} rows={3} className={input} />
          </Field>
          <Field label="Sitemap pages (one per line)">
            <textarea value={sitemap} onChange={(e) => setSitemap(e.target.value)} rows={3} className={input} />
          </Field>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button onClick={save} disabled={!!busy} className="px-3 py-1.5 text-sm rounded-md border border-neutral-300 hover:bg-neutral-50 disabled:opacity-50">
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button onClick={approve} disabled={!!busy} className="px-3 py-1.5 text-sm rounded-md bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50">
          {busy === "approve" ? "Approving…" : "Approve → create project"}
        </button>
        <button onClick={reject} disabled={!!busy} className="px-3 py-1.5 text-sm rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 ml-auto">
          {busy === "reject" ? "…" : "Reject"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
