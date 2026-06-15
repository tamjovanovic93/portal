import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseServer } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

const BUCKET = "project-assets";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const isTeam = user.user_metadata?.role !== "client";
  const isClientOwner = asset.project.clientId === user.id;

  // Clients can only download SHARED assets on their own projects
  if (!isTeam) {
    if (!isClientOwner || asset.visibility !== "SHARED") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const adminClient = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrl(asset.storagePath, SIGNED_URL_TTL);

  if (error || !data) {
    return NextResponse.json({ error: "Could not generate download link" }, { status: 500 });
  }

  // Redirect to the signed URL
  return NextResponse.redirect(data.signedUrl);
}
