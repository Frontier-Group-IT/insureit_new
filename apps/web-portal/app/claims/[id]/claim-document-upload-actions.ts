"use server";

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
  claim_service_mode: "broker_managed" | "self_managed";
};

type ActionResult = { ok: boolean; message?: string };

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
    .select("id, customer_id, current_status, claim_service_mode")
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

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name);
}

export async function uploadSpotSurveyMedia(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = String(formData.get("claimId") ?? "").trim();
    const files = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
    if (!claimId || !files.length) throw new Error("Please select at least one spot photo or video.");

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

    for (const file of files) {
      const isVideo = isVideoFile(file);
      if (!allowedTypes.has(file.type) && !/\.(jpg|jpeg|png|webp|heic|mp4|mov|webm|mkv|avi)$/i.test(file.name)) {
        throw new Error(`${file.name} is not a supported photo/video format.`);
      }
      const maxFileSize = isVideo ? maxVideoSizeBytes : maxSpotPhotoSizeBytes;
      if (file.size > maxFileSize) {
        throw new Error(`${file.name} exceeds the ${isVideo ? "50MB video" : "20MB photo"} per-file limit.`);
      }
    }

    const profile = await currentProfile();
    const claim = await loadClaimForUpload(claimId, profile);
    const supabase = await createServerSupabaseClient();
    const storageAdmin = createSupabaseAdminClient();
    const uploadedPaths: string[] = [];
    const rows: Array<{
      claim_id: string;
      customer_id: string;
      document_type: string;
      file_name: string;
      storage_bucket: string;
      storage_path: string;
      verification_status: "pending";
    }> = [];

    try {
      for (const [index, file] of files.entries()) {
        const safeName = safeFileName(file.name);
        const storagePath = `${claim.customer_id}/${claim.id}/spot/${Date.now()}-${index}-${safeName}`;
        const { error: uploadError } = await storageAdmin.storage
          .from(bucketName)
          .upload(storagePath, file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw new Error(uploadError.message);

        uploadedPaths.push(storagePath);
        rows.push({
          claim_id: claim.id,
          customer_id: claim.customer_id,
          document_type: isVideoFile(file) ? "Accident Video" : "Accident Photo",
          file_name: safeName,
          storage_bucket: bucketName,
          storage_path: storagePath,
          verification_status: "pending"
        });
      }

      const { error: insertError } = await supabase.from("claim_documents").insert(rows);
      if (insertError) throw new Error(insertError.message);
    } catch (error) {
      if (uploadedPaths.length) await storageAdmin.storage.from(bucketName).remove(uploadedPaths);
      throw error;
    }

    await supabase.from("claim_status_history").insert({
      claim_id: claim.id,
      from_status: claim.current_status,
      to_status: claim.current_status,
      notes: `${files.length} spot photo/video file${files.length === 1 ? "" : "s"} uploaded by claim manager.`,
      changed_by: profile.id
    });

    revalidatePath(`/claims/${claim.id}`);
    revalidatePath("/claims");
    revalidatePath("/dashboard");
    return { ok: true, message: `${files.length} spot photo/video file${files.length === 1 ? "" : "s"} uploaded successfully.` };
  } catch (error) {
    console.error("uploadSpotSurveyMedia failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Spot media upload failed." };
  }
}

export async function replaceSpotSurveyDocument(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = String(formData.get("claimId") ?? "").trim();
    const documentType = String(formData.get("documentType") ?? "").trim();
    const file = formData.get("file");
    if (!claimId || !documentType || !(file instanceof File) || !file.size) {
      throw new Error("Missing replacement document details.");
    }

    const isVideo = documentType.toLowerCase().includes("video") || isVideoFile(file);
    const maxSize = isVideo ? maxVideoSizeBytes : maxDocumentSizeBytes;
    if (file.size > maxSize) throw new Error(`The selected file exceeds the ${isVideo ? "50 MB" : "5 MB"} limit.`);

    const allowedTypes = isVideo
      ? ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/x-msvideo"]
      : ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    const extensionAllowed = isVideo
      ? /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)
      : /\.(jpg|jpeg|png|webp|pdf)$/i.test(file.name);
    if (file.type && !allowedTypes.includes(file.type) && !extensionAllowed) throw new Error("Unsupported document format.");

    const profile = await currentProfile();
    const claim = await loadClaimForUpload(claimId, profile);
    const supabase = await createServerSupabaseClient();
    const storageAdmin = createSupabaseAdminClient();
    const safeName = safeFileName(file.name);
    const storagePath = `${claim.customer_id}/${claim.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await storageAdmin.storage
      .from(bucketName)
      .upload(storagePath, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { error: insertError } = await supabase.from("claim_documents").insert({
      claim_id: claim.id,
      customer_id: claim.customer_id,
      document_type: documentType,
      file_name: safeName,
      storage_bucket: bucketName,
      storage_path: storagePath,
      verification_status: "pending"
    });
    if (insertError) {
      await storageAdmin.storage.from(bucketName).remove([storagePath]);
      throw new Error(insertError.message);
    }

    await supabase.from("claim_status_history").insert({
      claim_id: claim.id,
      from_status: null,
      to_status: null,
      notes: `${documentType} replaced by claim manager.`,
      changed_by: profile.id
    });

    revalidatePath(`/claims/${claim.id}`);
    revalidatePath("/claims");
    revalidatePath("/dashboard");
    return { ok: true, message: "Document replaced successfully." };
  } catch (error) {
    console.error("replaceSpotSurveyDocument failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Document replacement failed." };
  }
}
