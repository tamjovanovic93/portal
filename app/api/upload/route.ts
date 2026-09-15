import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Visibility } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient, STORAGE_BUCKET } from "@/lib/supabase/admin";
import { STAGE_COUNT } from "@/lib/stages";
import { isAllowedUpload, MAX_UPLOAD_BYTES, safeFilename } from "@/lib/uploads";
import { feedbackKindForFolder, resetFeedbackIfSubmitted } from "@/lib/documents/feedback";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "TEAM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string;
  const stageNumberRaw = formData.get("stageNumber") as string | null;
  const visibilityRaw = formData.get("visibility") as string | null;
  const notes = (formData.get("notes") as string) || null;
  const folder = (formData.get("folder") as string) || null;

  if (!file || !projectId) {
    return NextResponse.json({ error: "File and projectId required" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 400 });
  }
  if (!isAllowedUpload(file)) {
    return NextResponse.json({ error: "This file type is not allowed" }, { status: 400 });
  }

  const visibility: Visibility =
    visibilityRaw && (Object.values(Visibility) as string[]).includes(visibilityRaw)
      ? (visibilityRaw as Visibility)
      : "INTERNAL";

  const stageNumber = stageNumberRaw ? parseInt(stageNumberRaw, 10) : null;
  if (stageNumber !== null && (!Number.isInteger(stageNumber) || stageNumber < 1 || stageNumber > STAGE_COUNT)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  // Verify project exists
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Build storage path
  const safeName = safeFilename(file.name);
  const stage = stageNumber ? `stage-${stageNumber}` : "general";
  const storagePath = `${projectId}/${stage}/${Date.now()}_${safeName}`;

  // Upload via admin client (bypasses RLS on storage)
  const adminClient = await createAdminClient();

  const { error: uploadError } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Save metadata to DB
  const asset = await prisma.projectAsset.create({
    data: {
      projectId,
      stageNumber,
      storagePath,
      filename: file.name,
      mimeType: file.type || null,
      sizeBytes: file.size,
      visibility,
      folder,
      uploadedBy: user.id,
      notes,
    },
  });

  // New wireframes/mockups after a submitted client review reopen the review.
  const feedbackKind = feedbackKindForFolder(folder);
  if (feedbackKind) await resetFeedbackIfSubmitted(projectId, feedbackKind);

  return NextResponse.json({ id: asset.id, storagePath });
}
