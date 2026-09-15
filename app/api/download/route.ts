import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient, STORAGE_BUCKET } from "@/lib/supabase/admin";

const SIGNED_URL_TTL = 60 * 60; // 1 hour

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assetId = req.nextUrl.searchParams.get("id");
  if (!assetId) {
    return NextResponse.json({ error: "Asset ID required" }, { status: 400 });
  }

  const asset = await prisma.projectAsset.findUnique({
    where: { id: assetId },
    include: { project: { select: { clientId: true } } },
  });

  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Clients can only download SHARED assets on their own projects
  if (user.role !== "TEAM") {
    const isClientOwner = asset.project.clientId === user.id;
    if (!isClientOwner || asset.visibility !== "SHARED") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const adminClient = await createAdminClient();

  const { data, error } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(asset.storagePath, SIGNED_URL_TTL);

  if (error || !data) {
    return NextResponse.json({ error: "Could not generate download link" }, { status: 500 });
  }

  // Redirect to the signed URL
  return NextResponse.redirect(data.signedUrl);
}
