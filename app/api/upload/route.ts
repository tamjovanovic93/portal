import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseServer } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { Visibility } from "@prisma/client";

const BUCKET = "project-assets";
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.role === "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string;
  const stageNumber = formData.get("stageNumber") as string | null;
  const visibility = (formData.get("visibility") as Visibility) ?? "INTERNAL";
  const notes = (formData.get("notes") as string) || null;
  const folder = (formData.get("folder") as string) || null;

  if (!file || !projectId) {
    return NextResponse.json({ error: "File and projectId required" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 400 });
  }

  // Verify project exists
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Build storage path
  const ext = file.name.split(".").pop() ?? "";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const stage = stageNumber ? `stage-${stageNumber}` : "general";
  const storagePath = `${projectId}/${stage}/${Date.now()}_${safeName}`;

  // Upload via admin client (bypasses RLS on storage)
  const adminClient = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: uploadError } = await adminClient.storage
    .from(BUCKET)
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
      stageNumber: stageNumber ? parseInt(stageNumber) : null,
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

  return NextResponse.json({ id: asset.id, storagePath });
}
