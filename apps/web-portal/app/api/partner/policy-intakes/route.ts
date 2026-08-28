import { after } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseWithAccessToken } from "@/lib/auth";
import { extractPolicyIntakeDocumentTrusted } from "@/lib/policy-intake-ocr-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const BUCKET = "policy-documents";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

type PartnerIdentity =
  | { actor_kind: "employee"; profile_id: string }
  | { actor_kind: "intermediary"; portal_account_id: string; intermediary_id: string };

type PartnerScope = {
  intermediary_ids?: string[];
};

type UploadMeta = {
  name: string;
  type: string;
  size: number;
};

type RequestBody =
  | { action: "prepare"; lead_source_id?: string; customer_mobile: string; file: UploadMeta }
  | { action: "complete"; id: string; number: string; lead_source_id?: string; customer_mobile: string; storage_path: string; file: UploadMeta }
  | { action: "prepare_response"; id: string; file: UploadMeta }
  | { action: "complete_response"; id: string; storage_path: string; file: UploadMeta };

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("policy_intake_requests")
    .select("id,intake_number,status,lead_source_name,lead_source_type,lead_source_code,customer_mobile,file_name,ocr_status,ocr_fields,attention_reason,created_at,updated_at,final_policy_id")
    .order("created_at", { ascending: false })
    .limit(100);

  query = auth.identity.actor_kind === "employee"
    ? query.eq("submitted_by_profile_id", auth.identity.profile_id)
    : query.eq("submitted_by_portal_account_id", auth.identity.portal_account_id);

  const { data, error } = await query;
  if (error) {
    return json({ ok: false, error: "Policy intakes could not be loaded." }, 500);
  }

  return json({ ok: true, intakes: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  if (body.action === "prepare") {
    return prepareUpload(auth.identity, auth.scope, body);
  }
  if (body.action === "complete") {
    return completeUpload(auth.identity, auth.scope, body);
  }
  if (body.action === "prepare_response") {
    return prepareResponse(auth.identity, body);
  }
  if (body.action === "complete_response") {
    return completeResponse(auth.identity, body);
  }

  return json({ ok: false, error: "Unsupported request." }, 400);
}

async function authenticate(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return { ok: false as const, response: json({ ok: false, error: "Authentication required." }, 401) };

  const scoped = createSupabaseWithAccessToken(token);
  const { data: userData, error: userError } = await scoped.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false as const, response: json({ ok: false, error: "Authentication required." }, 401) };
  }

  const [{ data: identityData, error: identityError }, { data: scopeData, error: scopeError }] = await Promise.all([
    scoped.rpc("partner_app_current_identity"),
    scoped.rpc("partner_app_commercial_scope"),
  ]);
  if (identityError || scopeError || !identityData || !scopeData) {
    return { ok: false as const, response: json({ ok: false, error: "INSUREIT Partner access is unavailable." }, 403) };
  }

  return {
    ok: true as const,
    identity: identityData as PartnerIdentity,
    scope: scopeData as PartnerScope,
  };
}

async function prepareUpload(
  identity: PartnerIdentity,
  scope: PartnerScope,
  input: Extract<RequestBody, { action: "prepare" }>,
) {
  const mobile = cleanMobile(input.customer_mobile);
  if (mobile.length !== 10) return json({ ok: false, error: "Enter a valid 10 digit customer mobile number." }, 400);

  const metaError = validateMeta(input.file);
  if (metaError) return json({ ok: false, error: metaError }, 400);

  const source = await resolveSource(identity, scope, input.lead_source_id);
  if (!source.ok) return json({ ok: false, error: source.error }, 403);

  const admin = createSupabaseAdminClient();
  const id = crypto.randomUUID();
  const number = intakeNumber();
  const storagePath = `intakes/${id}/original/${crypto.randomUUID()}-${safeName(input.file.name)}`;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data?.signedUrl) {
    return json({ ok: false, error: "Could not prepare the policy upload. Please try again." }, 500);
  }

  return json({ ok: true, id, number, storage_path: storagePath, signed_url: data.signedUrl });
}

