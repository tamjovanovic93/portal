import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import DesignFeedbackForm from "@/components/client/DesignFeedbackForm";
import { getFeedbackDoc } from "@/lib/documents/feedback";
import { getSignedUrls } from "@/lib/storage";
import { DESIGN_STAGE } from "@/lib/stages";

export default async function DesignReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const profile = await getSessionUser();
  if (!profile) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id: projectId, clientId: profile.id },
    include: {
      assets: {
        where: { stageNumber: DESIGN_STAGE, folder: "mockup" },
        orderBy: { uploadedAt: "asc" },
      },
    },
  });

  if (!project) notFound();

  if (project.assets.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-ink-3 text-sm">
          No designs have been shared yet. Check back shortly.
        </p>
        <Link
          href={`/portal/projects/${projectId}`}
          className="mt-4 inline-block text-sm text-ink-3 hover:text-ink underline underline-offset-2"
        >
          ← Back to project
        </Link>
      </div>
    );
  }

  // Read-only: the feedback document is created by the save/submit actions and
  // reset by the upload route / design-link action when newer designs arrive.
  // One signed-URL batch for image previews instead of an auth+DB round-trip per <img>.
  const [feedbackDoc, previews] = await Promise.all([
    getFeedbackDoc(projectId, "design_feedback"),
    getSignedUrls(project.assets.filter((a) => a.mimeType?.startsWith("image/")).map((a) => a.storagePath)),
  ]);
  const isSubmitted = feedbackDoc?.status === "APPROVED";
  const existingContent = (feedbackDoc?.content ?? {}) as Record<string, unknown>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <Link
        href={`/portal/projects/${projectId}`}
        className="text-xs text-ink-2 hover:text-neutral-700 transition-colors"
      >
        ← Back to project
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-ink">Design Review</h1>
        <p className="text-sm text-ink-3 mt-0.5">{project.name}</p>
        {isSubmitted ? (
          <div className="mt-3 text-sm text-mint bg-mint-fill border border-green-200 rounded-md px-4 py-3">
            ✓ Your feedback has been submitted — thank you. We&apos;ll be in touch shortly.
          </div>
        ) : (
          <p className="text-sm text-ink-3 mt-3">
            Review the designs below and let us know how you feel. Your feedback helps us
            move in the right direction.
          </p>
        )}
      </div>

      <DesignFeedbackForm
        projectId={projectId}
        assets={project.assets.map((a) => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mimeType,
          storagePath: a.storagePath,
          previewUrl: previews.get(a.storagePath) ?? null,
        }))}
        initialContent={existingContent}
        readOnly={isSubmitted}
      />
    </div>
  );
}
