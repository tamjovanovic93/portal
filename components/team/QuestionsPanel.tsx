"use client";

import { useState, useTransition } from "react";
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
import { formatWhen } from "@/lib/format";
import Button from "@/components/ui/Button";

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
      reset();
    });
  }
  function submitTeam() {
    if (!text.trim() || !teamMember) return;
    start(async () => {
      await askTeam({ projectId, contextType, contextId, recipientId: teamMember, questionText: text });
      reset();
    });
  }

  return (
    <div className="space-y-3">
      {/* Ask controls */}
      {mode === "none" ? (
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" type="button" onClick={() => setMode("client")}>+ Ask Client</Button>
          <Button variant="ghost" size="sm" type="button" onClick={() => setMode("team")}>+ Ask Team Member</Button>
        </div>
      ) : mode === "client" ? (
        <div className="card card-pad space-y-2">
          <label className="zp-label">Ask the client</label>
          <textarea className="zp-textarea" rows={2} value={text} placeholder="Your question…" onChange={(e) => setText(e.target.value)} />
          <label className="zp-label" style={{ marginTop: 4 }}>Proposed answer <span className="faint">(optional — turns this into a confirm request)</span></label>
          <textarea className="zp-textarea" rows={2} value={proposed} placeholder="e.g. Yes, Germany should be included." onChange={(e) => setProposed(e.target.value)} />
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" type="button" onClick={submitClient} disabled={pending || !text.trim()}>
              {proposed.trim() ? "Send for confirmation" : "Send question"}
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={reset}>Cancel</Button>
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
            <Button variant="primary" size="sm" type="button" onClick={submitTeam} disabled={pending || !text.trim() || !teamMember}>Send question</Button>
            <Button variant="ghost" size="sm" type="button" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Active questions */}
      {active.length > 0 && (
        <div className="space-y-2">
          {active.map((q) => <QuestionCard key={q.id} q={q} canTeamAnswer={q.recipientRole === "TEAM"} />)}
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
              {history.map((q) => <QuestionCard key={q.id} q={q} canTeamAnswer={false} />)}
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

function QuestionCard({ q, canTeamAnswer }: { q: QuestionRow; canTeamAnswer: boolean }) {
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState("");
  const resolved = q.status === "RESOLVED";
  const answered = q.status === "ANSWERED";

  const recipientLabel = q.recipientRole === "CLIENT" ? "Client" : q.recipientName ?? "Team";

  return (
    <div className="card" style={{ opacity: resolved ? 0.75 : 1, overflow: "hidden" }}>
      {/* Collapsed summary row — click to expand. Visible to the whole team. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full text-left qp-row"
        style={{ padding: "8px 10px", cursor: "pointer" }}
        title={expanded ? "Collapse" : "Click to view who asked, when, and the full question"}
      >
        <span className="faint" style={{ fontSize: 10, width: 10, flexShrink: 0, transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
        <Pill color={STATUS_COLOR[q.status]}>{STATUS_LABEL[q.status]}</Pill>
        {q.kind === "CONFIRM" && <Pill color="purple">Confirm</Pill>}
        <span style={{ fontSize: 12.5, fontWeight: 500, flexShrink: 0 }}>{recipientLabel}</span>
        <span className="faint" style={{ fontSize: 12.5, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {q.questionText}
        </span>
        <span className="faint" style={{ fontSize: 11, flexShrink: 0 }} suppressHydrationWarning>{formatWhen(q.createdAt)}</span>
      </button>

      {/* Expanded detail — who asked, when, the full question, answer, actions. */}
      {expanded && (
        <div className="space-y-2" style={{ padding: "0 10px 10px 10px", borderTop: "1px solid var(--border)" }}>
          <div className="faint" style={{ fontSize: 11.5, paddingTop: 8 }} suppressHydrationWarning>
            Asked by <span style={{ color: "var(--text-2)", fontWeight: 500 }}>{q.askedByName ?? "—"}</span>
            {" · "}{formatWhen(q.createdAt)}
            {" · to "}<span style={{ color: "var(--text-2)" }}>{recipientLabel}</span>
          </div>

          <div>
            <p className="faint" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 2 }}>Question</p>
            <p style={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{q.questionText}</p>
          </div>

          {q.proposedAnswer && (
            <p className="faint" style={{ fontSize: 12.5 }}>Proposed: <span style={{ color: "var(--text-2)" }}>{q.proposedAnswer}</span></p>
          )}

          {q.answerText && (
            <div style={{ fontSize: 13, padding: "6px 10px", background: "var(--surface-2)", borderRadius: "var(--r-sm)" }}>
              <span className="faint">Answer: </span>{q.answerText}
              {q.answeredAt && <span className="faint" style={{ fontSize: 11, display: "block", marginTop: 2 }} suppressHydrationWarning>Answered {formatWhen(q.answeredAt)}</span>}
            </div>
          )}

          {resolved && q.resolvedAt && (
            <p className="faint" style={{ fontSize: 11 }} suppressHydrationWarning>Resolved {formatWhen(q.resolvedAt)}</p>
          )}

          {/* Team member answering their own inbound question */}
          {canTeamAnswer && !answered && !resolved && (
            answering ? (
              <div className="space-y-2">
                <textarea className="zp-textarea" rows={2} value={answer} placeholder="Your answer…" onChange={(e) => setAnswer(e.target.value)} />
                <div className="flex items-center gap-2">
                  <Button variant="primary" size="sm" type="button" disabled={pending || !answer.trim()}
                    onClick={() => start(async () => { await answerQuestion(q.id, answer); setAnswering(false); })}>Submit answer</Button>
                  <Button variant="ghost" size="sm" type="button" onClick={() => setAnswering(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" size="sm" type="button" onClick={() => setAnswering(true)}>Answer</Button>
            )
          )}

          <div className="flex items-center gap-2">
            {!resolved && <Button variant="ghost" size="sm" type="button" disabled={pending}
              onClick={() => start(async () => { await resolveQuestion(q.id); })}>Mark resolved</Button>}
            {resolved && <Button variant="ghost" size="sm" type="button" disabled={pending}
              onClick={() => start(async () => { await reopenQuestion(q.id); })}>Reopen</Button>}
            <button type="button" disabled={pending} className="faint" style={{ fontSize: 12 }}
              onClick={() => { if (confirm("Delete this question?")) start(async () => { await deleteQuestion(q.id); }); }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}