async function completeUpload(
  identity: PartnerIdentity,
  scope: PartnerScope,
  input: Extract<RequestBody, { action: "complete" }>,
) {
  const mobile = cleanMobile(input.customer_mobile);
  if (mobile.length !== 10) return json({ ok: false, error: "Enter a valid 10 digit customer mobile number." }, 400);

  const metaError = validateMeta(input.file);
  if (metaError) return json({ ok: false, error: metaError }, 400);
  if (!input.id || !input.storage_path.startsWith(`intakes/${input.id}/original/`) || input.storage_path.includes("..")) {
    return json({ ok: false, error: "The upload reference is invalid." }, 400);
  }

  const sourceResult = await resolveSource(identity, scope, input.lead_source_id);
  if (!sourceResult.ok) return json({ ok: false, error: sourceResult.error }, 403);

  const admin = createSupabaseAdminClient();
  const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(input.storage_path);
  if (downloadError || !blob) return json({ ok: false, error: "The policy upload did not complete." }, 400);
  if (blob.size > MAX_FILE_SIZE) {
    await admin.storage.from(BUCKET).remove([input.storage_path]);
    return json({ ok: false, error: "Policy copy must be 15 MB or smaller." }, 400);
  }

  const { data: customers } = await admin
    .from("customers")
    .select("id")
    .eq("phone", mobile)
    .limit(1)
    .returns<Array<{ id: string }>>();

  const source = sourceResult.source;
  const submitter = identity.actor_kind === "employee"
    ? { submitted_by_profile_id: identity.profile_id, submitted_by_portal_account_id: null }
    : { submitted_by_profile_id: null, submitted_by_portal_account_id: identity.portal_account_id };

  const { error: intakeError } = await admin.from("policy_intake_requests").insert({
    id: input.id,
    intake_number: input.number,
    status: "processing",
    ...submitter,
    lead_source_id: source.id,
    lead_source_type: source.intermediary_type,
    lead_source_name: source.display_name,
    lead_source_code: source.intermediary_code,
    customer_mobile: mobile,
    matched_customer_id: customers?.[0]?.id ?? null,
    storage_bucket: BUCKET,
    storage_path: input.storage_path,
    file_name: input.file.name,
    mime_type: input.file.type,
    file_size: blob.size,
    ocr_status: "pending",
  });

  if (intakeError) {
    await admin.storage.from(BUCKET).remove([input.storage_path]);
    return json({ ok: false, error: "Policy intake could not be created." }, 500);
  }

  const uploader = identity.actor_kind === "employee"
    ? { uploaded_by_profile_id: identity.profile_id, uploaded_by_portal_account_id: null }
    : { uploaded_by_profile_id: null, uploaded_by_portal_account_id: identity.portal_account_id };

  const { error: documentError } = await admin.from("policy_intake_documents").insert({
    intake_id: input.id,
    source_kind: "original",
    storage_bucket: BUCKET,
    storage_path: input.storage_path,
    file_name: input.file.name,
    mime_type: input.file.type,
    file_size: blob.size,
    ...uploader,
    is_current: true,
  });

  if (documentError) {
    await admin.from("policy_intake_requests").delete().eq("id", input.id);
    await admin.storage.from(BUCKET).remove([input.storage_path]);
    return json({ ok: false, error: "Policy intake could not be created." }, 500);
  }

  after(async () => {
    await processStoredOcr(input.id);
  });

  return json({ ok: true, id: input.id, number: input.number, status: "processing" });
}

