"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { briefId, TYPE_PRESETS, type TypeStyle, type BrandColor } from "@/lib/brief/types";
import {
  updateBrandTypography,
  updateBrandColors,
  addBrandLogoLink,
  deleteBrandLogo,
} from "@/app/actions/brand-kit";

type Logo = { id: string; filename: string; url: string; isLink: boolean };

export default function BrandKitCard({ projectId, typography, colors, logos }: {
  projectId: string; typography: TypeStyle[]; colors: BrandColor[]; logos: Logo[];
}) {
  return (
    <div className="space-y-6">
      <LogoSection projectId={projectId} logos={logos} />
      <TypographyEditor projectId={projectId} items={typography} />
      <ColorsEditor projectId={projectId} items={colors} />
    </div>
  );
}

function LogoSection({ projectId, logos }: { projectId: string; logos: Logo[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  function add() {
    if (!url.trim()) return;
    start(async () => { await addBrandLogoLink(projectId, label, url); setLabel(""); setUrl(""); router.refresh(); });
  }
  function remove(id: string) {
    start(async () => { await deleteBrandLogo(id, projectId); router.refresh(); });
  }
  return (
    <div>
      <label className="zp-label">Logo</label>
      {logos.length === 0 ? (
        <p className="faint" style={{ fontSize: 13, marginBottom: 8 }}>No logo files linked yet.</p>
      ) : (
        <div className="space-y-2" style={{ marginBottom: 10 }}>
          {logos.map((l) => (
            <div key={l.id} className="flex items-center gap-3 card" style={{ padding: "8px 12px" }}>
              <a href={l.url} target="_blank" rel="noreferrer" style={{ fontSize: 13.5, flex: 1 }} className="truncate">{l.filename}</a>
              <button type="button" onClick={() => remove(l.id)} disabled={pending} className="faint" style={{ fontSize: 12 }}>Remove</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input className="zp-input" style={{ width: 160 }} placeholder="Label (e.g. Primary)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="zp-input" style={{ flex: 1 }} placeholder="File / link URL" value={url} onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add} disabled={pending || !url.trim()} className="btn btn-sm btn-primary">+ Add</button>
      </div>
    </div>
  );
}

function TypographyEditor({ projectId, items: initial }: { projectId: string; items: TypeStyle[] }) {
  const router = useRouter();
  const [items, setItems] = useState<TypeStyle[]>(initial);
  const [, start] = useTransition();
  function commit(next: TypeStyle[]) { setItems(next); start(async () => { await updateBrandTypography(projectId, next); router.refresh(); }); }
  function addPreset(label: string) { commit([...items, { id: briefId("t"), label, font: "", size: "", style: "" }]); }
  function remove(id: string) { commit(items.filter((i) => i.id !== id)); }
  function edit(id: string, key: keyof TypeStyle, val: string) { setItems(items.map((i) => (i.id === id ? { ...i, [key]: val } : i))); }
  return (
    <div>
      <label className="zp-label">Typography</label>
      <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 10 }}>
        {TYPE_PRESETS.map((p) => <button key={p} type="button" onClick={() => addPreset(p)} className="btn btn-sm btn-ghost" style={{ padding: "3px 9px" }}>+ {p}</button>)}
      </div>
      {items.length === 0 ? (
        <p className="faint" style={{ fontSize: 13 }}>Add a style above (H1, Body…), then fill in the font, size and style.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="grid items-center gap-2" style={{ gridTemplateColumns: "90px 1fr 90px 110px 24px" }}>
              <input className="zp-input" value={it.label} placeholder="Style" onChange={(e) => edit(it.id, "label", e.target.value)} onBlur={() => commit(items)} />
              <input className="zp-input" value={it.font ?? ""} placeholder="Font (e.g. Inter)" onChange={(e) => edit(it.id, "font", e.target.value)} onBlur={() => commit(items)} />
              <input className="zp-input" value={it.size ?? ""} placeholder="Size" onChange={(e) => edit(it.id, "size", e.target.value)} onBlur={() => commit(items)} />
              <input className="zp-input" value={it.style ?? ""} placeholder="Style (Bold…)" onChange={(e) => edit(it.id, "style", e.target.value)} onBlur={() => commit(items)} />
              <button type="button" onClick={() => remove(it.id)} className="faint" style={{ fontSize: 12 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorsEditor({ projectId, items: initial }: { projectId: string; items: BrandColor[] }) {
  const router = useRouter();
  const [items, setItems] = useState<BrandColor[]>(initial);
  const [, start] = useTransition();
  function commit(next: BrandColor[]) { setItems(next); start(async () => { await updateBrandColors(projectId, next); router.refresh(); }); }
  function add() { commit([...items, { id: briefId("c"), name: "", hex: "#000000" }]); }
  function remove(id: string) { commit(items.filter((i) => i.id !== id)); }
  function edit(id: string, key: keyof BrandColor, val: string) { setItems(items.map((i) => (i.id === id ? { ...i, [key]: val } : i))); }
  const swatch = (hex: string) => (/^#?[0-9a-fA-F]{3,8}$/.test(hex.trim()) ? (hex.trim().startsWith("#") ? hex.trim() : `#${hex.trim()}`) : "transparent");
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="zp-label" style={{ marginBottom: 0 }}>Colors</label>
        <button type="button" onClick={add} className="btn btn-sm btn-primary">+ Add color</button>
      </div>
      {items.length === 0 ? (
        <p className="faint" style={{ fontSize: 13, marginTop: 6 }}>No colors yet.</p>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", marginTop: 8 }}>
          {items.map((c) => (
            <div key={c.id} className="flex items-center gap-2 card" style={{ padding: "8px 10px" }}>
              <span style={{ width: 22, height: 22, borderRadius: 5, background: swatch(c.hex), border: "1px solid var(--border-2)", flexShrink: 0, display: "inline-block" }} />
              <input type="color" value={swatch(c.hex) === "transparent" ? "#000000" : swatch(c.hex)}
                onChange={(e) => { const v = e.target.value; commit(items.map((i) => (i.id === c.id ? { ...i, hex: v } : i))); }}
                style={{ width: 26, height: 26, padding: 0, border: "none", background: "none", cursor: "pointer", flexShrink: 0 }} />
              <div className="min-w-0 flex-1">
                <input className="zp-input" style={{ fontFamily: "var(--f-mono, monospace)" }} value={c.hex} placeholder="#000000" onChange={(e) => edit(c.id, "hex", e.target.value)} onBlur={() => commit(items)} />
                <input className="zp-input" style={{ marginTop: 4, fontSize: 12 }} value={c.name ?? ""} placeholder="Name (optional)" onChange={(e) => edit(c.id, "name", e.target.value)} onBlur={() => commit(items)} />
              </div>
              <button type="button" onClick={() => remove(c.id)} className="faint" style={{ fontSize: 12 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
