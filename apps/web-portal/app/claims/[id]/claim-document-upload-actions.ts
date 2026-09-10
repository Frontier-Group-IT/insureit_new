"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canAccessCustomer } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { ClaimStatus } from "@/lib/claim-workflow";

const bucketName = "claim-documents";
const maxDocumentSizeBytes = 5 * 1024 * 1024;
const maxVideoSizeBytes = 50 * 1024 * 1024;
const maxSpotPhotoSizeBytes = 20 * 1024 * 1024;

type ClaimForUpload = {
  id: string;
  customer_id: string;
  current_status: ClaimStatus;
  accident_at: string | null;
  claim_service_mode: "broker_managed" | "self_managed";
};

type ExistingClaimDocument = {
  id: string;
  customer_id: string;
  document_type: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  verification_status: string;
  rejection_reason: string | null;
  verified_by: string | null;
  verified_at: string | null;
};

export type ClaimUploadFileMetadata = {
  name: string;
  size: number;
  type: string;
};

export type ClaimSignedUpload = {
  path: string;
  token: string;
  fileName: string;
  documentType: string;
  contentType: string;
};

type FinalizeUpload = Pick<ClaimSignedUpload, "path" | "fileName" | "documentType">;
type ActionResult = { ok: boolean; message?: string };
type PrepareResult = ActionResult & { uploads?: ClaimSignedUpload[] };
type VerificationType = "rc" | "insurance" | "document";

async function currentProfile() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !(await hasEffectiveCapability(profile, "manage_claims", "edit"))) {
    throw new Error("You do not have permission to upload claim documents.");
  }
  return profile;
}

async function loadClaimForUpload(
  claimId: string,
  profile: NonNullable<Awaited<ReturnType<typeof currentProfile>>>
) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("claims")
    .select("id, customer_id, current_status, accident_at, claim_service_mode")
    .eq("id", claimId)
    .maybeSingle<ClaimForUpload>();

  if (error || !data) throw new Error(error?.message ?? "Claim not found.");
  if (!(await canAccessCustomer(profile.id, profile.role, data.customer_id, "manage_claims"))) {
    throw new Error("You do not have permission to upload claim documents.");
  }
  if (data.claim_service_mode !== "broker_managed") {
    throw new Error("Operations can process this claim only after assistance is accepted.");
  }
  return data;
}

async function loadExistingClaimDocument(claim: ClaimForUpload, documentId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("claim_documents")
    .select("id, customer_id, document_type, file_name, storage_bucket, storage_path, verification_status, rejection_reason, verified_by, verified_at")
    .eq("id", documentId)
    .eq("claim_id", claim.id)
    .eq("customer_id", claim.customer_id)
    .maybeSingle<ExistingClaimDocument>();
  if (error || !data) throw new Error(error?.message ?? "Document not found.");
  return data;
}

function safeFileName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "upload";
}

function isVideoMetadata(file: ClaimUploadFileMetadata) {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name);
}

function validateSpotFile(file: ClaimUploadFileMetadata) {
  if (!file.name.trim() || !Number.isFinite(file.size) || file.size <= 0) {
    throw new Error("Invalid spot photo/video upload.");
  }

  const allowedTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-matroska",
    "video/x-msvideo"
  ]);
  const extensionAllowed = /\.(jpg|jpeg|png|webp|heic|mp4|mov|webm|mkv|avi)$/i.test(file.name);
  if (file.type && !allowedTypes.has(file.type) && !extensionAllowed) {
    throw new Error(`${file.name} is not a supported photo/video format.`);
  }

  const isVideo = isVideoMetadata(file);
  const maxFileSize = isVideo ? maxVideoSizeBytes : maxSpotPhotoSizeBytes;
  if (file.size > maxFileSize) {
    throw new Error(`${file.name} exceeds the ${isVideo ? "50MB video" : "20MB photo"} per-file limit.`);
  }
}