async function prepareResponse(
  identity: PartnerIdentity,
  input: Extract<RequestBody, { action: "prepare_response" }>,
) {
  const metaError = validateMeta(input.file);
  if (metaError) return json({ ok: false, error: metaError }, 400);

  const intake = await ownIntake(identity, input.id);
  if (!intake || intake.status !== "needs_attention") {
    return json({ ok: false, error: "This intake is not waiting for a replacement document." }, 403);
  }

  const storagePath = `intakes/${input.id}/responses/${crypto.randomUUID()}-${safeName(input.file.name)}`;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data?.signedUrl) {
    return json({ ok: false, error: "Could not prepare the replacement upload." }, 500);
  }

  return json({ ok: true, id: input.id, number: intake.intake_number, storage_path: storagePath, signed_url: data.signedUrl });
}

async function completeResponse(
  identity: PartnerIdentity,
  input: Extract<RequestBody, { action: "complete_response" }>,
) {
  const metaError = validateMeta(input.file);
  if (metaError) return json({ ok: false, error: metaError }, 400);
  if (!input.storage_path.startsWith(`intakes/${input.id}/responses/`) || input.storage_path.includes("..")) {
    return json({ ok: false, error: "The replacement upload reference is invalid." }, 400);
  }

  const intake = await ownIntake(identity, input.id);
  if (!intake || intake.status !== "needs_attention") {
    return json({ ok: false, error: "This intake no longer needs a response." }, 403);
  }

  const admin = createSupabaseAdminClient();
  const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(input.storage_path);
  if (downloadError || !blob) return json({ ok: false, error: "The replacement upload did not complete." }, 400);
  if (blob.size > MAX_FILE_SIZE) {
    await admin.storage.from(BUCKET).remove([input.storage_path]);
    return json({ ok: false, error: "Policy copy must be 15 MB or smaller." }, 400);
  }

  const uploader = identity.actor_kind === "employee"
    ? { uploaded_by_profile_id: identity.profile_id, uploaded_by_portal_account_id: null }
    : { uploaded_by_profile_id: null, uploaded_by_portal_account_id: identity.portal_account_id };

  const { data: newDocument, error: documentError } = await admin
    .from("policy_intake_documents")
    .insert({
      intake_id: input.id,
      source_kind: "replacement",
      storage_bucket: BUCKET,
      storage_path: input.storage_path,
      file_name: input.file.name,
      mime_type: input.file.type,
      file_size: blob.size,
      ...uploader,
      is_current: false,
    })
    .select("id")
    .single<{ id: string }>();

  if (documentError || !newDocument) {
    await admin.storage.from(BUCKET).remove([input.storage_path]);
    return json({ ok: false, error: "Could not attach the replacement policy copy." }, 500);
  }

  await admin.from("policy_intake_documents").update({ is_current: false }).eq("intake_id", input.id).eq("is_current", true);
  const { error: currentError } = await admin.from("policy_intake_documents").update({ is_current: true }).eq("id", newDocument.id);
  if (currentError) return json({ ok: false, error: "Could not activate the replacement policy copy." }, 500);

  let update = admin
    .from("policy_intake_requests")
    .update({
      status: "processing",
      storage_path: input.storage_path,
      file_name: input.file.name,
      mime_type: input.file.type,
      file_size: blob.size,
      ocr_status: "pending",
      ocr_fields: [],
      ocr_warnings: [],
      ocr_parser_id: null,
      ocr_parser_version: null,
      attention_reason: null,
      assigned_to_profile_id: null,
    })
    .eq("id", input.id)
    .eq("status", "needs_attention");

  update = identity.actor_kind === "employee"
    ? update.eq("submitted_by_profile_id", identity.profile_id)
    : update.eq("submitted_by_portal_account_id", identity.portal_account_id);

  const { error: updateError } = await update;
  if (updateError) return json({ ok: false, error: "Could not attach the replacement policy copy." }, 500);

  after(async () => {
    await processStoredOcr(input.id);
  });

  return json({ ok: true, id: input.id, number: intake.intake_number, status: "processing" });
}

