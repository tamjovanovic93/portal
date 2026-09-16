import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PanelCard } from "@/components/client/PanelCard";
import Icon from "@/components/ui/Icon";
import { TEMPLATE_TYPES } from "@/lib/documents/types";
import type { BrandKit } from "@/app/actions/brand-kit";

export default async function ClientBrandPage() {
  const profile = await getSessionUser();
  if (!profile) redirect("/login");

  // Gated on status: a DRAFT brand kit is the team still working, and must not
  // leak to the client. Same idea as Project.briefPublishedAt for the brief.
  const doc = await prisma.document.findFirst({
    where: { clientId: profile.id, templateType: TEMPLATE_TYPES.brandKit, status: { not: "DRAFT" } },
    select: { content: true, updatedAt: true },
  });

  const kit = (doc?.content ?? {}) as BrandKit;
  const colors = kit.colors ?? [];
  const typography = kit.typography ?? [];
  const logos = kit.logos ?? [];
  const isEmpty = colors.length === 0 && typography.length === 0 && logos.length === 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div>
        <h1 className="page-title text-ink" style={{ fontSize: 30 }}>Brand guidelines</h1>
        <p className="text-sm text-ink-3 mt-2">
          {doc
            ? "Your colours, type and logos — the shared reference for every project."
            : "Your brand guidelines aren't ready to view yet."}
        </p>
      </div>

      {!doc || isEmpty ? (
        <p className="text-sm text-ink-3">
          Your team is still putting this together. We&apos;ll let you know when it&apos;s ready.
        </p>
      ) : (
        <div className="space-y-5">
          {logos.length > 0 && (
            <PanelCard title="Logos">
              {logos.map((logo) => (
                <a
                  key={logo.id}
                  href={logo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition-colors group"
                >
                  <Icon name="external" size={16} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                  <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate group-hover:underline">
                    {logo.filename}
                  </span>
                  <span className="text-xs text-ink-3 shrink-0">Open →</span>
                </a>
              ))}
            </PanelCard>
          )}

          {colors.length > 0 && (
            <PanelCard title="Colours" count={colors.length}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5">
                {colors.map((color) => (
                  <div key={color.id} className="space-y-2">
                    <div
                      className="w-full rounded-lg border border-line"
                      style={{ height: 64, background: color.hex }}
                    />
                    <div>
                      <p className="text-sm text-ink truncate">{color.name || color.hex}</p>
                      <p className="mono text-xs text-ink-3 uppercase">{color.hex}</p>
                    </div>
                  </div>
                ))}
              </div>
            </PanelCard>
          )}

          {typography.length > 0 && (
            <PanelCard title="Typography" count={typography.length}>
              {typography.map((style) => (
                <div key={style.id} className="px-5 py-4 flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-ink truncate" style={{ fontSize: 20, fontWeight: 600 }}>
                      {style.label}
                    </p>
                    <p className="text-xs text-ink-3 mt-1">
                      {[style.font, style.size, style.style].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="text-ink shrink-0" style={{ fontSize: 24, fontWeight: 700 }}>Aa</span>
                </div>
              ))}
            </PanelCard>
          )}
        </div>
      )}
    </div>
  );
}
