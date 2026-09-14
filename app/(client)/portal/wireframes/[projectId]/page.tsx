import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import WireframeFeedbackForm from "@/components/client/WireframeFeedbackForm";
import { getFeedbackDoc } from "@/lib/documents/feedback";
import { getSignedUrls } from "@/lib/storage";
import { WIREFRAME_STAGE } from "@/lib/stages";

export default async function WireframeReviewPage({
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
        where: { stageNumber: WIREFRAME_STAGE, folder: "wireframes" },
        orderBy: { uploadedAt: "asc" },
      },
    },
  });

  if (!project) notFound();

  if (project.assets.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-neutral-500 text-sm">
          No wireframes have been shared yet. Check back shortly.
        </p>
        <Link
          href="/portal"
          className="mt-4 inline-block text-sm text-neutral-500 hover:text-neutral-900 underline underline-offset-2"
        >
          ← Back to portal
        </Link>
      </div>
    );
  }

  // Read-only: the feedback document is created by the save/submit actions and
  // reset by the upload route when newer wireframes arrive.
  // One signed-URL batch for image previews instead of an auth+DB round-trip per <img>.
  const [feedbackDoc, previews] = await Promise.all([
    getFeedbackDoc(projectId, "wireframe_feedback"),
    getSignedUrls(project.assets.filter((a) => a.mimeType?.startsWith("image/")).map((a) => a.storagePath)),
  ]);
  const isSubmitted = feedbackDoc?.status === "APPROVED";
  const existingContent = (feedbackDoc?.content ?? {}) as Record<string, unknown>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      {/* Back link */}
      <Link
        href="/portal"
        className="text-xs text-neutral-600 hover:text-neutral-700 transition-colors"
      >
        ← Back to portal
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Wireframe Review</h1>
        <p className="text-sm text-neutral-500 mt-0.5">{project.name}</p>
        {isSubmitted ? (
          <div className="mt-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-3">
            ✓ Your feedback has been submitted — thank you. We&apos;ll review it and be in touch shortly.
          </div>
        ) : (
          <p className="text-sm text-neutral-500 mt-3">
            Go through each screen below and share your thoughts. We&apos;ll use your feedback to move into the full design.
          </p>
        )}
      </div>

      {/* Feedback form */}
      <WireframeFeedbackForm
        projectId={projectId}
        assets={project.assets.map((a) => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mimeType,
          previewUrl: previews.get(a.storagePath) ?? null,
        }))}
        initialContent={existingContent}
        readOnly={isSubmitted}
      />
    </div>
  );
}
