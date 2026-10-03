import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { VEHICLE_MANUFACTURER_LOGO_BUCKET } from "@/lib/vehicle-manufacturer-master";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path")?.trim() ?? "";
  if (!path || path.includes("..") || path.startsWith("/")) return new NextResponse("Invalid logo path", { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data } = admin.storage.from(VEHICLE_MANUFACTURER_LOGO_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) return new NextResponse("Logo not found", { status: 404 });

  const response = NextResponse.redirect(data.publicUrl, 307);
  response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return response;
}