function validateSingleDocumentFile(documentType: string, file: ClaimUploadFileMetadata) {
  if (!documentType.trim() || !file.name.trim() || !Number.isFinite(file.size) || file.size <= 0) {
    throw new Error("Missing replacement document details.");
  }

  const expectedVideo = documentType.toLowerCase().includes("video");
  const actualVideo = isVideoMetadata(file);
  if (expectedVideo !== actualVideo) {
    throw new Error(expectedVideo ? "Please upload a supported video file." : "Video files are not allowed for this document type.");
  }

  const maxSize = expectedVideo ? maxVideoSizeBytes : maxDocumentSizeBytes;
  if (file.size > maxSize) {
    throw new Error(`The selected file exceeds the ${expectedVideo ? "50 MB" : "5 MB"} limit.`);
  }

  const allowedTypes = expectedVideo
    ? ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/x-msvideo"]
    : ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  const extensionAllowed = expectedVideo
    ? /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)
    : /\.(jpg|jpeg|png|webp|pdf)$/i.test(file.name);
  if (file.type && !allowedTypes.includes(file.type) && !extensionAllowed) {
    throw new Error("Unsupported document format.");
  }
}

function assertCanonicalUploadPath(claim: ClaimForUpload, path: string, spot: boolean) {
  const normalPrefix = `${claim.customer_id}/${claim.id}/`;
  const expectedPrefix = spot ? `${normalPrefix}spot/` : normalPrefix;
  if (!path.startsWith(expectedPrefix) || path.includes("..")) {
    throw new Error("Invalid claim document upload path.");
  }
  if (!spot && path.startsWith(`${normalPrefix}spot/`)) {
    throw new Error("Invalid claim document upload path.");
  }
}

function verificationTypeForDocument(documentType: string): VerificationType {
  const normalized = documentType.toLowerCase();
  if (normalized.includes("registration") || normalized.includes("rc")) return "rc";
  if (normalized.includes("policy") || normalized.includes("insurance")) return "insurance";
  return "document";
}

