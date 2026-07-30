import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createScopedManualPospMispOnboarding } from "../../scoped-manual-action";

export async function POST(request: Request) {
  const data = await request.formData();
  const partnerType = data.get("partner_type") === "misp" ? "misp" : "posp";
  const result = await createScopedManualPospMispOnboarding({ error: null, field: null }, data);

  if (result.error) {
    const url = new URL("/customers/posp-misp/new", request.url);
    url.searchParams.set("partner_type", partnerType);
    url.searchParams.set("error", result.error);
    if (result.field) url.searchParams.set("field", result.field);
    return NextResponse.redirect(url, 303);
  }

  if (!result.applicationId) {
    const url = new URL("/customers/posp-misp/new", request.url);
    url.searchParams.set("partner_type", partnerType);
    url.searchParams.set("error", "The application was saved but its reference could not be returned. Open Onboarding Applications to continue.");
    return NextResponse.redirect(url, 303);
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const [{ error: profileError }, { error: applicationError }] = await Promise.all([
    admin
      .from("posp_misp_onboarding_profiles")
      .update({
        workflow_stage: "iib_processing",
        requested_account_type: partnerType,
        final_account_type: partnerType,
        pre_iib_submitted_at: now,
        updated_at: now,
      })
      .eq("application_id", result.applicationId),
    admin
      .from("intermediary_onboarding_applications")
      .update({
        final_type: partnerType,
        current_step: 2,
        registration_status: "documents_pending",
        updated_at: now,
      })
      .eq("id", result.applicationId),
  ]);

  if (profileError || applicationError) {
    const url = new URL(`/intermediaries/applications/${result.applicationId}/workflow`, request.url);
    url.searchParams.set("stage", "primary");
    url.searchParams.set("error", "workflow_save_failed");
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(
    new URL(`/intermediaries/applications/${result.applicationId}/workflow?stage=documents&success=primary_details_saved`, request.url),
    303,
  );
}
