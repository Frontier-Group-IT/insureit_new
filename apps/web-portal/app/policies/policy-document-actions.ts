"use server";

import { revalidatePath } from "next/cache";
import { canAccessCustomer } from "@/lib/employee-access-scope";
import { canAccessPolicy } from "@/lib/policy-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { POLICY_ACTIVITY_ACTIONS, recordPolicyActivity } from "@/lib/policy-activity";

const POLICY_DOCUMENT_BUCKET = "policy-documents";
const MAX_POLICY_COPY_BYTES = 15 * 1024 * 1024;
const POLICY_COPY_SIGNED_URL_TTL_SECONDS = 5 * 60;
const ALLOWED_POLICY_COPY_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type PolicyCopyUploadResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string };

export type PolicyCopyOpenResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function safeFileName(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned || "policy-copy";
}

export async function openPolicyCopy(documentId: string): Promise<PolicyCopyOpenResult> {
  const profile = await requireCapability("view_policies");
  if (!profile) return { ok: false, error: "You do not have access to view policy documents." };

  const normalizedDocumentId = documentId.trim();
  if (!normalizedDocumentId) return { ok: false, error: "Policy document reference is missing." };

  const admin = createSupabaseAdminClient();
  const { data: documentRow, error: documentError } = await admin
    .from("policy_documents")
    .select("id, policy_id, document_type, storage_bucket, storage_path, policies!inner(customer_id)")
    .eq("id", normalizedDocumentId)
    .eq("document_type", "policy_copy")
    .maybeSingle<{
      id: string;
      policy_id: string;
      document_type: string;
      storage_bucket: string;
      storage_path: string;
      policies: { customer_id: string } | null;
    }>();

  if (documentError) return { ok: false, error: "Could not load the policy copy. Please try again." };
  if (!documentRow?.id || !documentRow.policies?.customer_id) return { ok: false, error: "Policy copy is not available." };

  const canView = profile.role === "operations_head_life"
    ? await canAccessPolicy(profile.id, profile.role, documentRow.policy_id, "view_policies")
    : await canAccessCustomer(profile.id, profile.role, documentRow.policies.customer_id, "view_policies");
  if (!canView) return { ok: false, error: "You do not have access to this policy copy." };

  const { data: signed, error: signedError } = await admin.storage
    .from(documentRow.storage_bucket)
    .createSignedUrl(documentRow.storage_path, POLICY_COPY_SIGNED_URL_TTL_SECONDS);

  if (signedError || !signed?.signedUrl) return { ok: false, error: "Could not open the policy copy. Please try again." };
  return { ok: true, url: signed.signedUrl };
}

export type PolicyCopyFileMetadata = { name: string; size: number; type: string };
export type PolicyCopySignedUpload =
  | { ok: true; path: string; token: string }
  | { ok: false; error: string };

function validatePolicyCopyMetadata(file: PolicyCopyFileMetadata): string | null {
  if (!file.name?.trim() || !Number.isSafeInteger(file.size) || file.size <= 0) return "Select a valid policy copy to upload.";
  if (file.size > MAX_POLICY_COPY_BYTES) return "Policy copy must be 15 MB or smaller.";
  if (!ALLOWED_POLICY_COPY_TYPES.has(file.type)) return "Upload a PDF, JPG, PNG or WEBP policy copy.";
  return null;
}

async function findEditablePolicy(policyId: string) {
  const profile = await requirePolicyEditor(policyId);
  const admin = createSupabaseAdminClient();
  const { data: policy, error } = await admin
    .from("policies").select("id").eq("id", policyId).maybeSingle<{ id: string }>();
  if (error) throw new Error("Could not verify the saved policy. Please try again.");
  if (!policy) throw new Error("This policy does not exist in the database. Check the policy record before retrying.");
  return { profile, admin, policy };
}

/**
 * Send only metadata through the Next.js Server Action. File bytes go directly
 * from the browser to private Supabase Storage using this short-lived token.
 */