async function ownIntake(identity: PartnerIdentity, id: string) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("policy_intake_requests")
    .select("id,intake_number,status,storage_bucket,storage_path")
    .eq("id", id);

  query = identity.actor_kind === "employee"
    ? query.eq("submitted_by_profile_id", identity.profile_id)
    : query.eq("submitted_by_portal_account_id", identity.portal_account_id);

  const { data } = await query.maybeSingle<{
    id: string;
    intake_number: string;
    status: string;
    storage_bucket: string;
    storage_path: string;
  }>();
  return data;
}

async function resolveSource(identity: PartnerIdentity, scope: PartnerScope, requestedId?: string) {
  const sourceId = identity.actor_kind === "intermediary"
    ? identity.intermediary_id
    : requestedId?.trim();

  if (!sourceId) return { ok: false as const, error: "Select an authorized Partner, POSP or MISP." };
  if (identity.actor_kind === "employee" && !(scope.intermediary_ids ?? []).includes(sourceId)) {
    return { ok: false as const, error: "This lead source is outside your permitted sales scope." };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("intermediaries")
    .select("id,intermediary_type,display_name,intermediary_code,account_status")
    .eq("id", sourceId)
    .maybeSingle<{
      id: string;
      intermediary_type: "partner" | "posp" | "misp";
      display_name: string;
      intermediary_code: string | null;
      account_status: string;
    }>();

  if (error || !data || data.account_status !== "active" || !["partner", "posp", "misp"].includes(data.intermediary_type)) {
    return { ok: false as const, error: "The selected lead source is no longer active." };
  }

  return { ok: true as const, source: data };
}

async function processStoredOcr(id: string) {
  const admin = createSupabaseAdminClient();
  const { data: intake } = await admin
    .from("policy_intake_requests")
    .select("id,status,storage_bucket,storage_path,file_name,mime_type")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      status: string;
      storage_bucket: string;
      storage_path: string;
      file_name: string;
      mime_type: string | null;
    }>();

  if (!intake || intake.status !== "processing") return;

  await admin.from("policy_intake_requests")
    .update({ ocr_status: "processing" })
    .eq("id", id)
    .eq("storage_path", intake.storage_path);

  const { data: blob, error } = await admin.storage.from(intake.storage_bucket).download(intake.storage_path);
  if (error || !blob) {
    await markOcrFailure(id, intake.storage_path, "The stored policy copy could not be read automatically.");
    return;
  }

  const file = new File(
    [await blob.arrayBuffer()],
    intake.file_name,
    { type: intake.mime_type || blob.type || "application/pdf" },
  );
  const formData = new FormData();
  formData.set("policy_document", file);
  const ocr = await extractPolicyIntakeDocumentTrusted(formData);

  if (!ocr.ok) {
    await markOcrFailure(id, intake.storage_path, ocr.error);
    return;
  }

  await admin.from("policy_intake_requests")
    .update({
      status: "ready_for_review",
      ocr_status: "completed",
      ocr_fields: ocr.fields,
      ocr_parser_id: ocr.parserId,
      ocr_parser_version: ocr.parserVersion,
      ocr_warnings: ocr.warnings,
      attention_reason: null,
    })
    .eq("id", id)
    .eq("storage_path", intake.storage_path)
    .eq("status", "processing");
}

async function markOcrFailure(id: string, storagePath: string, message: string) {
  const admin = createSupabaseAdminClient();
  await admin.from("policy_intake_requests")
    .update({ ocr_status: "failed", ocr_warnings: [message] })
    .eq("id", id)
    .eq("storage_path", storagePath)
    .eq("status", "processing");
}

function validateMeta(file: UploadMeta) {
  if (!file?.name?.trim() || !file.size) return "Upload the policy PDF or image.";
  if (!ALLOWED_TYPES.has(file.type)) return "Upload a PDF, JPG, PNG or WebP policy copy.";
  if (file.size > MAX_FILE_SIZE) return "Policy copy must be 15 MB or smaller.";
  return null;
}

function cleanMobile(value: string) {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

function safeName(value: string) {
  return value.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "") || "policy-copy";
}

function intakeNumber() {
  return `PIR-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

function bearerToken(value: string | null) {
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
