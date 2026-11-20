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

/** Delete only a document belonging to the signed-in employee's editable Partner application. */
export async function DELETE(request: Request) {
  const match = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) return response({ ok: false, error: "Sign in again to delete documents." }, 401);

  const scoped = createSupabaseWithAccessToken(match[1]);
  const { data: auth, error: authError } = await scoped.auth.getUser(match[1]);
  if (authError || !auth.user) return response({ ok: false, error: "Session expired." }, 401);
  const { data: identity, error: identityError } = await scoped.rpc("partner_app_current_identity");
  if (identityError || !identity || identity.actor_kind !== "employee"
    || identity.auth_user_id !== auth.user.id || identity.profile_id !== auth.user.id) {
    return response({ ok: false, error: "Only authorized employees may delete Partner documents." }, 403);
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

  let body: unknown;
  try { body = await request.json(); }
  catch { return response({ ok: false, error: "Invalid delete request." }, 400); }
  if (!body || typeof body !== "object") return response({ ok: false, error: "Invalid delete request." }, 400);
  const { application_id: applicationId, document_type: documentType } = body as Record<string, unknown>;
  if (typeof applicationId !== "string" || !/^[a-f0-9-]{36}$/i.test(applicationId)
    || typeof documentType !== "string" || !DOCUMENT_TYPES.has(documentType)) {
    return response({ ok: false, error: "Choose a valid Partner document." }, 400);
  }

  const [{ data: application }, { data: onboardingProfile }] = await Promise.all([
    admin.from("intermediary_onboarding_applications")
      .select("id,initiated_by,status,partner_status,draft_data")
      .eq("id", applicationId).maybeSingle<{
        id: string; initiated_by: string; status: string; partner_status: string | null;
        draft_data: Record<string, unknown> | null;
      }>(),
    admin.from("posp_misp_onboarding_profiles")
      .select("id,workflow_stage").eq("application_id", applicationId)
      .maybeSingle<{ id: string; workflow_stage: string }>(),
  ]);
  if (!application || application.initiated_by !== profile.id
    || application.draft_data?.mobile_partner_only !== true
    || !onboardingProfile || onboardingProfile.workflow_stage !== "iib_processing"
    || !["submitted", "under_review", "changes_requested"].includes(application.status)
    || application.partner_status === "active_partner") {
    return response({ ok: false, error: "This Partner application is not available for document deletion." }, 403);
  }

  // Remove precisely this category's row, never arbitrary paths supplied by a client.
  const { data: document, error: documentError } = await admin.from("intermediary_onboarding_documents")
    .select("id,storage_bucket,storage_path")
    .eq("application_id", applicationId).eq("document_type", documentType)
    .maybeSingle<{ id: string; storage_bucket: string; storage_path: string }>();
  if (documentError) return response({ ok: false, error: "Could not read the selected document." }, 500);
  if (!document) return response({ ok: false, error: "Document is no longer available." }, 404);
  const { data: deleted, error: deleteError } = await admin.from("intermediary_onboarding_documents")
    .delete().eq("id", document.id)
    .eq("application_id", applicationId)
    .eq("document_type", documentType)
    .eq("storage_bucket", document.storage_bucket)
    .eq("storage_path", document.storage_path)
    .select("id");
  if (deleteError || deleted?.length !== 1) return response({ ok: false, error: "Document could not be deleted. Refresh and retry." }, 409);

  // Storage cleanup happens only after the DB delete is committed, and only
  // for paths no longer referenced by another record.
  const { count, error: countError } = await admin.from("intermediary_onboarding_documents")
    .select("id", { count: "exact", head: true })
    .eq("storage_bucket", document.storage_bucket).eq("storage_path", document.storage_path);
  if (!countError && count === 0) {
    await admin.storage.from(document.storage_bucket).remove([document.storage_path]);
  }
  return response({ ok: true, document_type: documentType });
}


const PARTNER_REQUIRED_DOCUMENTS = ["aadhaar_front", "aadhaar_back", "pan_copy", "cancelled_cheque", "photograph"] as const;
const PARTNER_APPLICATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Reading stored files and finalizing a mobile-created Partner are owner-scoped.
 * This never grants generic access to unrelated intermediary applications. */
