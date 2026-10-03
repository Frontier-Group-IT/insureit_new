import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getStaticVehicleBrandLogo } from "@/lib/vehicle-brand-logo";
import { VEHICLE_MANUFACTURER_LOGO_BUCKET, vehicleManufacturerSlug } from "@/lib/vehicle-manufacturer-master";

export const dynamic = "force-dynamic";

type BrandRow = { manufacturer_id: string };
type AliasRow = { manufacturer_id: string };
type ManufacturerRow = {
  id: string;
  logo_path: string | null;
  logo_status: string | null;
  is_active: boolean;
};

function safeBrandName(value: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.length > 120) return "";
  return trimmed;
}

function redirectTo(request: NextRequest, target: string, cacheControl: string) {
  const response = NextResponse.redirect(new URL(target, request.nextUrl.origin), 307);
  response.headers.set("Cache-Control", cacheControl);
  return response;
}

async function resolveManagedManufacturerLogo(make: string) {
  const admin = createSupabaseAdminClient();
  const slug = vehicleManufacturerSlug(make);

  let manufacturerId: string | null = null;

  if (slug) {
    const { data: brand } = await admin
      .from("vehicle_manufacturer_brands")
      .select("manufacturer_id")
      .eq("is_active", true)
      .eq("slug", slug)
      .limit(1)
      .maybeSingle<BrandRow>();
    manufacturerId = brand?.manufacturer_id ?? null;
  }

  if (!manufacturerId) {
    const aliasPattern = make.replace(/[\\%_]/g, (character) => `\\${character}`);
    const { data: alias } = await admin
      .from("vehicle_manufacturer_aliases")
      .select("manufacturer_id")
      .eq("is_active", true)
      .ilike("alias", aliasPattern)
      .limit(1)
      .maybeSingle<AliasRow>();
    manufacturerId = alias?.manufacturer_id ?? null;
  }

  if (!manufacturerId && slug) {
    const { data: manufacturer } = await admin
      .from("vehicle_manufacturers")
      .select("id")
      .eq("is_active", true)
      .eq("slug", slug)
      .limit(1)
      .maybeSingle<{ id: string }>();
    manufacturerId = manufacturer?.id ?? null;
  }

  if (!manufacturerId) return null;

  const { data: manufacturer } = await admin
    .from("vehicle_manufacturers")
    .select("id,logo_path,logo_status,is_active")
    .eq("id", manufacturerId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<ManufacturerRow>();

  if (!manufacturer || manufacturer.logo_status !== "verified") return null;
  const logoPath = manufacturer.logo_path?.trim() ?? "";
  if (!logoPath || !logoPath.startsWith("/")) return null;
  return logoPath;
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path")?.trim() ?? "";
  const make = safeBrandName(request.nextUrl.searchParams.get("make"));

  if (make) {
    const managedLogo = await resolveManagedManufacturerLogo(make);
    if (managedLogo) {
      return redirectTo(request, managedLogo, "no-store");
    }

    const fallback = getStaticVehicleBrandLogo(make);
    if (fallback) {
      return redirectTo(request, fallback, "public, max-age=300, stale-while-revalidate=3600");
    }

    return new NextResponse("Logo not found", { status: 404 });
  }

  if (!path || path.includes("..") || path.startsWith("/")) return new NextResponse("Invalid logo path", { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data } = admin.storage.from(VEHICLE_MANUFACTURER_LOGO_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) return new NextResponse("Logo not found", { status: 404 });

  const response = NextResponse.redirect(data.publicUrl, 307);
  response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return response;
}
