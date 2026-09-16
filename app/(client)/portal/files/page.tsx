import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PanelCard } from "@/components/client/PanelCard";
import Icon from "@/components/ui/Icon";
import { formatBytes } from "@/lib/format";
import { assetKind } from "@/lib/client-portal";

export default async function ClientFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const profile = await getSessionUser();
  if (!profile) redirect("/login");
  const { project: projectParam } = await searchParams;

  // Scoped by the project relation, so an unknown ?project= can only ever
  // narrow the client's own files — never widen to someone else's.
  const assets = await prisma.projectAsset.findMany({
    where: {
      visibility: "SHARED",
      project: {
        clientId: profile.id,
        isArchived: false,
        ...(projectParam ? { id: projectParam } : {}),
      },
    },
    select: {
      id: true, filename: true, folder: true, mimeType: true, sizeBytes: true,
      storagePath: true, notes: true, uploadedAt: true,
      project: { select: { id: true, name: true } },
    },
    orderBy: { uploadedAt: "desc" },
  });

  // Group by project, preserving the newest-first order within each group.
  const groups = new Map<string, { name: string; assets: typeof assets }>();
  for (const asset of assets) {
    const group = groups.get(asset.project.id) ?? { name: asset.project.name, assets: [] };
    group.assets.push(asset);
    groups.set(asset.project.id, group);
  }

  const filtered = projectParam && groups.size > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div>
        <h1 className="page-title text-ink" style={{ fontSize: 30 }}>Files</h1>
        <p className="text-sm text-ink-3 mt-2">
          Everything your team has shared with you.
          {filtered && (
            <>
              {" "}
              <Link href="/portal/files" className="text-mint hover:underline">Show all projects</Link>
            </>
          )}
        </p>
      </div>

      {assets.length === 0 ? (
        <p className="text-sm text-ink-3">
          Nothing shared yet. Files your team sends you will appear here.
        </p>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([projectId, group]) => (
            <PanelCard
              key={projectId}
              title={group.name}
              count={`${group.assets.length} file${group.assets.length === 1 ? "" : "s"}`}
            >
              {group.assets.map((asset) => {
                const kind = assetKind(asset.mimeType);
                const isLink = kind === "link";
                // Links live in storagePath as a plain URL and must bypass the
                // signed-download route.
                const href = isLink ? asset.storagePath : `/api/download?id=${asset.id}`;
                const meta = [
                  isLink ? "Link" : formatBytes(asset.sizeBytes),
                  asset.uploadedAt.toLocaleDateString(),
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <a
                    key={asset.id}
                    href={href}
                    {...(isLink ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition-colors group"
                  >
                    <Icon
                      name={isLink ? "link" : kind === "photo" ? "eye" : "file"}
                      size={16}
                      style={{ color: "var(--text-3)", flexShrink: 0 }}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-ink truncate group-hover:underline">
                        {asset.filename}
                      </span>
                      {asset.notes ? (
                        <span className="block text-xs text-ink-3 mt-0.5 truncate">{asset.notes}</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-ink-3 shrink-0">{meta}</span>
                  </a>
                );
              })}
            </PanelCard>
          ))}
        </div>
      )}
    </div>
  );
}
