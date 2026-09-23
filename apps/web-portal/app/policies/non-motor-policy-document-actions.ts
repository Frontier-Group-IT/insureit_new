"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyCreator, requirePolicyEditor } from "@/lib/policy-access-server";
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

export type NonMotorDocumentDeleteResult =
  | { ok: true }
  | { ok: false; error: string };

type ExistingDocumentRow = {
  id: string;
  storage_bucket: string;
  storage_path: string;
};

function safeFileName(name: string) {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned || "document";
}

async function requireNonMotorPolicy(admin: ReturnType<typeof createSupabaseAdminClient>, policyId: string) {
  const { data: policy, error } = await admin
    .from("policies")
    .select("id,business_line")
    .eq("id", policyId)
    .maybeSingle<{ id: string; business_line: string | null }>();

  if (error || !policy) return { ok: false as const, error: "The saved policy could not be found for document upload." };
  if (policy.business_line !== "Non Motor") return { ok: false as const, error: "This document action is available only for Non-Motor policies." };
  return { ok: true as const, policy };
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

  const policyResult = await requireNonMotorPolicy(admin, policyId);
  if (!policyResult.ok) return policyResult;

  const { data: existingRows, error: existingError } = await admin
    .from("policy_documents")
    .select("id,storage_bucket,storage_path")
    .eq("policy_id", policyId)
    .eq("document_type", documentType)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<ExistingDocumentRow[]>();

  if (existingError) return { ok: false, error: "The existing policy document could not be checked." };

  const fileName = safeFileName(fileValue.name);
  const storagePath = `${policyId}/${documentType}/${crypto.randomUUID()}-${fileName}`;
  const bytes = Buffer.from(await fileValue.arrayBuffer());
  const { error: storageError } = await admin.storage
    .from(POLICY_DOCUMENT_BUCKET)
    .upload(storagePath, bytes, { contentType: fileValue.type, upsert: false });

  if (storageError) return { ok: false, error: "The policy was saved, but the selected document could not be uploaded." };

  const canonical = existingRows?.[0] ?? null;
  let documentId: string;

  if (canonical) {
    const { error: updateError } = await admin
      .from("policy_documents")
      .update({
        file_name: fileValue.name,
        storage_bucket: POLICY_DOCUMENT_BUCKET,
        storage_path: storagePath,
        mime_type: fileValue.type,
        file_size: fileValue.size,
        uploaded_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", canonical.id)
      .eq("policy_id", policyId)
      .eq("document_type", documentType);

    if (updateError) {
      await admin.storage.from(POLICY_DOCUMENT_BUCKET).remove([storagePath]);
      return { ok: false, error: "The new document was uploaded, but the saved document record could not be replaced." };
    }
    documentId = canonical.id;

    const duplicateIds = (existingRows ?? []).slice(1).map((row) => row.id);
    if (duplicateIds.length) {
      const { error: duplicateDeleteError } = await admin
        .from("policy_documents")
        .delete()
        .in("id", duplicateIds)
        .eq("policy_id", policyId)
        .eq("document_type", documentType);
      if (duplicateDeleteError) {
        return { ok: false, error: "The document was replaced, but older duplicate records could not be cleaned up." };
      }
    }

    const oldStoragePaths = (existingRows ?? [])
      .filter((row) => row.storage_bucket === POLICY_DOCUMENT_BUCKET && row.storage_path && row.storage_path !== storagePath)
      .map((row) => row.storage_path);
    if (oldStoragePaths.length) {
      await admin.storage.from(POLICY_DOCUMENT_BUCKET).remove(oldStoragePaths);
    }
  } else {
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
    documentId = documentRow.id;
  }

  revalidatePath("/policies");
  revalidatePath(`/policies/${policyId}`);
  revalidatePath(`/policies/${policyId}/edit`);
  return { ok: true, documentId };
}

export async function deleteNonMotorPolicyDocument(
  policyId: string,
  documentType: string,
): Promise<NonMotorDocumentDeleteResult> {
  await requirePolicyEditor();
  const admin = createSupabaseAdminClient();

  if (!policyId) return { ok: false, error: "The policy reference is missing for this document." };
  if (!DOCUMENT_TYPES.has(documentType)) return { ok: false, error: "Unsupported policy document type." };

  const policyResult = await requireNonMotorPolicy(admin, policyId);
  if (!policyResult.ok) return { ok: false, error: policyResult.error };

  const { data: rows, error: loadError } = await admin
    .from("policy_documents")
    .select("id,storage_bucket,storage_path")
    .eq("policy_id", policyId)
    .eq("document_type", documentType)
    .returns<ExistingDocumentRow[]>();

  if (loadError) return { ok: false, error: "The policy document could not be loaded." };
  if (!rows?.length) return { ok: true };

  const { error: deleteError } = await admin
    .from("policy_documents")
    .delete()
    .in("id", rows.map((row) => row.id))
    .eq("policy_id", policyId)
    .eq("document_type", documentType);

  if (deleteError) return { ok: false, error: "The policy document could not be deleted." };

  const storagePaths = rows
    .filter((row) => row.storage_bucket === POLICY_DOCUMENT_BUCKET && row.storage_path)
    .map((row) => row.storage_path);
  if (storagePaths.length) {
    await admin.storage.from(POLICY_DOCUMENT_BUCKET).remove(storagePaths);
  }

  revalidatePath("/policies");
  revalidatePath(`/policies/${policyId}`);
  revalidatePath(`/policies/${policyId}/edit`);
  return { ok: true };
}
