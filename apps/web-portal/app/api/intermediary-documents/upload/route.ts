import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getPospMispManager, getScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const DOCUMENT_BUCKET = "customer-documents";
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const EDUCATION_TYPES = new Set([
  "education_10th_marksheet",
  "education_12th_marksheet",
  "education_graduation_marksheet",
  "education_post_graduation_marksheet",
]);
const STANDARD_TYPES = new Set([
  "aadhaar_front",
  "aadhaar_back",
  "pan_copy",
  "cancelled_cheque",
  "photograph",
  "gst_copy",
]);
const EDITABLE_APPLICATION_STATUSES = new Set(["submitted", "under_review", "changes_requested"]);

export async function POST(request: Request) {
  const authenticatedManager = await getPospMispManager();
  if (!authenticatedManager?.id) {
    return NextResponse.json(
      { ok: false, code: "intermediary_upload_session_missing", message: "Your login session was not available for this upload. Refresh the page, sign in again if required, and retry." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const data = await request.formData();
  const applicationId = text(data, "application_id");
  const documentType = text(data, "document_type");
  const selected = data.get("file");

  if (!applicationId || !documentType || !(selected instanceof File) || selected.size === 0) {
    return NextResponse.json({ ok: false, message: "The document upload request is incomplete." }, { status: 400 });
  }

  const reviewer = await getScopedPospMispManager(applicationId);
  if (!reviewer?.id) {
    return NextResponse.json(
      { ok: false, code: "intermediary_upload_scope_denied", message: "This application is outside your permitted Intermediary hierarchy or is no longer assigned to you." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!STANDARD_TYPES.has(documentType) && !EDUCATION_TYPES.has(documentType)) {
    return NextResponse.json({ ok: false, message: "The selected document type is not supported." }, { status: 400 });
  }
  if (!ALLOWED_FILE_TYPES.has(selected.type)) {
    return NextResponse.json({ ok: false, message: "Use a PDF, JPG or PNG file." }, { status: 400 });
  }
  if (selected.size > MAX_FILE_SIZE) {
    return NextResponse.json({ ok: false, message: "Each document must be 4 MB or smaller." }, { status: 413 });
  }

  const admin = createSupabaseAdminClient();
  const [{ data: application }, { data: profile }] = await Promise.all([
    admin
      .from("intermediary_onboarding_applications")
      .select("id,status,registration_status,partner_status,final_type")
      .eq("id", applicationId)
      .maybeSingle<{
        id: string;
        status: string;
        registration_status: string;
        partner_status: string | null;
        final_type: string | null;
      }>(),
    admin
      .from("posp_misp_onboarding_profiles")
      .select("id,workflow_stage,gst_number")
      .eq("application_id", applicationId)
      .maybeSingle<{ id: string; workflow_stage: string; gst_number: string | null }>(),
  ]);

  if (!application || !profile) {
    return NextResponse.json({ ok: false, message: "This application could not be found." }, { status: 404 });
  }

  const maintenanceMode =
    application.partner_status === "active_partner"
    || application.registration_status === "iib_registered"
    || profile.workflow_stage === "completed";
  const onboardingMode = profile.workflow_stage === "iib_processing" && !maintenanceMode;
  const editable = EDITABLE_APPLICATION_STATUSES.has(application.status) || maintenanceMode;

  if (!editable) {
    return NextResponse.json(
      { ok: false, code: "application_not_editable", message: "This application is not editable in its current account state." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!onboardingMode && !maintenanceMode) {
    return NextResponse.json(
      { ok: false, code: "document_stage_locked", message: "Document upload is not available at the current stage." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (documentType === "gst_copy" && !profile.gst_number) {
    return NextResponse.json({ ok: false, message: "GST certificate is only required when GST details are saved." }, { status: 400 });
  }

  const extension = selected.type === "application/pdf" ? "pdf" : selected.type === "image/png" ? "png" : "jpg";
  const storagePath = `${applicationId}/intermediary/${documentType}/${randomUUID()}.${extension}`;
  const { data: previous } = await admin
    .from("intermediary_onboarding_documents")
    .select("storage_bucket,storage_path")
    .eq("application_id", applicationId)
    .eq("document_type", documentType)
    .maybeSingle<{ storage_bucket: string; storage_path: string }>();

  const { error: uploadError } = await admin.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, new Uint8Array(await selected.arrayBuffer()), { contentType: selected.type, upsert: false });
  if (uploadError) {
    return NextResponse.json({ ok: false, message: uploadError.message || "The document could not be uploaded." }, { status: 500 });
  }

  const { error: recordError } = await admin.from("intermediary_onboarding_documents").upsert(
    {
      application_id: applicationId,
      document_type: documentType,
      file_name: selected.name,
      storage_bucket: DOCUMENT_BUCKET,
      storage_path: storagePath,
      mime_type: selected.type,
      file_size: selected.size,
      verification_status: "pending",
      uploaded_by: reviewer.id,
    },
    { onConflict: "application_id,document_type" },
  );
  if (recordError) {
    await admin.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    return NextResponse.json({ ok: false, message: recordError.message || "The document record could not be saved." }, { status: 500 });
  }

  if (previous?.storage_path && previous.storage_path !== storagePath) {
    await removeStorageObjectIfUnreferenced(admin, previous.storage_bucket, previous.storage_path);
  }

  if (EDUCATION_TYPES.has(documentType)) {
    const { data: otherEducation } = await admin
      .from("intermediary_onboarding_documents")
      .select("id,storage_bucket,storage_path")
      .eq("application_id", applicationId)
      .in("document_type", [...EDUCATION_TYPES])
      .neq("document_type", documentType)
      .returns<Array<{ id: string; storage_bucket: string; storage_path: string }>>();
    for (const document of otherEducation ?? []) {
      await admin.from("intermediary_onboarding_documents").delete().eq("id", document.id);
      await removeStorageObjectIfUnreferenced(admin, document.storage_bucket, document.storage_path);
    }
    await admin
      .from("posp_misp_onboarding_profiles")
      .update({ education_status: "received", updated_by: reviewer.id, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
  }

  return NextResponse.json(
    {
      ok: true,
      document_type: documentType,
      file_name: selected.name,
      finalize_required: onboardingMode,
      maintenance_mode: maintenanceMode,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function text(data: FormData, key: string) {
  const value = data.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function removeStorageObjectIfUnreferenced(admin: ReturnType<typeof createSupabaseAdminClient>, bucket: string, path: string) {
  const { count } = await admin
    .from("intermediary_onboarding_documents")
    .select("id", { count: "exact", head: true })
    .eq("storage_bucket", bucket)
    .eq("storage_path", path);
  if (!count) await admin.storage.from(bucket).remove([path]);
}
