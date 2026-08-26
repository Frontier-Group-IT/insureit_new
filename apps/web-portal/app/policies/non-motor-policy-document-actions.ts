"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const POLICY_DOCUMENT_BUCKET = "policy-documents";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const DOCUMENT_TYPES = new Set(["policy_copy", "proposal_form", "kyc", "other_document"]);

export type NonMotorDocumentUploadResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string };

function safeFileName(name: string) {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned || "document";
}

export async function uploadNonMotorPolicyDocument(formData: FormData): Promise<NonMotorDocumentUploadResult> {
  const profile = await requirePolicyCreator();
  const admin = createSupabaseAdminClient();
  const policyId = String(formData.get("policyId") ?? "").trim();
  const documentType = String(formData.get("documentType") ?? "").trim();
  const fileValue = formData.get("file");

  if (!policyId) return { ok: false, error: "The policy reference is missing for this document." };
  if (!DOCUMENT_TYPES.has(documentType)) return { ok: false, error: "Unsupported policy document type." };
  if (!(fileValue instanceof File) || fileValue.size <= 0) return { ok: false, error: "Choose a document to upload." };
  if (fileValue.size > MAX_FILE_SIZE) return { ok: false, error: "Each policy document must be 50 MB or smaller." };
  if (!ALLOWED_MIME_TYPES.has(fileValue.type)) return { ok: false, error: "Upload a PDF, JPG, PNG or WebP document." };

  const { data: policy, error: policyError } = await admin
    .from("policies")
    .select("id")
    .eq("id", policyId)
    .maybeSingle<{ id: string }>();
  if (policyError || !policy) return { ok: false, error: "The saved policy could not be found for document upload." };

  const fileName = safeFileName(fileValue.name);
  const storagePath = `${policyId}/${documentType}/${crypto.randomUUID()}-${fileName}`;
  const bytes = Buffer.from(await fileValue.arrayBuffer());
  const { error: storageError } = await admin.storage
    .from(POLICY_DOCUMENT_BUCKET)
    .upload(storagePath, bytes, { contentType: fileValue.type, upsert: false });
  if (storageError) return { ok: false, error: "The policy was saved, but a selected document could not be uploaded." };

  const { data: documentRow, error: documentError } = await admin
    .from("policy_documents")
    .insert({
      policy_id: policyId,
      document_type: documentType,
      file_name: fileValue.name,
      storage_bucket: POLICY_DOCUMENT_BUCKET,
      storage_path: storagePath,
      mime_type: fileValue.type,
      file_size: fileValue.size,
      uploaded_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (documentError || !documentRow) {
    await admin.storage.from(POLICY_DOCUMENT_BUCKET).remove([storagePath]);
    return { ok: false, error: "The policy was saved, but the document record could not be completed." };
  }

  revalidatePath("/policies");
  revalidatePath(`/policies/${policyId}`);
  return { ok: true, documentId: documentRow.id };
}
