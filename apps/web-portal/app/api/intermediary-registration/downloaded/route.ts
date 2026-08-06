import { NextResponse } from "next/server";
import { getScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const applicationId = new URL(request.url).searchParams.get("application_id")?.trim();
  if (!applicationId) return NextResponse.json({ ok: false, message: "Application ID is required." }, { status: 400 });

  const reviewer = await getScopedPospMispManager(applicationId);
  if (!reviewer?.id) return NextResponse.json({ ok: false, message: "This application is outside your permitted scope." }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("intermediary_onboarding_applications")
    .select("draft_data")
    .eq("id", applicationId)
    .maybeSingle<{ draft_data: Record<string, unknown> | null }>();

  const downloadedAt = typeof data?.draft_data?.registration_form_downloaded_at === "string"
    ? data.draft_data.registration_form_downloaded_at
    : null;

  return NextResponse.json({ ok: true, downloaded_at: downloadedAt }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { application_id?: string } | null;
  const applicationId = body?.application_id?.trim();
  if (!applicationId) return NextResponse.json({ ok: false, message: "Application ID is required." }, { status: 400 });

  const reviewer = await getScopedPospMispManager(applicationId);
  if (!reviewer?.id) return NextResponse.json({ ok: false, message: "This application is outside your permitted scope." }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const { data: application } = await admin
    .from("intermediary_onboarding_applications")
    .select("draft_data")
    .eq("id", applicationId)
    .maybeSingle<{ draft_data: Record<string, unknown> | null }>();
  if (!application) return NextResponse.json({ ok: false, message: "Application not found." }, { status: 404 });

  const downloadedAt = new Date().toISOString();
  const { error } = await admin
    .from("intermediary_onboarding_applications")
    .update({
      draft_data: {
        ...(application.draft_data ?? {}),
        registration_form_downloaded_at: downloadedAt,
        registration_form_downloaded_by: reviewer.id,
      },
      updated_at: downloadedAt,
    })
    .eq("id", applicationId);

  if (error) return NextResponse.json({ ok: false, message: error.message || "Download could not be recorded." }, { status: 500 });
  return NextResponse.json({ ok: true, downloaded_at: downloadedAt }, { headers: { "Cache-Control": "no-store" } });
}
