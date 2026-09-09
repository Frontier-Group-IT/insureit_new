"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingOperator, requirePolicyOcrTrainingViewer } from "@/lib/policy-ocr-training-access";
import { processPolicyOcrTrainingDocument } from "./policy-ocr-actions";

const TRAINING_COPY_URL_TTL_SECONDS = 5 * 60;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function openPolicyOcrTrainingCopy(documentId: string) {
  const viewer = await requirePolicyOcrTrainingViewer();
  const normalizedDocumentId = documentId.trim();
  if (!normalizedDocumentId) return { ok: false as const, error: "Policy document reference is missing." };

  const admin = createSupabaseAdminClient();
  if (!viewer.isOperator) {
    const { data: label, error: labelError } = await admin
      .from("policy_ocr_training_labels")
      .select("id")
      .eq("policy_document_id", normalizedDocumentId)
      .maybeSingle<{ id: string }>();
    const { data: assignedTask, error: taskError } = await admin
      .from("policy_ocr_training_review_tasks")
      .select("id")
      .eq("assigned_reviewer_profile_id", viewer.profile.id)
      .eq("training_label_id", label?.id ?? "")
      .neq("status", "cancelled")
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (labelError || taskError || !assignedTask) return { ok: false as const, error: "This policy copy is not assigned to your portal user." };
  }
  const { data: document, error } = await admin.from("policy_documents").select("storage_bucket,storage_path").eq("id", normalizedDocumentId).eq("document_type", "policy_copy").maybeSingle<{ storage_bucket: string; storage_path: string }>();
  if (error || !document) return { ok: false as const, error: "The private policy copy is unavailable." };

  const { data: signed, error: signedError } = await admin.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, TRAINING_COPY_URL_TTL_SECONDS);
  if (signedError || !signed?.signedUrl) return { ok: false as const, error: "The private policy copy could not be opened." };
  return { ok: true as const, url: signed.signedUrl };
}

export type RunPolicyOcrTrainingState = { status: "idle" | "success" | "error"; message: string | null; refreshKey: number | null };

export async function runPolicyOcrTrainingLabel(_previousState: RunPolicyOcrTrainingState, formData: FormData): Promise<RunPolicyOcrTrainingState> {
  await requirePolicyOcrTrainingOperator();
  const labelId = text(formData, "training_label_id");
  if (!labelId) return { status: "error", message: "Training label reference is missing.", refreshKey: null };

  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin.from("policy_ocr_training_labels").select("id,processing_status").eq("id", labelId).maybeSingle<{ id: string; processing_status: string }>();
  if (currentError || !current) return { status: "error", message: "The OCR comparison record could not be loaded.", refreshKey: null };
  if (current.processing_status === "processing") return { status: "error", message: "This policy copy is already being read.", refreshKey: null };
  const result = await processPolicyOcrTrainingDocument(labelId);
  if (!result.ok) {
    const configurationError = result.error === "google_ocr_configuration_missing" || result.error === "google_oidc_subject_token_missing";
    return { status: "error", message: configurationError ? "Google OCR is not configured for manual runs. Contact the administrator." : "The selected policy copy could not be started. Refresh and try again.", refreshKey: null };
  }
  revalidatePath("/policies/ocr-training");
  return result.succeeded === 1
    ? { status: "success", message: "Google OCR completed. Review the comparison below.", refreshKey: Date.now() }
    : { status: "error", message: "Google OCR ran, but this copy did not produce a proposal. Review the row failure and retry if appropriate.", refreshKey: null };
}
