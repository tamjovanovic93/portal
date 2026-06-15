import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { TEMPLATES } from "@/lib/templates/registry";
import DocumentForm from "@/components/DocumentForm";

export default async function ClientDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) redirect("/login");

  const doc = await prisma.document.findUnique({
    where: { id },
    include: { project: true },
  });

  if (!doc) notFound();

  // Clients can only access their own projects' documents
  if (doc.project.clientId !== profile.id) notFound();

  // Clients can only fill documents that have been sent to them
  if (doc.status === "DRAFT") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-neutral-500 text-sm">
          This document isn&apos;t ready for you yet. Your team will share it when it&apos;s ready.
        </p>
        <Link
          href="/portal"
          className="mt-6 inline-block text-sm text-neutral-900 underline underline-offset-2"
        >
          Back to portal
        </Link>
      </div>
    );
  }

  const template = TEMPLATES[doc.templateType];
  if (!template) notFound();

  const isReadOnly = doc.status === "APPROVED" || doc.status === "REJECTED";
  const content = (doc.content ?? {}) as Record<string, unknown>;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      {/* Back link */}
      <Link
        href="/portal"
        className="text-xs text-neutral-600 hover:text-neutral-700 transition-colors"
      >
        ← Back to portal
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">{doc.title}</h1>
        {template.description && (
          <p className="text-sm text-neutral-500 mt-1">{template.description}</p>
        )}
        {isReadOnly && (
          <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 inline-block">
            You&apos;ve already submitted this form.
          </p>
        )}
      </div>

      {/* Form — filter out teamOnly sections for clients */}
      <DocumentForm
        documentId={doc.id}
        template={template}
        initialContent={content}
        readOnly={isReadOnly}
        isTeam={false}
      />
    </div>
  );
}
