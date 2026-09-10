"use client";

import { useState, useTransition } from "react";
import { resetClientPassword } from "@/app/actions/clients";

// Client Stream credentials card: shows the login email and, on demand, generates
// a fresh temporary password (shown once) to hand to the client.
export default function ClientCredentials({
  clientId,
  email,
}: {
  clientId: string;
  email: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await resetClientPassword(clientId);
      if (res.error) setError(res.error);
      else setPassword(res.tempPassword ?? null);
    });
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Client login</p>
      <p className="faint" style={{ fontSize: 12, marginBottom: 14 }}>
        Credentials the client uses to sign in to their portal.
      </p>
      <div style={{ fontSize: 12.5 }} className="space-y-2">
        <div>
          <span className="faint">Email</span>
          <p className="mono" style={{ fontSize: 12.5 }}>{email}</p>
        </div>
        {password ? (
          <div>
            <span className="faint">Temporary password (shown once)</span>
            <p className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{password}</p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`);
                setCopied(true);
              }}
              className="btn-mini"
              style={{ marginTop: 6 }}
            >
              {copied ? "Copied ✓" : "Copy credentials"}
            </button>
          </div>
        ) : (
          <button type="button" onClick={generate} disabled={isPending} className="btn-mini">
            {isPending ? "Generating…" : "Generate temporary password"}
          </button>
        )}
        {error && <p style={{ color: "var(--rose)", fontSize: 12 }}>{error}</p>}
      </div>

      <style jsx>{`
        .btn-mini {
          font-size: 12px;
          font-weight: 500;
          padding: 5px 11px;
          border-radius: 6px;
          background: #171717;
          color: #fff;
        }
        .btn-mini:disabled {
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
