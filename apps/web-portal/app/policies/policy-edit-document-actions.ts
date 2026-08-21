"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { schedulePolicyOcrTraining } from "@/lib/policy-ocr-training-schedule";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { POLICY_ACTIVITY_ACTIONS, recordPolicyActivity } from "@/lib/policy-activity";

const POLICY_DOCUMENT_BUCKET = "policy-documents";
const MAX_POLICY_COPY_BYTES = 50 * 1024 * 1024;
const ALLOWED_POLICY_COPY_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type PolicyEditCopy = {
  id: string;
  fileName: string;
  mimeType: string | null;
};

export type PolicyEditCopyResult =
  | { ok: true; document: PolicyEditCopy | null }
  | { ok: false; error: string };

type PolicyDocumentRow = {
  id: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeFileName(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned || "policy-copy";
}

function metadata(row: Pick<PolicyDocumentRow, "id" | "file_name" | "mime_type">): PolicyEditCopy {
  return { id: row.id, fileName: row.file_name, mimeType: row.mime_type };
}

async function latestPolicyCopy(admin: ReturnType<typeof createSupabaseAdminClient>, policyId: string) {
  return admin
    .from("policy_documents")
    .select("id,file_name,storage_bucket,storage_path,mime_type")
    .eq("policy_id", policyId)
    .eq("document_type", "policy_copy")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<PolicyDocumentRow>();
}

export async function getPolicyCopyForEdit(policyId: string): Promise<PolicyEditCopyResult> {
  await requirePolicyEditor();
  const normalizedPolicyId = policyId.trim();
  if (!isUuid(normalizedPolicyId)) return { ok: false, error: "Invalid policy reference." };

  const admin = createSupabaseAdminClient();
  const { data, error } = await latestPolicyCopy(admin, normalizedPolicyId);
  if (error) return { ok: false, error: "Could not load the policy copy. Please try again." };
  return { ok: true, document: data ? metadata(data) : null };
}

export async function savePolicyCopyForEdit(policyId: string, formData: FormData): Promise<PolicyEditCopyResult> {
  const profile = await requirePolicyEditor();
  const normalizedPolicyId = policyId.trim();
  const file = formData.get("file");

  if (!isUuid(normalizedPolicyId)) return { ok: false, error: "Invalid policy reference." };
  if (!(file instanceof File) || file.size <= 0) return { ok: false, error: "Select a policy copy to upload." };
  if (file.size > MAX_POLICY_COPY_BYTES) return { ok: false, error: "Policy copy must be 50 MB or smaller." };
  if (!ALLOWED_POLICY_COPY_TYPES.has(file.type)) {
    return { ok: false, error: "Upload a PDF, JPG, PNG or WEBP policy copy." };
  }

  const admin = createSupabaseAdminClient();
  const { data: policy, error: policyError } = await admin
    .from("policies")
    .select("id")
    .eq("id", normalizedPolicyId)
    .maybeSingle<{ id: string }>();
  if (policyError) return { ok: false, error: "Could not verify the policy. Please try again." };
  if (!policy?.id) return { ok: false, error: "This policy no longer exists." };

  const { data: existing, error: existingError } = await latestPolicyCopy(admin, normalizedPolicyId);
  if (existingError) return { ok: false, error: "Could not verify the current policy copy. Please try again." };

  const storagePath = `${normalizedPolicyId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await admin.storage
    .from(POLICY_DOCUMENT_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, error: `Policy copy could not be uploaded: ${uploadError.message}` };

  let saved: Pick<PolicyDocumentRow, "id" | "file_name" | "mime_type"> | null = null;
  let metadataError: { message: string } | null = null;

  if (existing) {
    const result = await admin
      .from("policy_documents")
      .update({
        file_name: file.name,
        storage_bucket: POLICY_DOCUMENT_BUCKET,
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.size,
        uploaded_by: profile.id,
      })
      .eq("id", existing.id)
      .select("id,file_name,mime_type")
      .single<Pick<PolicyDocumentRow, "id" | "file_name" | "mime_type">>();
    saved = result.data;
    metadataError = result.error;
  } else {
    const result = await admin
      .from("policy_documents")
      .insert({
        policy_id: normalizedPolicyId,
        document_type: "policy_copy",
        file_name: file.name,
        storage_bucket: POLICY_DOCUMENT_BUCKET,
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.size,
        uploaded_by: profile.id,
      })
      .select("id,file_name,mime_type")
      .single<Pick<PolicyDocumentRow, "id" | "file_name" | "mime_type">>();
    saved = result.data;
    metadataError = result.error;
  }

  if (metadataError || !saved?.id) {
    await admin.storage.from(POLICY_DOCUMENT_BUCKET).remove([storagePath]);
    return { ok: false, error: "The file uploaded, but the policy-copy record could not be saved. Please try again." };
  }

  if (existing?.storage_path && existing.storage_path !== storagePath) {
    await admin.storage.from(existing.storage_bucket || POLICY_DOCUMENT_BUCKET).remove([existing.storage_path]);
  }

  await recordPolicyActivity(
    admin,
    normalizedPolicyId,
    profile.id,
    existing ? POLICY_ACTIVITY_ACTIONS.POLICY_DOC_REPLACED : POLICY_ACTIVITY_ACTIONS.POLICY_DOC_UPLOADED,
  );
  await schedulePolicyOcrTraining();
  revalidatePath("/policies");
  revalidatePath(`/policies/${normalizedPolicyId}/edit`);
  return { ok: true, document: metadata(saved) };
}

export async function removePolicyCopyForEdit(policyId: string): Promise<PolicyEditCopyResult> {
  const profile = await requirePolicyEditor();
  const normalizedPolicyId = policyId.trim();
  if (!isUuid(normalizedPolicyId)) return { ok: false, error: "Invalid policy reference." };

  const admin = createSupabaseAdminClient();
  const { data: policy, error: policyError } = await admin
    .from("policies")
    .select("id")
    .eq("id", normalizedPolicyId)
    .maybeSingle<{ id: string }>();
  if (policyError) return { ok: false, error: "Could not verify the policy. Please try again." };
  if (!policy?.id) return { ok: false, error: "This policy no longer exists." };

  const { data: existing, error: existingError } = await latestPolicyCopy(admin, normalizedPolicyId);
  if (existingError) return { ok: false, error: "Could not verify the current policy copy. Please try again." };
  if (!existing) return { ok: true, document: null };

  const { error: deleteError } = await admin
    .from("policy_documents")
    .delete()
    .eq("id", existing.id)
    .eq("policy_id", normalizedPolicyId)
    .eq("document_type", "policy_copy");
  if (deleteError) return { ok: false, error: "Policy copy could not be removed. Please try again." };

  if (existing.storage_path) {
    await admin.storage
      .from(existing.storage_bucket || POLICY_DOCUMENT_BUCKET)
      .remove([existing.storage_path]);
  }

  await recordPolicyActivity(
    admin,
    normalizedPolicyId,
    profile.id,
    POLICY_ACTIVITY_ACTIONS.POLICY_DOC_REMOVED,
  );
  revalidatePath("/policies");
  revalidatePath(`/policies/${normalizedPolicyId}/edit`);
  return { ok: true, document: null };
}
