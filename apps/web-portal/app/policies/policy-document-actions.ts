"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const POLICY_DOCUMENT_BUCKET = "policy-documents";
const MAX_POLICY_COPY_BYTES = 50 * 1024 * 1024;
const ALLOWED_POLICY_COPY_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type PolicyCopyUploadResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string };

function safeFileName(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned || "policy-copy";
}

export async function uploadPolicyCopy(
  policyCode: string,
  formData: FormData,
): Promise<PolicyCopyUploadResult> {
  const profile = await requirePolicyEditor();
  const normalizedPolicyCode = policyCode.trim();
  const file = formData.get("file");

  if (!normalizedPolicyCode) return { ok: false, error: "Policy reference is missing." };
  if (!(file instanceof File) || file.size <= 0) return { ok: false, error: "Select a policy copy to upload." };
  if (file.size > MAX_POLICY_COPY_BYTES) return { ok: false, error: "Policy copy must be 50 MB or smaller." };
  if (!ALLOWED_POLICY_COPY_TYPES.has(file.type)) {
    return { ok: false, error: "Upload a PDF, JPG, PNG or WEBP policy copy." };
  }

  const admin = createSupabaseAdminClient();
  const { data: policy, error: policyError } = await admin
    .from("policies")
    .select("id")
    .eq("policy_code", normalizedPolicyCode)
    .maybeSingle<{ id: string }>();

  if (policyError) return { ok: false, error: "Could not verify the saved policy. Please try again." };
  if (!policy?.id) return { ok: false, error: "The saved policy could not be found." };

  const storagePath = `${policy.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await admin.storage
    .from(POLICY_DOCUMENT_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) return { ok: false, error: `Policy was saved, but the policy copy could not be uploaded: ${uploadError.message}` };

  const { data: documentRow, error: insertError } = await admin
    .from("policy_documents")
    .insert({
      policy_id: policy.id,
      document_type: "policy_copy",
      file_name: file.name,
      storage_bucket: POLICY_DOCUMENT_BUCKET,
      storage_path: storagePath,
      mime_type: file.type,
      file_size: file.size,
      uploaded_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !documentRow?.id) {
    await admin.storage.from(POLICY_DOCUMENT_BUCKET).remove([storagePath]);
    return { ok: false, error: "Policy was saved, but its policy-copy record could not be created. Please try the upload again." };
  }

  revalidatePath("/policies");
  revalidatePath(`/policies/${policy.id}`);
  return { ok: true, documentId: documentRow.id };
}
