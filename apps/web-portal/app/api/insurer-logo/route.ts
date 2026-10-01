import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getStaticInsurerLogo, INSURER_LOGO_BUCKET, normalizeInsurerLogoKey } from "@/lib/insurer-logo";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const loadManagedLogoMap = unstable_cache(
  async () => {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("insurance_companies")
      .select("name,logo_path")
      .not("logo_path", "is", null);

    if (error) {
      console.error("Unable to load insurer master logos", { error: error.message });
      return {} as Record<string, string>;
    }

    return Object.fromEntries(
      (data ?? [])
        .map((row) => [normalizeInsurerLogoKey(row.name), row.logo_path] as const)
        .filter(([key, path]) => Boolean(key && path)),
    ) as Record<string, string>;
  },
  ["insurer-master-logo-map"],
  { revalidate: 300, tags: ["reference:insurance-companies"] },
);

function genericInsurerSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Insurance company">
  <rect width="64" height="64" rx="14" fill="#F4F7FB"/>
  <path d="M32 10 48 17v12c0 11.2-6.4 20.7-16 25-9.6-4.3-16-13.8-16-25V17l16-7Z" fill="#17365D"/>
  <path d="M32 17 42 21.3V29c0 7.4-3.9 14-10 17.6C25.9 43 22 36.4 22 29v-7.7L32 17Z" fill="#fff" opacity=".95"/>
  <path d="M27 31h10M32 26v10" stroke="#17365D" stroke-width="3" stroke-linecap="round"/>
</svg>`;
}

function withCache(response: NextResponse) {
  response.headers.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
  return response;
}

export async function GET(request: NextRequest) {
  const insurerName = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  if (!insurerName) {
    return new NextResponse(genericInsurerSvg(), {
      status: 200,
      headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  }

  const managedLogos = await loadManagedLogoMap();
  const managedPath = managedLogos[normalizeInsurerLogoKey(insurerName)];
  if (managedPath) {
    const admin = createSupabaseAdminClient();
    const { data } = admin.storage.from(INSURER_LOGO_BUCKET).getPublicUrl(managedPath);
    if (data.publicUrl) return withCache(NextResponse.redirect(data.publicUrl, 307));
  }

  const staticLogo = getStaticInsurerLogo(insurerName);
  if (staticLogo) return withCache(NextResponse.redirect(new URL(staticLogo, request.nextUrl.origin), 307));

  return new NextResponse(genericInsurerSvg(), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
