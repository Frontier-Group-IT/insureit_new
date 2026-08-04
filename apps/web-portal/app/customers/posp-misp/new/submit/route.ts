import { NextResponse } from "next/server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { isEmployeeWithinAccessScope } from "@/lib/employee-access-scope";
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
  "gst_number",
] as const;
const OPEN_APPLICATION_STATUSES = new Set(["submitted", "under_review", "changes_requested"]);

type ExistingProfile = { application_id: string };
type ExistingApplication = {
  id: string;
  status: string;
  partner_status: string | null;
  draft_data: Record<string, unknown> | null;
};

export async function POST(request: Request) {
  const data = await request.formData();
  const partnerType = data.get("partner_type") === "misp" ? "misp" : "posp";
  const submitIntent = readSubmitIntent(data);
  const authorizationError = await validateSubmissionScope(data);
  if (authorizationError) return redirectToForm(request.url, data, partnerType, authorizationError.message, authorizationError.field);

  const admin = createSupabaseAdminClient();
  const existingApplicationId = await findExistingOpenApplication(admin, partnerType, text(data, "pan_number"));

  if (existingApplicationId) {
    return NextResponse.redirect(
      successDestination(request.url, existingApplicationId, submitIntent, "documents_started"),
      303,
    );
  }

  const result = await createScopedManualPospMispOnboarding({ error: null, field: null }, data);

  if (result.error) return redirectToForm(request.url, data, partnerType, result.error, result.field);

  if (!result.applicationId) {
    return redirectToForm(
      request.url,
      data,
      partnerType,
      "The application was saved but its reference could not be returned. Open Onboarding Applications to continue.",
      null,
    );
  }

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
    successDestination(request.url, result.applicationId, submitIntent, "primary_details_saved"),
    303,
  );
}

function readSubmitIntent(data: FormData) {
  return data.get("submit_intent") === "exit" ? "exit" as const : "documents" as const;
}

function successDestination(requestUrl: string, applicationId: string, intent: "exit" | "documents", success: string) {
  return intent === "exit"
    ? new URL("/customers/posp-misp", requestUrl)
    : new URL(`/intermediaries/applications/${applicationId}/workflow?stage=documents&success=${success}`, requestUrl);
}

async function validateSubmissionScope(data: FormData) {
  const employeeId = text(data, "associate_employee_id");
  if (!employeeId) return { message: "Select a valid RM Name.", field: "associate_employee_id" };
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id) return { message: "You are not authorized to create an intermediary application.", field: null };
  const allowed = await isEmployeeWithinAccessScope(profile.id, profile.role, employeeId);
  return allowed ? null : { message: "You can only create an application for yourself or an employee in your reporting hierarchy.", field: "associate_employee_id" };
}

async function findExistingOpenApplication(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  partnerType: "posp" | "misp",
  panNumber: string | null,
) {
  const pan = panNumber?.replace(/\s/g, "").toUpperCase() ?? "";
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return null;

  const { data: profiles, error: profileError } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("application_id")
    .eq("partner_type", partnerType)
    .eq("pan_number", pan)
    .limit(20)
    .returns<ExistingProfile[]>();
  if (profileError || !profiles?.length) return null;

  const applicationIds = profiles.map((profile) => profile.application_id);
  const { data: applications, error: applicationError } = await admin
    .from("intermediary_onboarding_applications")
    .select("id,status,partner_status,draft_data")
    .in("id", applicationIds)
    .order("updated_at", { ascending: false })
    .returns<ExistingApplication[]>();
  if (applicationError) return null;

  return (applications ?? []).find((application) =>
    OPEN_APPLICATION_STATUSES.has(application.status)
    && application.partner_status !== "active_partner"
    && accountContext(application.draft_data) === "partner"
  )?.id ?? null;
}

function redirectToForm(
  requestUrl: string,
  data: FormData,
  partnerType: "posp" | "misp",
  message: string,
  field: string | null | undefined,
) {
  const url = new URL("/customers/posp-misp/new", requestUrl);
  url.searchParams.set("partner_type", partnerType);
  url.searchParams.set("form_error", message);
  if (field) url.searchParams.set("form_field", field);
  preserveValues(url, data);
  return NextResponse.redirect(url, 303);
}

function accountContext(draft: Record<string, unknown> | null | undefined) {
  const context = draft?.account_context;
  return context === "posp" || context === "misp" ? context : "partner";
}

function text(data: FormData, key: string) {
  const value = data.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function preserveValues(url: URL, data: FormData) {
  for (const field of PRESERVED_FIELDS) {
    const value = data.get(field);
    if (typeof value === "string" && value.trim()) url.searchParams.set(`v_${field}`, value.trim());
  }
}
