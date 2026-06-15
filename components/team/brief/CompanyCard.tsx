"use client";

import { useState, useTransition } from "react";

type CompanyData = {
  companyName: string | null;
  brandName: string | null;
  industry: string | null;
  subIndustry: string | null;
  foundedYear: number | null;
  geographicMarket: string | null;
  websiteUrl: string | null;
  marketPositioning: string | null;
  brandEssence: string | null;
  keyDifferentiators: string | null;
  currentChallenge: string | null;
  businessType: string | null;
};

function Field({
  label,
  name,
  value,
  editing,
  type = "text",
  multiline = false,
}: {
  label: string;
  name: string;
  value: string | number | null;
  editing: boolean;
  type?: string;
  multiline?: boolean;
}) {
  const displayVal = value !== null && value !== "" ? String(value) : null;

  if (!editing) {
    return (
      <div>
        <dt className="faint" style={{ fontSize: 11, marginBottom: 2, fontWeight: 500 }}>{label}</dt>
        <dd style={{ fontSize: 13.5 }}>{displayVal ?? <span className="faint" style={{ fontStyle: "italic" }}>—</span>}</dd>
      </div>
    );
  }

  return (
    <div>
      <label className="zp-label">{label}</label>
      {multiline ? (
        <textarea name={name} defaultValue={displayVal ?? ""} rows={3} className="zp-textarea" />
      ) : (
        <input name={name} type={type} defaultValue={displayVal ?? ""} className="zp-input" />
      )}
    </div>
  );
}

export default function CompanyCard({
  company,
  saveAction,
}: {
  company: CompanyData | null;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(!company?.companyName);
  const [isPending, startTransition] = useTransition();

  function handleSave(formData: FormData) {
    startTransition(async () => {
      await saveAction(formData);
      setEditing(false);
    });
  }

  return (
    <section className="card" style={{ overflow: "hidden" }}>
      <div className="flex items-center justify-between" style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Company</h3>
          <p className="faint" style={{ fontSize: 12, marginTop: 2 }}>Core business identity</p>
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="btn btn-sm">Edit</button>
        )}
      </div>

      <form action={handleSave}>
        <div className={`grid gap-4 ${editing ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`} style={{ padding: "18px" }}>
          <Field label="Company name" name="companyName" value={company?.companyName ?? null} editing={editing} />
          <Field label="Brand name" name="brandName" value={company?.brandName ?? null} editing={editing} />
          <Field label="Industry" name="industry" value={company?.industry ?? null} editing={editing} />
          <Field label="Sub-industry" name="subIndustry" value={company?.subIndustry ?? null} editing={editing} />
          <Field label="Founded year" name="foundedYear" value={company?.foundedYear ?? null} editing={editing} type="number" />
          <Field label="Geographic market" name="geographicMarket" value={company?.geographicMarket ?? null} editing={editing} />
          <Field label="Website" name="websiteUrl" value={company?.websiteUrl ?? null} editing={editing} type="url" />
          <Field label="Business type" name="businessType" value={company?.businessType ?? null} editing={editing} />
          <div className={editing ? "sm:col-span-2" : ""}>
            <Field label="Market positioning" name="marketPositioning" value={company?.marketPositioning ?? null} editing={editing} multiline={editing} />
          </div>
          <div className={editing ? "sm:col-span-2" : ""}>
            <Field label="Brand essence" name="brandEssence" value={company?.brandEssence ?? null} editing={editing} multiline={editing} />
          </div>
          <div className={editing ? "sm:col-span-2" : ""}>
            <Field label="Key differentiators" name="keyDifferentiators" value={company?.keyDifferentiators ?? null} editing={editing} multiline={editing} />
          </div>
          <div className={editing ? "sm:col-span-2" : ""}>
            <Field label="Current challenge" name="currentChallenge" value={company?.currentChallenge ?? null} editing={editing} multiline={editing} />
          </div>
        </div>

        {editing && (
          <div className="flex items-center gap-3" style={{ padding: "0 18px 18px" }}>
            <button type="submit" disabled={isPending} className="btn btn-sm btn-primary">
              {isPending ? "Saving…" : "Save"}
            </button>
            {company?.companyName && (
              <button type="button" onClick={() => setEditing(false)} className="btn btn-sm btn-ghost">Cancel</button>
            )}
          </div>
        )}
      </form>
    </section>
  );
}
