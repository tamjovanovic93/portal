import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServer } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

const BUCKET = "project-assets";
const MAX_SIZE = 50 * 1024 * 1024;

// Material category → folder
function folderFromCategory(category: string): string {
  if (category === "visuals") return "visuals";
  if (category === "copy") return "copy";
  return "documents";
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string;
  const materialItemId = formData.get("materialItemId") as string | null;
  const explicitFolder = formData.get("folder") as string | null;
  const stageNumberRaw = formData.get("stageNumber") as string | null;
  const stageNumber = stageNumberRaw ? parseInt(stageNumberRaw, 10) : null;

  if (!file || !projectId) {
    return NextResponse.json({ error: "File and projectId required" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 400 });
  }

  // Verify this client owns the project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { clientId: true },
  });
  if (!project || project.clientId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Determine folder: explicit override > material category > default
  let folder = explicitFolder ?? "documents";
  if (!explicitFolder && materialItemId) {
    const material = await prisma.materialItem.findUnique({
      where: { id: materialItemId },
      select: { category: true },
    });
    if (material) folder = folderFromCategory(material.category);
  }

  // Upload to storage
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${projectId}/client-uploads/${folder}/${Date.now()}_${safeName}`;

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

  // Save asset record
  const asset = await prisma.projectAsset.create({
    data: {
      projectId,
      stageNumber,
      storagePath,
      filename: file.name,
      mimeType: file.type || null,
      sizeBytes: file.size,
      visibility: "SHARED",
      folder,
      materialId: materialItemId ?? null,
      uploadedBy: user.id,
    },
  });

  // Mark the material item as submitted and link the file
  if (materialItemId) {
    await prisma.materialItem.update({
      where: { id: materialItemId },
      data: { status: "submitted", fileRef: storagePath },
    });
  }

  // Refresh the team-facing views so the upload/submission shows immediately.
  revalidatePath(`/projects/${projectId}/materials`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/portal");

  return NextResponse.json({ id: asset.id, filename: file.name, folder });
}
