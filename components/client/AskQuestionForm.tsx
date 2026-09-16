"use client";

import { useState } from "react";
import { askAsClient } from "@/app/actions/questions";
import Button from "@/components/ui/Button";
import { Textarea, Select, Label } from "@/components/ui/Field";

// Lets a client start a question. Questions are single question → single
// answer, so there is no thread here: a follow-up is a new question.

export default function AskQuestionForm({
  projects,
  defaultProjectId,
}: {
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
}) {
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    setSending(true);
    setError(null);
    const res = await askAsClient({ projectId: projectId || null, questionText: text });
    setSending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setText("");
    setSent(true);
  }

  return (
    <div className="card p-5 space-y-3">
      <div>
        <p className="text-sm font-medium text-ink">Ask your team a question</p>
        <p className="text-xs text-ink-3 mt-0.5">We&apos;ll reply here and let you know by email.</p>
      </div>

      {projects.length > 1 && (
        <div>
          <Label htmlFor="ask-project">Project</Label>
          <Select
            id="ask-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={sending}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
      )}

      <Textarea
        aria-label="Your question"
        rows={3}
        placeholder="What would you like to know?"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSent(false);
        }}
        disabled={sending}
      />

      {error && <p className="text-xs text-rose">{error}</p>}
      {sent && <p className="text-xs text-mint">Sent — your team will get back to you.</p>}

      <Button variant="primary" size="sm" onClick={submit} disabled={sending || text.trim().length === 0}>
        {sending ? "Sending…" : "Send question"}
      </Button>
    </div>
  );
}