export async function preparePolicyCopyUpload(
  policyId: string,
  file: PolicyCopyFileMetadata,
): Promise<PolicyCopySignedUpload> {
  try {
    if (!policyId.trim()) return { ok: false, error: "Policy reference is missing." };
    const invalid = validatePolicyCopyMetadata(file);
    if (invalid) return { ok: false, error: invalid };
    const { admin, policy } = await findEditablePolicy(policyId.trim());
    const path = `${policy.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { data, error } = await admin.storage.from(POLICY_DOCUMENT_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    if (error || !data?.token) return { ok: false, error: error?.message ?? "Could not prepare the policy copy upload." };
    return { ok: true, path, token: data.token };
  } catch (error) {
    console.error("policy_copy_prepare_failed", error instanceof Error ? error.message : "Unknown error");
    return { ok: false, error: error instanceof Error ? error.message : "Could not prepare the policy copy upload." };
  }
}

/**
 * Do not trust browser-supplied file details or paths. Check the signed object
 * exists and its authoritative Storage metadata matches the expected file.
 * Repeated finalization of one path is idempotent.
 */
export async function finalizePolicyCopyUpload(
  policyId: string,
  path: string,
  file: PolicyCopyFileMetadata,
): Promise<PolicyCopyUploadResult> {
  try {
    if (!policyId.trim()) return { ok: false, error: "Policy reference is missing." };
    const invalid = validatePolicyCopyMetadata(file);
    if (invalid) return { ok: false, error: invalid };
    const { admin, policy, profile } = await findEditablePolicy(policyId.trim());
    const expectedPrefix = `${policy.id}/`;
    const uploadedFileName = safeFileName(file.name);
    const suffix = path.startsWith(expectedPrefix) ? path.slice(expectedPrefix.length) : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i.test(suffix)
      || !suffix.endsWith(`-${uploadedFileName}`) || suffix.includes("/") || suffix.includes("..")) {
      return { ok: false, error: "Invalid policy document upload reference." };
    }

    const existing = await admin.from("policy_documents")
      .select("id").eq("policy_id", policy.id).eq("document_type", "policy_copy")
      .eq("storage_bucket", POLICY_DOCUMENT_BUCKET).eq("storage_path", path)
      .maybeSingle<{ id: string }>();
    if (existing.error) return { ok: false, error: "Could not verify the policy copy registration." };
    if (existing.data) return { ok: true, documentId: existing.data.id };

    const { data: storageFile, error: infoError } = await admin.storage
      .from(POLICY_DOCUMENT_BUCKET).info(path);
    if (infoError || !storageFile) return { ok: false, error: "The uploaded file was not found. Retry the upload." };
    if (storageFile.size !== file.size || storageFile.mimeType !== file.type || storageFile.size > MAX_POLICY_COPY_BYTES) {
      return { ok: false, error: "The uploaded file does not match the selected policy copy. Retry the upload." };
    }

    const { data: documentRow, error: insertError } = await admin.from("policy_documents")
      .insert({
        policy_id: policy.id,
        document_type: "policy_copy",
        file_name: file.name,
        storage_bucket: POLICY_DOCUMENT_BUCKET,
        storage_path: path,
        mime_type: storageFile.mimeType,
        file_size: storageFile.size,
        uploaded_by: profile.id,
      })
      .select("id").single<{ id: string }>();

    if (insertError || !documentRow) {
      const alreadyRegistered = await admin.from("policy_documents")
        .select("id").eq("policy_id", policy.id).eq("storage_path", path)
        .maybeSingle<{ id: string }>();
      if (alreadyRegistered.data) return { ok: true, documentId: alreadyRegistered.data.id };
      // Keep the uploaded file so retries can safely finalize the same path.
      return { ok: false, error: "Policy copy uploaded, but registration failed. Retry without creating a new policy." };
    }

    try {
      await recordPolicyActivity(admin, policy.id, profile.id, POLICY_ACTIVITY_ACTIONS.POLICY_DOC_UPLOADED);
    } catch (activityError) {
      console.error("policy_copy_activity_failed", activityError);
    }
    revalidatePath("/policies");
    revalidatePath(`/policies/${policy.id}`);
    return { ok: true, documentId: documentRow.id };
  } catch (error) {
    console.error("policy_copy_finalize_failed", error instanceof Error ? error.message : "Unknown error");
    return { ok: false, error: error instanceof Error ? error.message : "Could not complete the policy copy upload." };
  }
}
