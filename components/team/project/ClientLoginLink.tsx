"use client";

import { useState } from "react";
import { generateClientAccess } from "@/app/actions/projects";

export default function ClientLoginLink({ projectId }: { projectId: string }) {
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    const result = await generateClientAccess(projectId);
    if (result.error) {
      setError(result.error);
    } else if (result.email && result.password) {
      setCreds({ email: result.email, password: result.password });
    }
    setLoading(false);
  }

  async function handleCopy() {
    if (!creds) return;
    await navigator.clipboard.writeText(
      `Email: ${creds.email}\nPassword: ${creds.password}\nLogin: ${window.location.origin}/login`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) {
    return <p className="text-xs text-red-500">{error}</p>;
  }

  if (creds) {
    return (
      <div className="flex items-center gap-3 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2">
        <div className="text-xs text-neutral-600 space-y-0.5">
          <p><span className="text-neutral-600">Email</span> {creds.email}</p>
          <p><span className="text-neutral-600">Password</span> {creds.password}</p>
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 text-xs px-2.5 py-1 border border-neutral-300 rounded hover:bg-white transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="text-xs text-neutral-500 border border-neutral-300 px-3 py-1.5 rounded-md hover:bg-neutral-50 transition-colors disabled:opacity-50"
    >
      {loading ? "Generating…" : "Get client credentials"}
    </button>
  );
}
