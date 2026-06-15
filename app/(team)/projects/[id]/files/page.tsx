import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProjectFiles from "@/components/team/ProjectFiles";
import { getDoc } from "@/lib/intake/store";
import { PROFILE_DOC } from "@/lib/intake/types";

export default async function FilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, clientId: true },
  });
  if (!project) notFound();

  const [assets, profileDoc] = await Promise.all([
    prisma.projectAsset.findMany({
      where: { projectId: id },
      orderBy: { uploadedAt: "desc" },
    }),
    getDoc(id, PROFILE_DOC),
  ]);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <Link
          href={`/projects/${id}`}
          className="text-xs text-neutral-600 hover:text-neutral-900 mb-3 inline-block"
        >
          ← {project.name}
        </Link>
        <h1 className="text-xl font-semibold text-neutral-900">Files</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          {assets.length} file{assets.length !== 1 ? "s" : ""}
        </p>
      </div>

      <ProjectFiles
        projectId={id}
        briefGenerated={!!profileDoc}
        assets={assets.map((a) => ({
          id: a.id,
          filename: a.filename,
          folder: a.folder,
          sizeBytes: a.sizeBytes,
          uploadedAt: a.uploadedAt.toISOString(),
          approvedAt: a.approvedAt?.toISOString() ?? null,
          visibility: a.visibility as string,
          isClientUpload: a.uploadedBy === project.clientId,
        }))}
      />
    </div>
  );
}
