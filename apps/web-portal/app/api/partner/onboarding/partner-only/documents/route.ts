import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getEffectivePermissionAccessMap } from "@/lib/effective-permissions";
import { isEmployeeWithinAccessScope } from "@/lib/employee-access-scope";

export const dynamic = "force-dynamic";

const DOCUMENT_BUCKET = "customer-documents";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const DOCUMENT_TYPES = new Set(["aadhaar_front", "aadhaar_back", "pan_copy", "cancelled_cheque", "photograph", "gst_copy"]);
const response = (result: Record<string, unknown>, status = 200) =>
  NextResponse.json(result, { status, headers: { "Cache-Control": "no-store" } });

/** Bearer-authenticated uploads for the employee who created a Partner-only application. */
export async function POST(request: Request) {
  const match = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) return response({ ok: false, error: "Sign in again to upload documents." }, 401);

  const scoped = createSupabaseWithAccessToken(match[1]);
  const { data: auth, error: authError } = await scoped.auth.getUser(match[1]);
  if (authError || !auth.user) return response({ ok: false, error: "Session expired." }, 401);
  const { data: identity, error: identityError } = await scoped.rpc("partner_app_current_identity");
  if (identityError || !identity || identity.actor_kind !== "employee"
    || identity.auth_user_id !== auth.user.id || identity.profile_id !== auth.user.id) {
    return response({ ok: false, error: "Only authorized employees may upload Partner documents." }, 403);
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,role,is_active,employee_id").eq("id", auth.user.id).maybeSingle();
  if (profileError || !profile?.is_active || !profile.employee_id || profile.role !== identity.role) {
    return response({ ok: false, error: "Employee account is inactive." }, 403);
  }
  const { data: employee } = await admin.from("employees")
    .select("id,employment_status").eq("id", profile.employee_id).maybeSingle();
  if (employee?.employment_status !== "active") {
    return response({ ok: false, error: "Employee account is inactive." }, 403);
  }
  const permission = await getEffectivePermissionAccessMap(profile);
  if (!["edit", "approve"].includes(permission.create_intermediary_application ?? "none")
    || !(await isEmployeeWithinAccessScope(profile.id, profile.role, profile.employee_id))) {
    return response({ ok: false, error: "You do not have Add Partner permission." }, 403);
  }

  let payload: FormData;
  try { payload = await request.formData(); }
  catch { return response({ ok: false, error: "Invalid upload request." }, 400); }
  const applicationId = payload.get("application_id");
  const documentType = payload.get("document_type");
  const file = payload.get("file");
  if (typeof applicationId !== "string" || !/^[a-f0-9-]{36}$/i.test(applicationId)
    || typeof documentType !== "string" || !DOCUMENT_TYPES.has(documentType)
    || !(file instanceof File) || !file.size) {
    return response({ ok: false, error: "Choose a valid document and document category." }, 400);
  }
  if (file.size > MAX_FILE_SIZE) return response({ ok: false, error: "Maximum document size is 10 MB." }, 413);
  if (!ALLOWED_MIME_TYPES.has(file.type)) return response({ ok: false, error: "Use a PDF, JPG or PNG document." }, 400);

  const [{ data: application }, { data: onboardingProfile }] = await Promise.all([
    admin.from("intermediary_onboarding_applications")
      .select("id,initiated_by,status,partner_status,draft_data")
      .eq("id", applicationId).maybeSingle<{
        id: string; initiated_by: string; status: string; partner_status: string | null;
        draft_data: Record<string, unknown> | null;
      }>(),
    admin.from("posp_misp_onboarding_profiles")
      .select("id,workflow_stage,gst_number")
      .eq("application_id", applicationId).maybeSingle<{
        id: string; workflow_stage: string; gst_number: string | null;
      }>(),
  ]);
  // Do not expose the existence or document details of any other employee's application.
  if (!application || application.initiated_by !== profile.id
    || application.draft_data?.mobile_partner_only !== true
    || !onboardingProfile || onboardingProfile.workflow_stage !== "iib_processing"
    || !["submitted", "under_review", "changes_requested"].includes(application.status)
    || application.partner_status === "active_partner") {
    return response({ ok: false, error: "This Partner application is not available for document upload." }, 403);
  }
  if (documentType === "gst_copy" && !onboardingProfile.gst_number) {
    return response({ ok: false, error: "GST certificate requires saved GST details." }, 400);
  }

  const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const storagePath = `${applicationId}/intermediary/${documentType}/${randomUUID()}.${extension}`;
  const { data: previous } = await admin.from("intermediary_onboarding_documents")
    .select("storage_bucket,storage_path").eq("application_id", applicationId)
    .eq("document_type", documentType).maybeSingle<{ storage_bucket: string; storage_path: string }>();
  const { error: storageError } = await admin.storage.from(DOCUMENT_BUCKET)
    .upload(storagePath, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (storageError) return response({ ok: false, error: "Document storage failed." }, 500);

  const { error: recordError } = await admin.from("intermediary_onboarding_documents").upsert({
    application_id: applicationId,
    document_type: documentType,
    document_label: null,
    file_name: file.name.slice(0, 200),
    storage_bucket: DOCUMENT_BUCKET,
    storage_path: storagePath,
    mime_type: file.type,
    file_size: file.size,
    verification_status: "pending",
    uploaded_by: profile.id,
  }, { onConflict: "application_id,document_type" });
  if (recordError) {
    await admin.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    return response({ ok: false, error: "Document record could not be saved." }, 500);
  }
  // Delete the prior object only after its replacement is committed and no reference remains.
  if (previous?.storage_path && previous.storage_path !== storagePath) {
    const { count } = await admin.from("intermediary_onboarding_documents")
      .select("id", { count: "exact", head: true })
      .eq("storage_bucket", previous.storage_bucket).eq("storage_path", previous.storage_path);
    if (count === 0) await admin.storage.from(previous.storage_bucket).remove([previous.storage_path]);
  }
  return response({ ok: true, document_type: documentType, file_name: file.name });
}