function incidentDateOnly(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

async function createSignedUpload(
  path: string,
  fileName: string,
  documentType: string,
  contentType: string
): Promise<ClaimSignedUpload> {
  const storageAdmin = createSupabaseAdminClient();
  const { data, error } = await storageAdmin.storage
    .from(bucketName)
    .createSignedUploadUrl(path, { upsert: false });
  if (error || !data?.token) throw new Error(error?.message ?? "Could not prepare document upload.");
  return { path, token: data.token, fileName, documentType, contentType };
}

async function cleanupPaths(paths: string[]) {
  if (!paths.length) return;
  const storageAdmin = createSupabaseAdminClient();
  await storageAdmin.storage.from(bucketName).remove(paths);
}

export async function prepareSpotSurveyMediaUpload(
  claimId: string,
  files: ClaimUploadFileMetadata[]
): Promise<PrepareResult> {
  try {
    if (!claimId.trim() || !files.length) throw new Error("Please select at least one spot photo or video.");
    files.forEach(validateSpotFile);

    const profile = await currentProfile();
    const claim = await loadClaimForUpload(claimId, profile);
    const batchId = `${Date.now()}-${randomUUID()}`;
    const uploads: ClaimSignedUpload[] = [];

    for (const [index, file] of files.entries()) {
      const fileName = safeFileName(file.name);
      const documentType = isVideoMetadata(file) ? "Accident Video" : "Accident Photo";
      const path = `${claim.customer_id}/${claim.id}/spot/${batchId}-${index}-${fileName}`;
      uploads.push(await createSignedUpload(path, fileName, documentType, file.type));
    }

    return { ok: true, uploads };
  } catch (error) {
    console.error("prepareSpotSurveyMediaUpload failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Could not prepare spot media upload." };
  }
}

export async function finalizeSpotSurveyMediaUpload(
  claimId: string,
  uploads: FinalizeUpload[]
): Promise<ActionResult> {
  try {
    if (!claimId.trim() || !uploads.length) throw new Error("Missing uploaded spot media details.");
    const profile = await currentProfile();
    const claim = await loadClaimForUpload(claimId, profile);
    const supabase = await createServerSupabaseClient();

    const rows = uploads.map((upload) => {
      assertCanonicalUploadPath(claim, upload.path, true);
      if (upload.documentType !== "Accident Photo" && upload.documentType !== "Accident Video") {
        throw new Error("Invalid spot media document type.");
      }
      return {
        claim_id: claim.id,
        customer_id: claim.customer_id,
        document_type: upload.documentType,
        file_name: safeFileName(upload.fileName),
        storage_bucket: bucketName,
        storage_path: upload.path,
        verification_status: "pending" as const
      };
    });

    const { error: insertError } = await supabase.from("claim_documents").insert(rows);
    if (insertError) {
      await cleanupPaths(uploads.map((upload) => upload.path));
      throw new Error(insertError.message);
    }

    await supabase.from("claim_status_history").insert({
      claim_id: claim.id,
      from_status: claim.current_status,
      to_status: claim.current_status,
      notes: `${uploads.length} spot photo/video file${uploads.length === 1 ? "" : "s"} uploaded by claim manager.`,
      changed_by: profile.id
    });

    revalidatePath(`/claims/${claim.id}`);
    revalidatePath("/claims");
    revalidatePath("/dashboard");
    return { ok: true, message: `${uploads.length} spot photo/video file${uploads.length === 1 ? "" : "s"} uploaded successfully.` };
  } catch (error) {
    console.error("finalizeSpotSurveyMediaUpload failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Spot media upload failed." };
  }
}

export async function prepareClaimDocumentUpload(
  claimId: string,
  documentType: string,
  file: ClaimUploadFileMetadata,
  documentId?: string
): Promise<PrepareResult> {
  try {
    if (!claimId.trim()) throw new Error("Missing claim id.");
    const profile = await currentProfile();
    const claim = await loadClaimForUpload(claimId, profile);
    const existingDocument = documentId ? await loadExistingClaimDocument(claim, documentId) : null;
    const persistedDocumentType = existingDocument?.document_type ?? documentType;
    validateSingleDocumentFile(persistedDocumentType, file);

    const fileName = safeFileName(file.name);
    const path = `${claim.customer_id}/${claim.id}/${Date.now()}-${randomUUID()}-${fileName}`;
    const upload = await createSignedUpload(path, fileName, persistedDocumentType, file.type);
    return { ok: true, uploads: [upload] };
  } catch (error) {
    console.error("prepareClaimDocumentUpload failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Could not prepare document upload." };
  }
}

export async function finalizeClaimDocumentUpload(
  claimId: string,
  documentType: string,
  upload: FinalizeUpload,
  documentId?: string
): Promise<ActionResult> {
  try {
    if (!claimId.trim() || !documentType.trim()) throw new Error("Missing claim document details.");
    const profile = await currentProfile();
    const claim = await loadClaimForUpload(claimId, profile);
    assertCanonicalUploadPath(claim, upload.path, false);

    if (!documentId) {
      if (upload.documentType !== documentType) throw new Error("Invalid claim document upload type.");
      const supabase = await createServerSupabaseClient();
      const { error: insertError } = await supabase.from("claim_documents").insert({
        claim_id: claim.id,
        customer_id: claim.customer_id,
        document_type: documentType,
        file_name: safeFileName(upload.fileName),
        storage_bucket: bucketName,
        storage_path: upload.path,
        verification_status: "pending"
      });
      if (insertError) {
        await cleanupPaths([upload.path]);
        throw new Error(insertError.message);
      }

      revalidatePath(`/claims/${claim.id}`);
      revalidatePath("/claims");
      revalidatePath("/dashboard");
      return { ok: true, message: "Document uploaded successfully." };
    }

    const existingDocument = await loadExistingClaimDocument(claim, documentId);
    if (upload.documentType !== existingDocument.document_type) throw new Error("Invalid replacement document type.");

    const admin = createSupabaseAdminClient();
    const replacedAt = new Date().toISOString();
    const replacementPayload = {
      file_name: safeFileName(upload.fileName),
      storage_bucket: bucketName,
      storage_path: upload.path,
      verification_status: "pending" as const,
      rejection_reason: null,
      verified_by: null,
      verified_at: null
    };
    const { data: updatedDocument, error: updateError } = await admin
      .from("claim_documents")
      .update(replacementPayload)
      .eq("id", documentId)
      .eq("claim_id", claim.id)
      .eq("customer_id", claim.customer_id)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (updateError || !updatedDocument) {
      await cleanupPaths([upload.path]);
      throw new Error(updateError?.message ?? "Document replacement could not be saved.");
    }

    const invalidReason = "Document replaced; re-verification required.";
    const { error: verificationError } = await admin.from("claim_document_verifications").insert({
      claim_id: claim.id,
      document_id: existingDocument.id,
      document_type: existingDocument.document_type,
      verification_type: verificationTypeForDocument(existingDocument.document_type),
      incident_date: incidentDateOnly(claim.accident_at),
      is_valid: false,
      invalid_reason: invalidReason,
      details: {
        verification_type: "document_replacement",
        document_type: existingDocument.document_type,
        document_id: existingDocument.id,
        replacement_requires_reverification: true,
        replaced_at: replacedAt
      },
      verified_by: profile.id
    });

    if (verificationError) {
      const { error: rollbackError } = await admin
        .from("claim_documents")
        .update({
          file_name: existingDocument.file_name,
          storage_bucket: existingDocument.storage_bucket,
          storage_path: existingDocument.storage_path,
          verification_status: existingDocument.verification_status,
          rejection_reason: existingDocument.rejection_reason,
          verified_by: existingDocument.verified_by,
          verified_at: existingDocument.verified_at
        })
        .eq("id", documentId)
        .eq("claim_id", claim.id)
        .eq("customer_id", claim.customer_id);

      if (!rollbackError) await cleanupPaths([upload.path]);
      throw new Error(rollbackError
        ? "Replacement could not be completed safely. Refresh the claim before continuing."
        : verificationError.message);
    }

    const { error: historyError } = await admin.from("claim_status_history").insert({
      claim_id: claim.id,
      from_status: claim.current_status,
      to_status: claim.current_status,
      notes: `${existingDocument.document_type} replaced by claim manager; re-verification required.`,
      changed_by: profile.id
    });
    if (historyError) console.error("Claim document replacement history write failed.");

    if (existingDocument.storage_path && existingDocument.storage_path !== upload.path) {
      const oldBucket = existingDocument.storage_bucket || bucketName;
      const { error: cleanupError } = await admin.storage.from(oldBucket).remove([existingDocument.storage_path]);
      if (cleanupError) console.error("Previous claim document cleanup failed after successful replacement.");
    }

    revalidatePath(`/claims/${claim.id}`);
    revalidatePath("/claims");
    revalidatePath("/dashboard");
    return { ok: true, message: "Document replaced. Re-verification required." };
  } catch (error) {
    console.error("finalizeClaimDocumentUpload failed", error instanceof Error ? error.message : "Unknown document upload error");
    return { ok: false, message: error instanceof Error ? error.message : "Document upload failed." };
  }
}

export async function cancelClaimDocumentUploads(claimId: string, paths: string[]): Promise<ActionResult> {
  try {
    if (!claimId.trim() || !paths.length) return { ok: true };
    const profile = await currentProfile();
    const claim = await loadClaimForUpload(claimId, profile);
    for (const path of paths) {
      const normalPrefix = `${claim.customer_id}/${claim.id}/`;
      if (!path.startsWith(normalPrefix) || path.includes("..")) {
        throw new Error("Invalid claim document upload path.");
      }
    }
    await cleanupPaths(paths);
    return { ok: true };
  } catch (error) {
    console.error("cancelClaimDocumentUploads failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Could not clean up incomplete upload." };
  }
}
