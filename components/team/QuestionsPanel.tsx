"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/ui/kit";
import {
  askClient,
  askTeam,
  answerQuestion,
  resolveQuestion,
  reopenQuestion,
  deleteQuestion,
} from "@/app/actions/questions";
import { ACTIVE_STATUSES, type QuestionRow } from "@/lib/questions";
import type { RosterMember } from "@/lib/team";
import type { QuestionContext } from "@prisma/client";

type Props = {
  projectId: string;
  contextType: QuestionContext;
  contextId?: string;
  questions: QuestionRow[];
  roster: RosterMember[];
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  WAITING_CLIENT: "Waiting for client",
  WAITING_TEAM: "Waiting for team",
  WAITING_CONFIRMATION: "Waiting for confirmation",
  ANSWERED: "Answered",
  RESOLVED: "Resolved",
};
const STATUS_COLOR: Record<string, "amber" | "blue" | "mint" | "rose" | "purple"> = {
  OPEN: "amber", WAITING_CLIENT: "amber", WAITING_TEAM: "blue",
  WAITING_CONFIRMATION: "purple", ANSWERED: "mint", RESOLVED: "mint",
};

export default function QuestionsPanel({ projectId, contextType, contextId, questions, roster }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"none" | "client" | "team">("none");
  const [text, setText] = useState("");
  const [proposed, setProposed] = useState("");
  const [teamMember, setTeamMember] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const active = questions.filter((q) => ACTIVE_STATUSES.includes(q.status));
  const history = questions.filter((q) => !ACTIVE_STATUSES.includes(q.status));

  function reset() { setText(""); setProposed(""); setTeamMember(""); setMode("none"); }

  function submitClient() {
    if (!text.trim()) return;
    start(async () => {
      await askClient({ projectId, contextType, contextId, questionText: text, proposedAnswer: proposed || undefined });
      reset(); router.refresh();
    });
  }
  function submitTeam() {
    if (!text.trim() || !teamMember) return;
    start(async () => {
      await askTeam({ projectId, contextType, contextId, recipientId: teamMember, questionText: text });
      reset(); router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* Ask controls */}
      {mode === "none" ? (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMode("client")} className="btn btn-sm btn-primary">+ Ask Client</button>
          <button type="button" onClick={() => setMode("team")} className="btn btn-sm btn-ghost">+ Ask Team Member</button>
        </div>
      ) : mode === "client" ? (
        <div className="card card-pad space-y-2">
          <label className="zp-label">Ask the client</label>
          <textarea className="zp-textarea" rows={2} value={text} placeholder="Your question…" onChange={(e) => setText(e.target.value)} />
          <label className="zp-label" style={{ marginTop: 4 }}>Proposed answer <span className="faint">(optional — turns this into a confirm request)</span></label>
          <textarea className="zp-textarea" rows={2} value={proposed} placeholder="e.g. Yes, Germany should be included." onChange={(e) => setProposed(e.target.value)} />
          <div className="flex items-center gap-2">
            <button type="button" onClick={submitClient} disabled={pending || !text.trim()} className="btn btn-sm btn-primary">
              {proposed.trim() ? "Send for confirmation" : "Send question"}
            </button>
            <button type="button" onClick={reset} className="btn btn-sm btn-ghost">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="card card-pad space-y-2">
          <label className="zp-label">Ask a team member</label>
          <select className="zp-select" value={teamMember} onChange={(e) => setTeamMember(e.target.value)}>
            <option value="">Select team member…</option>
            {roster.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.title}</option>)}
          </select>
          <textarea className="zp-textarea" rows={2} value={text} placeholder="Your question…" onChange={(e) => setText(e.target.value)} />
          <div className="flex items-center gap-2">
            <button type="button" onClick={submitTeam} disabled={pending || !text.trim() || !teamMember} className="btn btn-sm btn-primary">Send question</button>
            <button type="button" onClick={reset} className="btn btn-sm btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* Active questions */}
      {active.length > 0 && (
        <div className="space-y-2">
          {active.map((q) => <QuestionCard key={q.id} q={q} router={router} canTeamAnswer={q.recipientRole === "TEAM"} />)}
        </div>
      )}

      {/* Resolved / history */}
      {history.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowResolved((v) => !v)} className="faint" style={{ fontSize: 12 }}>
            {showResolved ? "Hide" : "Show"} resolved / answered ({history.length})
          </button>
          {showResolved && (
            <div className="space-y-2" style={{ marginTop: 8 }}>
              {history.map((q) => <QuestionCard key={q.id} q={q} router={router} canTeamAnswer={false} />)}
            </div>
          )}
        </div>
      )}

      {active.length === 0 && history.length === 0 && (
        <p className="faint" style={{ fontSize: 12.5 }}>No questions yet.</p>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function QuestionCard({ q, router, canTeamAnswer }: { q: QuestionRow; router: any; canTeamAnswer: boolean }) {
  const [pending, start] = useTransition();
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState("");
  const resolved = q.status === "RESOLVED";
  const answered = q.status === "ANSWERED";

  return (
    <div className="card card-pad space-y-2" style={{ opacity: resolved ? 0.7 : 1 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <Pill color={STATUS_COLOR[q.status]}>{STATUS_LABEL[q.status]}</Pill>
        {q.kind === "CONFIRM" && <Pill color="purple">Confirm</Pill>}
        <span className="faint" style={{ fontSize: 11 }}>
          {q.recipientRole === "CLIENT" ? "to client" : `to ${q.recipientName ?? "team"}`}
          {q.askedByName ? ` · from ${q.askedByName}` : ""}
        </span>
      </div>
      <p style={{ fontSize: 13.5 }}>{q.questionText}</p>
      {q.proposedAnswer && <p className="faint" style={{ fontSize: 12.5 }}>Proposed: <span style={{ color: "var(--text-2)" }}>{q.proposedAnswer}</span></p>}
      {q.answerText && (
        <p style={{ fontSize: 13, padding: "6px 10px", background: "var(--surface-2)", borderRadius: "var(--r-sm)" }}>
          <span className="faint">Answer: </span>{q.answerText}
        </p>
      )}

      {/* Team member answering their own inbound question */}
      {canTeamAnswer && !answered && !resolved && (
        answering ? (
          <div className="space-y-2">
            <textarea className="zp-textarea" rows={2} value={answer} placeholder="Your answer…" onChange={(e) => setAnswer(e.target.value)} />
            <div className="flex items-center gap-2">
              <button type="button" disabled={pending || !answer.trim()} className="btn btn-sm btn-primary"
                onClick={() => start(async () => { await answerQuestion(q.id, answer); setAnswering(false); router.refresh(); })}>Submit answer</button>
              <button type="button" onClick={() => setAnswering(false)} className="btn btn-sm btn-ghost">Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAnswering(true)} className="btn btn-sm">Answer</button>
        )
      )}

      <div className="flex items-center gap-2">
        {!resolved && <button type="button" disabled={pending} className="btn btn-sm btn-ghost"
          onClick={() => start(async () => { await resolveQuestion(q.id); router.refresh(); })}>Mark resolved</button>}
        {resolved && <button type="button" disabled={pending} className="btn btn-sm btn-ghost"
          onClick={() => start(async () => { await reopenQuestion(q.id); router.refresh(); })}>Reopen</button>}
        <button type="button" disabled={pending} className="faint" style={{ fontSize: 12 }}
          onClick={() => { if (confirm("Delete this question?")) start(async () => { await deleteQuestion(q.id); router.refresh(); }); }}>Delete</button>
      </div>
    </div>
  );
}
