import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import DesignFeedbackForm from "@/components/client/DesignFeedbackForm";
import { Prisma } from "@prisma/client";

export default async function DesignReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id: projectId, clientId: profile.id },
    include: {
      assets: {
        where: { stageNumber: 4, folder: "mockup" },
        orderBy: { uploadedAt: "asc" },
      },
    },
  });

  if (!project) notFound();

  if (project.assets.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-neutral-500 text-sm">
          No designs have been shared yet. Check back shortly.
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

  // Find or create the design feedback document
  let feedbackDoc = await prisma.document.findFirst({
    where: { projectId, stageNumber: 4, templateType: "design_feedback" },
  });

  if (!feedbackDoc) {
    feedbackDoc = await prisma.document.create({
      data: {
        projectId,
        stageNumber: 4,
        templateType: "design_feedback",
        title: "Design Feedback",
        content: {} as Prisma.InputJsonValue,
        status: "SENT",
        sentAt: new Date(),
      },
    });
  }

  // If new mockup assets were uploaded after the last submission, reset for another round
  if (feedbackDoc.status === "APPROVED" && feedbackDoc.completedAt) {
    const hasNewerAssets = project.assets.some(
      (a) => a.uploadedAt > feedbackDoc!.completedAt!
    );
    if (hasNewerAssets) {
      feedbackDoc = await prisma.document.update({
        where: { id: feedbackDoc.id },
        data: { status: "SENT", completedAt: null, content: {} as Prisma.InputJsonValue },
      });
    }
  }

  const isSubmitted = feedbackDoc.status === "APPROVED";
  const existingContent = (feedbackDoc.content ?? {}) as Record<string, unknown>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <Link
        href="/portal"
        className="text-xs text-neutral-600 hover:text-neutral-700 transition-colors"
      >
        ← Back to portal
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Design Review</h1>
        <p className="text-sm text-neutral-500 mt-0.5">{project.name}</p>
        {isSubmitted ? (
          <div className="mt-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-3">
            ✓ Your feedback has been submitted — thank you. We&apos;ll be in touch shortly.
          </div>
        ) : (
          <p className="text-sm text-neutral-500 mt-3">
            Review the designs below and let us know how you feel. Your feedback helps us
            move in the right direction.
          </p>
        )}
      </div>

      <DesignFeedbackForm
        documentId={feedbackDoc.id}
        projectId={projectId}
        assets={project.assets.map((a) => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mimeType,
          storagePath: a.storagePath,
        }))}
        initialContent={existingContent}
        readOnly={isSubmitted}
      />
    </div>
  );
}
