"use server";

import { extractPolicyDocument, type PolicyOcrResult } from "@/app/policies/policy-ocr-actions";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const POLICY_DOCUMENT_BUCKET = "policy-documents";

function safeFileName(value: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned.slice(0, 140) || "policy-copy";
}

export async function extractAndStagePolicyDocument(formData: FormData): Promise<PolicyOcrResult> {
  const profile = await requirePolicyEditor();
  const file = formData.get("policy_document");
  const result = await extractPolicyDocument(formData);
  if (!result.ok || !(file instanceof File) || file.size === 0) return result;

  const policyNumber = result.fields.find((field) => field.key === "policy_number")?.value?.trim() || null;
  const admin = createSupabaseAdminClient();
  const storagePath = `ocr-staging/${profile.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from(POLICY_DOCUMENT_BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message);

    const { error: stagingError } = await admin.from("policy_ocr_document_staging").insert({
      uploaded_by: profile.id,
      extracted_policy_no: policyNumber,
      file_name: file.name,
      storage_bucket: POLICY_DOCUMENT_BUCKET,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size: file.size,
    });

    if (stagingError) {
      await admin.storage.from(POLICY_DOCUMENT_BUCKET).remove([storagePath]);
      throw new Error(stagingError.message);
    }

    return {
      ...result,
      warnings: [
        ...result.warnings,
        "This policy copy has been saved and will be reused automatically in Documents when the policy is created.",
      ],
    };
  } catch (error) {
    console.error("policy_ocr_copy_staging_failed", error instanceof Error ? error.message : "unknown_error");
    return {
      ...result,
      warnings: [
        ...result.warnings,
        "Policy details were read successfully, but this copy could not be saved for document reuse. Upload the policy copy in Documents after saving the policy.",
      ],
    };
  }
}
