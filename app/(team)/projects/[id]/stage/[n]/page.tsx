import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { STAGE_TEMPLATES, TEMPLATES } from "@/lib/templates/registry";
import { createDocument, sendDocumentToClient } from "@/app/actions/documents";
import WireframeSection from "@/components/team/WireframeSection";
import MockupSection from "@/components/team/MockupSection";
import RevisionTracker from "@/components/team/RevisionTracker";

const STAGE_NAMES: Record<number, string> = {
  1: "Onboarding", 2: "Strategy", 3: "Sketch",
  4: "Make", 5: "Build", 6: "Client Review",
  7: "Launch", 8: "Complete",
};

const OVERALL_LABELS: Record<string, string> = {
  love_it: "Love it — let's go",
  on_track: "On the right track",
  not_there: "Not quite there yet",
};

const REACTION_LABELS: Record<string, string> = {
  happy: "Happy with this",
  tweaks: "Minor tweaks needed",
  rethink: "Needs rethinking",
};

const REACTION_BADGE: Record<string, string> = {
  happy: "bg-green-100 text-green-800",
  tweaks: "bg-amber-100 text-amber-800",
  rethink: "bg-red-100 text-red-800",
};

function labelFromFilename(filename: string): string {
  const name = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]/g, " ")
    .replace(/^\d+\s*/, "")
    .trim();
  return name.replace(/\b\w/g, (c) => c.toUpperCase()) || filename;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent to client",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-500",
  SENT: "bg-blue-50 text-blue-700",
  APPROVED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-700",
};

async function CreateDocumentButton({
  projectId,
  stageNumber,
  templateType,
  label,
}: {
  projectId: string;
  stageNumber: number;
  templateType: string;
  label: string;
}) {
  async function handleCreate() {
    "use server";
    const id = await createDocument(projectId, stageNumber, templateType);
    redirect(`/projects/${projectId}/stage/${stageNumber}/documents/${id}`);
  }

  return (
    <form action={handleCreate}>
      <button
        type="submit"
        className="text-xs px-3 py-1.5 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 transition-colors"
      >
        New {label}
      </button>
    </form>
  );
}

async function SendButton({ documentId }: { documentId: string }) {
  async function handleSend() {
    "use server";
    await sendDocumentToClient(documentId);
  }

  return (
    <form action={handleSend}>
      <button
        type="submit"
        className="text-xs px-2.5 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors"
      >
        Send to client
      </button>
    </form>
  );
}