async function authorizePartnerDocumentCompletion(request: Request, applicationId: string) {
  if (!PARTNER_APPLICATION_ID.test(applicationId)) return { error: response({ ok: false, error: "Invalid Partner application." }, 400) };
  const token = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return { error: response({ ok: false, error: "Sign in again to continue." }, 401) };
  const scoped = createSupabaseWithAccessToken(token);
  const { data: auth, error: authError } = await scoped.auth.getUser(token);
  if (authError || !auth.user) return { error: response({ ok: false, error: "Session expired." }, 401) };
  const { data: identity, error: identityError } = await scoped.rpc("partner_app_current_identity");
  if (identityError || !identity || identity.actor_kind !== "employee"
    || identity.auth_user_id !== auth.user.id || identity.profile_id !== auth.user.id) {
    return { error: response({ ok: false, error: "Only authorized employees may complete Partner applications." }, 403) };
  }
  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,role,is_active,employee_id").eq("id", auth.user.id).maybeSingle();
  if (profileError || !profile?.is_active || !profile.employee_id || profile.role !== identity.role) {
    return { error: response({ ok: false, error: "Employee account is inactive." }, 403) };
  }
  const { data: employee } = await admin.from("employees").select("employment_status").eq("id", profile.employee_id).maybeSingle();
  if (employee?.employment_status !== "active") {
    return { error: response({ ok: false, error: "Employee account is inactive." }, 403) };
  }
  const permissions = await getEffectivePermissionAccessMap(profile);
  if (!["edit", "approve"].includes(permissions.create_intermediary_application ?? "none")
    || !(await isEmployeeWithinAccessScope(profile.id, profile.role, profile.employee_id))) {
    return { error: response({ ok: false, error: "You do not have Add Partner permission." }, 403) };
  }
  const [{ data: application, error: appError }, { data: onboarding, error: onboardingError }] = await Promise.all([
    admin.from("intermediary_onboarding_applications").select("id,initiated_by,requested_type,status,partner_status,draft_data")
      .eq("id", applicationId).eq("initiated_by", profile.id).maybeSingle(),
    admin.from("posp_misp_onboarding_profiles").select("workflow_stage,gst_number,partner_status,partner_id")
      .eq("application_id", applicationId).eq("partner_type", "posp").maybeSingle(),
  ]);
  if (appError || onboardingError) return { error: response({ ok: false, error: "Unable to check Partner application." }, 503) };
  if (!application || application.requested_type !== "posp" || application.draft_data?.mobile_partner_only !== true || !onboarding) {
    return { error: response({ ok: false, error: "Partner application is not available to this account." }, 404) };
  }
  const alreadyActive = application.partner_status === "active_partner"
    && onboarding.partner_status === "active_partner"
    && Boolean(onboarding.partner_id && !onboarding.partner_id.startsWith("PENDING-"));
  if (!alreadyActive && (!["submitted", "under_review", "changes_requested"].includes(application.status)
    || onboarding.workflow_stage !== "iib_processing")) {
    return { error: response({ ok: false, error: "Partner is not in an eligible document-completion stage." }, 409) };
  }
  return { admin, actorId: profile.id, onboarding, alreadyActive };
}

/** Reload previously uploaded documents on app restart; never trusts local upload state. */
export async function GET(request: Request) {
  const applicationId = new URL(request.url).searchParams.get("applicationId") ?? "";
  const context = await authorizePartnerDocumentCompletion(request, applicationId);
  if ("error" in context) return context.error;
  const { data: documents, error } = await context.admin.from("intermediary_onboarding_documents")
    .select("document_type,file_name").eq("application_id", applicationId);
  if (error) return response({ ok: false, error: "Saved documents could not be loaded." }, 503);
  const required = [...PARTNER_REQUIRED_DOCUMENTS, ...(context.onboarding.gst_number ? ["gst_copy"] : [])];
  const available = new Set((documents ?? []).filter(item => Boolean(item.file_name?.trim())).map(item => item.document_type));
  return response({ ok: true, documents: (documents ?? []).map(item => ({ type: item.document_type, name: item.file_name })),
    missing: required.filter(type => !available.has(type)),
    partner_id: context.alreadyActive ? context.onboarding.partner_id : null,
    status: context.alreadyActive ? "active" : required.every(type => available.has(type)) ? "ready_to_finalize" : "documents_pending" });
}

/** Explicit user-confirmed completion; uses the canonical atomic activation RPC. */
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null) as { application_id?: unknown } | null;
  const applicationId = typeof body?.application_id === "string" ? body.application_id.trim() : "";
  const context = await authorizePartnerDocumentCompletion(request, applicationId);
  if ("error" in context) return context.error;
  const { data: documents, error: documentError } = await context.admin.from("intermediary_onboarding_documents")
    .select("document_type,file_name").eq("application_id", applicationId);
  if (documentError) return response({ ok: false, error: "Unable to verify your saved documents." }, 503);
  const available = new Set((documents ?? []).filter(item => Boolean(item.file_name?.trim())).map(item => item.document_type));
  const required = [...PARTNER_REQUIRED_DOCUMENTS, ...(context.onboarding.gst_number ? ["gst_copy"] : [])];
  const missing = required.filter(type => !available.has(type));
  if (missing.length) return response({ ok: false, error: "Documents still required: " + missing.join(", ").replaceAll("_", " "), missing }, 400);
  const { data: activated, error: activationError } = await context.admin.rpc("finalize_partner_activation_v2", {
    p_application_id: applicationId, p_actor_id: context.actorId,
  });
  if (activationError || !activated || typeof activated.partner_id !== "string") {
    console.error("[partner-app-partner-activation] failed", { applicationId, code: activationError?.code ?? "invalid_result" });
    return response({ ok: false, error: "Documents are saved, but Partner ID could not be issued. Contact Operations with this application reference." }, 409);
  }
  return response({ ok: true, partner_id: activated.partner_id, status: "active", already_active: activated.already_active === true });
}
