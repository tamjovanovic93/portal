"use client";

import { useState } from "react";
import Link from "next/link";
import { useAiJob } from "@/components/ai/useAiJob";
import { PROJECT_TYPES, type ProjectBrief, briefId } from "@/lib/brief/types";
import {
  generateSuggestedProjects,
  updateSuggestion,
  updateSuggestionBrief,
  rejectSuggestion,
  approveSuggestion,
} from "@/app/actions/suggested-projects";
import Button from "@/components/ui/Button";

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
  "w-full px-3 py-2 border border-line-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900";

export default function SuggestedProjectsPanel({
  clientId,
  dataReady,
  notReadyReason,
  suggestions,
  activeJobId = null,
}: {
  clientId: string;
  dataReady: boolean;
  notReadyReason: string | null;
  suggestions: Suggestion[];
  activeJobId?: string | null;
}) {
  // Generation runs as a background job; the hook polls until it lands.
  const job = useAiJob({ initialJobId: activeJobId });
  const busy = job.running;
  const error = job.error;

  const pending = suggestions.filter((s) => s.status === "PENDING");
  const approved = suggestions.filter((s) => s.status === "APPROVED");
  const rejected = suggestions.filter((s) => s.status === "REJECTED");

  function generate() {
    void job.start(() => generateSuggestedProjects(clientId));
  }

  if (!dataReady) {
    return (
      <div className="rounded-lg border border-line bg-surface px-6 py-10 text-center">
        <p className="text-sm font-medium text-ink">Projects can&apos;t be generated yet</p>
        <p className="text-sm text-ink-3 mt-1">{notReadyReason}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-ink-2 max-w-xl">
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
      {error && <p className="text-sm text-rose">{error}</p>}

      {suggestions.length === 0 && !busy && (
        <p className="text-sm text-ink-3">No suggestions yet — generate them above.</p>
      )}

      {pending.length > 0 && (
        <Section title={`Pending review (${pending.length})`}>
          {pending.map((s) => (
            <PendingCard key={s.id} s={s} />
          ))}
        </Section>
      )}

      {approved.length > 0 && (
        <Section title={`Approved (${approved.length})`}>
          {approved.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-green-200 bg-mint-fill px-4 py-3">
              <div>
                <p className="text-sm font-medium text-green-900">{s.name}</p>
                {s.projectType && <p className="text-xs text-mint">{s.projectType}</p>}
              </div>
              {s.approvedProjectId && (
                <Link href={`/projects/${s.approvedProjectId}`} className="text-xs font-medium text-mint underline underline-offset-2">
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
            <div key={s.id} className="rounded-lg border border-line bg-page px-4 py-2.5 opacity-70">
              <p className="text-sm text-ink-2 line-through">{s.name}</p>
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
      <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PendingCard({ s }: { s: Suggestion }) {
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
  }

  async function approve() {
    if (!confirm(`Approve "${name}"? This creates a real project with this brief.`)) return;
    setBusy("approve");
    setError(null);
    const res = await approveSuggestion(s.id);
    setBusy(null);
    if (res.error) setError(res.error);
  }

  async function reject() {
    if (!confirm(`Reject the "${name}" suggestion?`)) return;
    setBusy("reject");
    const res = await rejectSuggestion(s.id);
    setBusy(null);
    if (res.error) setError(res.error);
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4 space-y-3">
      <div className="flex gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} className={`${input} font-medium`} />
        <select value={type} onChange={(e) => setType(e.target.value)} className={`${input} bg-surface max-w-[190px]`}>
          <option value="">Type…</option>
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      {s.rationale && <p className="text-xs text-ink-3">{s.rationale}</p>}

      <button onClick={() => setOpen((o) => !o)} className="text-xs text-ink-2 hover:text-ink">
        {open ? "Hide brief ▲" : "Edit brief ▼"}
      </button>
      {open && (
        <div className="space-y-3 border-t border-line pt-3">
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

      {error && <p className="text-sm text-rose">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <Button variant="outline" size="md" onClick={save} disabled={!!busy}>
          {busy === "save" ? "Saving…" : "Save"}
        </Button>
        <button onClick={approve} disabled={!!busy} className="px-3 py-1.5 text-sm rounded-md bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50">
          {busy === "approve" ? "Approving…" : "Approve → create project"}
        </button>
        <Button variant="danger" size="md" className="ml-auto" onClick={reject} disabled={!!busy}>
          {busy === "reject" ? "…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-2 mb-1">{label}</label>
      {children}
    </div>
  );
}