export default async function StagePage({
  params,
}: {
  params: Promise<{ id: string; n: string }>;
}) {
  const { id: projectId, n } = await params;
  const stageNumber = parseInt(n, 10);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (isNaN(stageNumber) || stageNumber < 1 || stageNumber > 8) redirect("/dashboard");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      stages: { where: { stageNumber } },
    },
  });
  if (!project) redirect("/dashboard");

  const stageRow = project.stages[0];

  const documents = await prisma.document.findMany({
    where: { projectId, stageNumber },
    orderBy: { createdAt: "asc" },
  });

  const templateEntries = STAGE_TEMPLATES[stageNumber] ?? [];

  // Stage 3: wireframe uploads + client feedback
  let wireframeAssets: { id: string; filename: string; uploadedAt: string }[] = [];
  let wireframeFeedback: {
    status: "none" | "pending" | "submitted";
    submittedAt?: string | null;
    overall?: string;
    pages?: Record<string, { reaction: string; comment: string }>;
    finalNotes?: string;
  } = { status: "none" };

  if (stageNumber === 3) {
    const [rawAssets, feedbackDoc] = await Promise.all([
      prisma.projectAsset.findMany({
        where: { projectId, stageNumber: 3, folder: "wireframes" },
        orderBy: { uploadedAt: "asc" },
      }),
      prisma.document.findFirst({
        where: { projectId, stageNumber: 3, templateType: "wireframe_feedback" },
      }),
    ]);

    wireframeAssets = rawAssets.map((a) => ({
      id: a.id,
      filename: a.filename,
      uploadedAt: a.uploadedAt.toISOString(),
    }));

    if (!feedbackDoc) {
      wireframeFeedback = { status: rawAssets.length > 0 ? "pending" : "none" };
    } else if (feedbackDoc.status === "APPROVED") {
      const content = (feedbackDoc.content ?? {}) as Record<string, unknown>;
      wireframeFeedback = {
        status: "submitted",
        submittedAt: feedbackDoc.completedAt?.toISOString() ?? null,
        overall: content.overall as string | undefined,
        pages: content.pages as Record<string, { reaction: string; comment: string }> | undefined,
        finalNotes: content.finalNotes as string | undefined,
      };
    } else {
      wireframeFeedback = { status: "pending" };
    }
  }

  // Stage 4: design mockup uploads + client feedback
  type MockupAssetRow = { id: string; filename: string; mimeType: string | null; storagePath: string; uploadedAt: string };
  type DesignFeedback = {
    status: "none" | "pending" | "submitted";
    documentId?: string;
    submittedAt?: string | null;
    verdict?: string;
    revisions?: Array<{ pageScreen: string; whatToChange: string }>;
    revisionStatuses?: Record<string, string>;
    areas?: string[];
    happyWith?: string;
    anythingElse?: string;
    attachments?: Array<{ id: string; filename: string }>;
  };

  let mockupAssets: MockupAssetRow[] = [];
  let designFeedback: DesignFeedback = { status: "none" };

  if (stageNumber === 4) {
    const [rawMockups, designFeedbackDoc] = await Promise.all([
      prisma.projectAsset.findMany({
        where: { projectId, stageNumber: 4, folder: "mockup" },
        orderBy: { uploadedAt: "asc" },
      }),
      prisma.document.findFirst({
        where: { projectId, stageNumber: 4, templateType: "design_feedback" },
      }),
    ]);

    mockupAssets = rawMockups.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      storagePath: a.storagePath,
      uploadedAt: a.uploadedAt.toISOString(),
    }));

    if (!designFeedbackDoc) {
      designFeedback = { status: rawMockups.length > 0 ? "pending" : "none" };
    } else if (designFeedbackDoc.status === "APPROVED") {
      const c = (designFeedbackDoc.content ?? {}) as Record<string, unknown>;
      designFeedback = {
        status: "submitted",
        documentId: designFeedbackDoc.id,
        submittedAt: designFeedbackDoc.completedAt?.toISOString() ?? null,
        verdict: c.verdict as string | undefined,
        revisions: c.revisions as Array<{ pageScreen: string; whatToChange: string }> | undefined,
        revisionStatuses: (c.revisionStatuses ?? {}) as Record<string, string>,
        areas: c.areas as string[] | undefined,
        happyWith: c.happyWith as string | undefined,
        anythingElse: c.anythingElse as string | undefined,
        attachments: c.attachments as Array<{ id: string; filename: string }> | undefined,
      };
    } else {
      designFeedback = { status: "pending" };
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-neutral-600 space-x-1.5">
        <Link href="/dashboard" className="hover:text-neutral-700">
          Projects
        </Link>
        <span>›</span>
        <Link href={`/projects/${projectId}`} className="hover:text-neutral-700">
          {project.name}
        </Link>
        <span>›</span>
        <span className="text-neutral-600">
          Stage {stageNumber} — {STAGE_NAMES[stageNumber]}
        </span>
      </nav>

      {/* Stage header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">
          Stage {String(stageNumber).padStart(2, "0")} — {STAGE_NAMES[stageNumber]}
        </h1>
        {stageRow && (
          <p className="text-sm text-neutral-500 mt-1 capitalize">
            Status: {stageRow.status.toLowerCase().replace("_", " ")}
          </p>
        )}
      </div>

      {/* Stage 3 — Wireframe uploads */}
      {stageNumber === 3 && (
        <>
          <div>
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-neutral-900">Wireframes</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Upload all pages and screens. They&apos;re shared with the client automatically for review.
              </p>
            </div>
            <WireframeSection
              projectId={projectId}
              assets={wireframeAssets}
              feedbackStatus={wireframeFeedback.status}
              feedbackSubmittedAt={wireframeFeedback.submittedAt ?? null}
            />
          </div>

          {/* Client feedback — shown as a dedicated section once submitted */}
          {wireframeFeedback.status === "submitted" && (
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 mb-4">
                Client Wireframe Feedback
                {wireframeFeedback.submittedAt && (
                  <span className="ml-2 text-xs font-normal text-neutral-600">
                    received {new Date(wireframeFeedback.submittedAt).toLocaleDateString()}
                  </span>
                )}
              </h2>

              <div className="space-y-3">
                {/* Overall direction */}
                {wireframeFeedback.overall && (
                  <div className="bg-white border border-neutral-200 rounded-lg px-5 py-4">
                    <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide mb-1">
                      Overall direction
                    </p>
                    <p className="text-sm font-medium text-neutral-900">
                      {OVERALL_LABELS[wireframeFeedback.overall] ?? wireframeFeedback.overall}
                    </p>
                  </div>
                )}

                {/* Per wireframe */}
                {wireframeAssets.map((asset) => {
                  const page = wireframeFeedback.pages?.[asset.id];
                  const label = labelFromFilename(asset.filename);
                  return (
                    <div
                      key={asset.id}
                      className="bg-white border border-neutral-200 rounded-lg px-5 py-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-medium text-neutral-900 truncate">
                          {label}
                        </p>
                        {page?.reaction ? (
                          <span
                            className={`text-xs font-medium shrink-0 px-2.5 py-1 rounded-full ${
                              REACTION_BADGE[page.reaction] ?? "bg-neutral-100 text-neutral-600"
                            }`}
                          >
                            {REACTION_LABELS[page.reaction] ?? page.reaction}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-600 shrink-0">No reaction left</span>
                        )}
                      </div>
                      {page?.comment ? (
                        <p className="text-sm text-neutral-600 border-t border-neutral-100 pt-2">
                          &ldquo;{page.comment}&rdquo;
                        </p>
                      ) : null}
                    </div>
                  );
                })}

                {/* Final notes */}
                {wireframeFeedback.finalNotes && (
                  <div className="bg-white border border-neutral-200 rounded-lg px-5 py-4">
                    <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide mb-1">
                      Additional notes
                    </p>
                    <p className="text-sm text-neutral-600">
                      &ldquo;{wireframeFeedback.finalNotes}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Stage 4 — Design mockup */}
      {stageNumber === 4 && (
        <>
          <div>
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-neutral-900">Design Mockup</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Upload design files or add links (Figma, staging preview, etc.). Shared with the client automatically.
              </p>
            </div>
            <MockupSection
              projectId={projectId}
              assets={mockupAssets}
              feedbackStatus={designFeedback.status}
              feedbackSubmittedAt={designFeedback.submittedAt ?? null}
              feedbackVerdict={designFeedback.verdict}
            />
          </div>

          {/* Client feedback breakdown */}
          {designFeedback.status === "submitted" && (
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 mb-4">
                Client Design Feedback
                {designFeedback.submittedAt && (
                  <span className="ml-2 text-xs font-normal text-neutral-600">
                    received {new Date(designFeedback.submittedAt).toLocaleDateString()}
                  </span>
                )}
              </h2>

              <div className="space-y-3">
                {/* Verdict */}
                {designFeedback.verdict && (
                  <div className={`border rounded-lg px-5 py-4 ${
                    designFeedback.verdict === "approved" ? "border-green-200 bg-green-50"
                    : designFeedback.verdict === "approved_with_revisions" ? "border-amber-200 bg-amber-50"
                    : "border-red-200 bg-red-50"
                  }`}>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Verdict</p>
                    <p className={`text-sm font-semibold ${
                      designFeedback.verdict === "approved" ? "text-green-900"
                      : designFeedback.verdict === "approved_with_revisions" ? "text-amber-900"
                      : "text-red-900"
                    }`}>
                      {designFeedback.verdict === "approved" && "Approved — proceed to build"}
                      {designFeedback.verdict === "approved_with_revisions" && "Approved with revisions"}
                      {designFeedback.verdict === "revisions_required" && "Revisions required"}
                    </p>
                  </div>
                )}

                {/* Revisions with status tracking */}
                {designFeedback.revisions && designFeedback.revisions.filter(r => r.whatToChange).length > 0 && designFeedback.documentId && (
                  <div className="bg-white border border-neutral-200 rounded-lg px-5 py-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide">
                        Revision requests — {designFeedback.revisions.filter(r => r.whatToChange).length}
                      </p>
                      {(() => {
                        const statuses = designFeedback.revisionStatuses ?? {};
                        const done = Object.values(statuses).filter(s => s === "done" || s === "wont_fix").length;
                        const total = designFeedback.revisions!.filter(r => r.whatToChange).length;
                        return done > 0 ? (
                          <span className="text-xs text-neutral-600">{done} of {total} resolved</span>
                        ) : null;
                      })()}
                    </div>
                    <RevisionTracker
                      documentId={designFeedback.documentId}
                      revisions={designFeedback.revisions.filter(r => r.whatToChange)}
                      initialStatuses={designFeedback.revisionStatuses ?? {}}
                    />
                  </div>
                )}

                {/* Areas */}
                {designFeedback.areas && designFeedback.areas.length > 0 && (
                  <div className="bg-white border border-neutral-200 rounded-lg px-5 py-4">
                    <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide mb-2">Areas flagged</p>
                    <div className="flex flex-wrap gap-1.5">
                      {designFeedback.areas.map((area) => (
                        <span key={area} className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 capitalize">
                          {area.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* What's working */}
                {designFeedback.happyWith && (
                  <div className="bg-white border border-neutral-200 rounded-lg px-5 py-4">
                    <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide mb-1">What&apos;s working well</p>
                    <p className="text-sm text-neutral-600">&ldquo;{designFeedback.happyWith}&rdquo;</p>
                  </div>
                )}

                {/* Anything else */}
                {designFeedback.anythingElse && (
                  <div className="bg-white border border-neutral-200 rounded-lg px-5 py-4">
                    <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide mb-1">Additional notes</p>
                    <p className="text-sm text-neutral-600">&ldquo;{designFeedback.anythingElse}&rdquo;</p>
                  </div>
                )}

                {/* Client attachments */}
                {designFeedback.attachments && designFeedback.attachments.length > 0 && (
                  <div className="bg-white border border-neutral-200 rounded-lg px-5 py-4">
                    <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide mb-3">
                      Reference files from client — {designFeedback.attachments.length}
                    </p>
                    <div className="space-y-2">
                      {designFeedback.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={`/api/download?id=${att.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md hover:border-neutral-400 transition-colors group"
                        >
                          <svg className="w-4 h-4 text-neutral-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                          </svg>
                          <span className="text-sm text-neutral-700 flex-1 truncate group-hover:underline">
                            {att.filename}
                          </span>
                          <span className="text-xs text-neutral-600 shrink-0">Download ↓</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Documents per template */}
      {templateEntries.length > 0 && (
        <div className="space-y-6">
          {templateEntries.map(({ id: templateType, audience, label }) => {
            const template = TEMPLATES[templateType];
            const stageDocs = documents.filter(
              (d) => d.templateType === templateType
            );

            return (
              <section
                key={templateType}
                className="border border-neutral-200 rounded-lg bg-white overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-900">
                      {label}
                    </h2>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      {template?.description ?? ""}
                      {" · "}
                      <span className="capitalize">{audience}</span>
                    </p>
                  </div>
                  <CreateDocumentButton
                    projectId={projectId}
                    stageNumber={stageNumber}
                    templateType={templateType}
                    label={label}
                  />
                </div>

                {stageDocs.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-neutral-600">
                    No documents yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {stageDocs.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between px-5 py-3 group"
                      >
                        <div>
                          <Link
                            href={`/projects/${projectId}/stage/${stageNumber}/documents/${doc.id}`}
                            className="text-sm font-medium text-neutral-800 hover:underline"
                          >
                            {doc.title}
                          </Link>
                          <p className="text-xs text-neutral-600 mt-0.5">
                            {new Date(doc.createdAt).toLocaleDateString()}
                            {doc.sentAt && (
                              <> · Sent {new Date(doc.sentAt).toLocaleDateString()}</>
                            )}
                            {doc.completedAt && (
                              <> · Completed {new Date(doc.completedAt).toLocaleDateString()}</>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              STATUS_CLASS[doc.status] ?? "bg-neutral-100 text-neutral-500"
                            }`}
                          >
                            {STATUS_LABEL[doc.status] ?? doc.status}
                          </span>
                          {doc.status === "DRAFT" && audience === "client" && (
                            <SendButton documentId={doc.id} />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
