"use server";

import { revalidatePath } from "next/cache";
import { preparePolicyIntakeUpload, completePolicyIntakeUpload } from "@/app/policy-intakes/actions";
import { canAccessIntermediary } from "@/lib/employee-access-scope";
import { requirePolicyIntakeCreator } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const BUCKET = "policy-documents";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export type PolicyIntakePolicyType = "motor" | "non_motor" | "life" | "health";
type UploadMeta = { name: string; type: string; size: number };
type PreparedUpload = { ok: true; id: string; number: string; storagePath: string; signedUrl: string } | { ok: false; error: string };
type CompleteTypedPolicyIntakeResult = { ok: true; id: string; number: string; status: "processing" | "ready_for_review" } | { ok: false; error: string };

function cleanMobile(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function isPolicyType(value: string): value is PolicyIntakePolicyType {
  return value === "motor" || value === "non_motor" || value === "life" || value === "health";
}

function isProposalType(value: PolicyIntakePolicyType) {
  return value === "life" || value === "health";
}

function validateMeta(meta: UploadMeta, proposal: boolean) {
  const documentName = proposal ? "proposal form" : "policy copy";
  if (!meta.name?.trim() || !meta.size) return `Upload the ${documentName} PDF or image.`;
  if (!ALLOWED_TYPES.has(meta.type)) return `Upload a PDF, JPG, PNG or WebP ${documentName}.`;
  if (meta.size > MAX_FILE_SIZE) return `${proposal ? "Proposal form" : "Policy copy"} must be 15 MB or smaller.`;
  return null;
}

async function validSource(profile: { id: string; role: string | null }, leadSourceId: string) {
  if (!leadSourceId) return { ok: false as const, error: "Select an assigned Partner, POSP or MISP." };
  const allowed = await canAccessIntermediary(profile.id, profile.role, leadSourceId, "create_policy_intakes");
  if (!allowed) return { ok: false as const, error: "This lead source is outside your permitted sales scope." };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("intermediaries")
    .select("id,intermediary_type,display_name,intermediary_code,account_status")
    .eq("id", leadSourceId)
    .maybeSingle<{ id: string; intermediary_type: "posp" | "misp" | "partner"; display_name: string; intermediary_code: string | null; account_status: string }>();
  if (error || !data || data.account_status !== "active") return { ok: false as const, error: "The selected lead source is no longer active." };
  return { ok: true as const, source: data };
}

export async function prepareTypedPolicyIntakeUpload(input: {
  leadSourceId: string;
  customerMobile: string;
  policyType: string;
  file: UploadMeta;
}): Promise<PreparedUpload> {
  if (!isPolicyType(input.policyType)) return { ok: false, error: "Select a policy type." };
  const metaError = validateMeta(input.file, isProposalType(input.policyType));
  if (metaError) return { ok: false, error: metaError };
  return preparePolicyIntakeUpload({ leadSourceId: input.leadSourceId, customerMobile: input.customerMobile, file: input.file });
}

export async function completeTypedPolicyIntakeUpload(input: {
  id: string;
  number: string;
  leadSourceId: string;
  customerMobile: string;
  policyType: string;
  storagePath: string;
  file: UploadMeta;
}): Promise<CompleteTypedPolicyIntakeResult> {
  if (!isPolicyType(input.policyType)) return { ok: false, error: "Select a policy type." };

  // Motor and Non-Motor intentionally retain the existing OCR pipeline unchanged.
  if (!isProposalType(input.policyType)) {
    const result = await completePolicyIntakeUpload({
      id: input.id,
      number: input.number,
      leadSourceId: input.leadSourceId,
      customerMobile: input.customerMobile,
      storagePath: input.storagePath,
      file: input.file,
    });
    if (!result.ok) return result;
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("policy_intake_requests").update({ policy_type: input.policyType }).eq("id", input.id);
    if (error) return { ok: false, error: "Policy type could not be saved. Please contact Operations before continuing." };
    return result;
  }

  // Life/Health proposal forms are created directly in Ready for Review state.
  // They never enter the OCR-processing state, so background/retry OCR cannot pick them up.
  const profile = await requirePolicyIntakeCreator();
  const customerMobile = cleanMobile(input.customerMobile);
  if (customerMobile.length !== 10) return { ok: false, error: "Enter a valid 10 digit customer mobile number." };
  const metaError = validateMeta(input.file, true);
  if (metaError) return { ok: false, error: metaError };
  if (!input.id || !input.storagePath.startsWith(`intakes/${input.id}/original/`) || input.storagePath.includes("..")) {
    return { ok: false, error: "The upload reference is invalid. Please try again." };
  }

  const sourceResult = await validSource(profile, input.leadSourceId);
  if (!sourceResult.ok) return sourceResult;
  const admin = createSupabaseAdminClient();
  const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(input.storagePath);
  if (downloadError || !blob) return { ok: false, error: "The proposal form upload did not complete. Please try again." };
  if (blob.size > MAX_FILE_SIZE) {
    await admin.storage.from(BUCKET).remove([input.storagePath]);
    return { ok: false, error: "Proposal form must be 15 MB or smaller." };
  }

  const source = sourceResult.source;
  const { error: insertError } = await admin.from("policy_intake_requests").insert({
    id: input.id,
    intake_number: input.number,
    status: "ready_for_review",
    policy_type: input.policyType,
    submitted_by_profile_id: profile.id,
    lead_source_id: source.id,
    lead_source_type: source.intermediary_type,
    lead_source_name: source.display_name,
    lead_source_code: source.intermediary_code,
    customer_mobile: customerMobile,
    matched_customer_id: null,
    storage_bucket: BUCKET,
    storage_path: input.storagePath,
    file_name: input.file.name,
    mime_type: input.file.type,
    file_size: blob.size,
    ocr_status: "not_applicable",
    ocr_fields: [],
    ocr_warnings: [],
  });
  if (insertError) {
    await admin.storage.from(BUCKET).remove([input.storagePath]);
    return { ok: false, error: "Policy intake could not be created. Please try again." };
  }

  const { error: documentError } = await admin.from("policy_intake_documents").insert({
    intake_id: input.id,
    source_kind: "original",
    storage_bucket: BUCKET,
    storage_path: input.storagePath,
    file_name: input.file.name,
    mime_type: input.file.type,
    file_size: blob.size,
    uploaded_by_profile_id: profile.id,
    is_current: true,
  });
  if (documentError) {
    await admin.from("policy_intake_requests").delete().eq("id", input.id);
    await admin.storage.from(BUCKET).remove([input.storagePath]);
    return { ok: false, error: "Policy intake could not be created. Please try again." };
  }

  revalidatePath("/policy-intakes");
  revalidatePath(`/policy-intakes/${input.id}`);
  return { ok: true, id: input.id, number: input.number, status: "ready_for_review" };
}
