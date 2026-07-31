import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createScopedManualPospMispOnboarding } from "../../scoped-manual-action";

const PRESERVED_FIELDS = [
  "associate_employee_id",
  "pan_number",
  "document_received_at",
  "pos_first_name",
  "pos_middle_name",
  "pos_last_name",
  "misp_name",
  "address",
  "city",
  "state",
  "postal_code",
  "applicant_phone",
  "applicant_email",
  "date_of_birth",
  "aadhaar_number",
  "oem_name",
  "dp_first_name",
  "dp_middle_name",
  "dp_last_name",
  "dp_phone",
  "dp_email",
  "dp_pan_number",
  "bank_id",
  "bank_account_number",
  "bank_ifsc_code",
  "has_gst",
  "gst_number",
] as const;

export async function POST(request: Request) {
  const data = await request.formData();
  const partnerType = data.get("partner_type") === "misp" ? "misp" : "posp";
  const result = await createScopedManualPospMispOnboarding({ error: null, field: null }, data);

  if (result.error) {
    const url = new URL("/customers/posp-misp/new", request.url);
    url.searchParams.set("partner_type", partnerType);
    url.searchParams.set("form_error", result.error);
    if (result.field) url.searchParams.set("form_field", result.field);
    preserveValues(url, data);
    return NextResponse.redirect(url, 303);
  }

  if (!result.applicationId) {
    const url = new URL("/customers/posp-misp/new", request.url);
    url.searchParams.set("partner_type", partnerType);
    url.searchParams.set("form_error", "The application was saved but its reference could not be returned. Open Onboarding Applications to continue.");
    preserveValues(url, data);
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
        final_account_type: null,
        pre_iib_submitted_at: now,
        updated_at: now,
      })
      .eq("application_id", result.applicationId),
    admin
      .from("intermediary_onboarding_applications")
      .update({
        final_type: null,
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

function preserveValues(url: URL, data: FormData) {
  for (const field of PRESERVED_FIELDS) {
    const value = data.get(field);
    if (typeof value === "string" && value.trim()) url.searchParams.set(`v_${field}`, value.trim());
  }
}
