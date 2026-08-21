"use server";

import { revalidatePath } from "next/cache";
import { createSanitizedTrainingCandidate, type TrainingProposal } from "@/lib/policy-ocr-training";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingOperator } from "@/lib/policy-ocr-training-access";
import { loadPolicyOcrTrainingReference } from "@/lib/policy-ocr-training-reference";
import { processPolicyOcrTrainingDocument } from "./policy-ocr-actions";

const TRAINING_COPY_URL_TTL_SECONDS = 5 * 60;

type TrainingLabelForApproval = { id: string; processing_status: string; parser_id: string | null; parser_version: string | null; proposal: TrainingProposal | null };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function requireTrainingViewer() {
  return requirePolicyOcrTrainingOperator();
}

export async function openPolicyOcrTrainingCopy(documentId: string) {
  await requireTrainingViewer();
  const normalizedDocumentId = documentId.trim();
  if (!normalizedDocumentId) return { ok: false as const, error: "Policy document reference is missing." };

  const admin = createSupabaseAdminClient();
  const { data: document, error } = await admin.from("policy_documents").select("storage_bucket,storage_path").eq("id", normalizedDocumentId).eq("document_type", "policy_copy").maybeSingle<{ storage_bucket: string; storage_path: string }>();
  if (error || !document) return { ok: false as const, error: "The private policy copy is unavailable." };

  const { data: signed, error: signedError } = await admin.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, TRAINING_COPY_URL_TTL_SECONDS);
  if (signedError || !signed?.signedUrl) return { ok: false as const, error: "The private policy copy could not be opened." };
  return { ok: true as const, url: signed.signedUrl };
}

async function confirmPolicyOcrDatabaseComparison(formData: FormData) {
  const operator = await requirePolicyOcrTrainingOperator();
  const documentId = text(formData, "policy_document_id");
  if (!documentId) throw new Error("Policy document reference is missing.");

  const admin = createSupabaseAdminClient();
  const { data: document, error: documentError } = await admin.from("policy_documents").select("policy_id").eq("id", documentId).eq("document_type", "policy_copy").maybeSingle<{ policy_id: string }>();
  if (documentError || !document) throw new Error("The policy database reference could not be loaded.");

  const reference = await loadPolicyOcrTrainingReference(document.policy_id);
  if (!reference) throw new Error("The Section 02 and Section 03 database values could not be loaded.");

  const { data: label, error: labelError } = await admin.from("policy_ocr_training_labels").select("id,processing_status,parser_id,parser_version,proposal").eq("policy_document_id", documentId).maybeSingle<TrainingLabelForApproval>();
  if (labelError || !label) throw new Error("The OCR comparison record could not be loaded.");
  if (label.processing_status !== "ready") throw new Error("Wait for the Google OCR proposal before confirming the comparison.");

  assertFinancialReconciliation(reference);

  const candidate = createSanitizedTrainingCandidate({ labelId: label.id, parserId: label.parser_id, parserVersion: label.parser_version, values: reference, proposal: label.proposal });
  const { error: approvalError } = await admin.rpc("approve_policy_ocr_database_comparison", { p_label_id: label.id, p_actor_id: operator.id, p_reference: reference, p_candidate_payload: candidate });
  if (approvalError) {
    throw new Error("Could not confirm and approve the sanitized training candidate.");
  }

  revalidatePath("/policies/ocr-training");
}

export type ConfirmPolicyOcrTrainingState = { status: "idle" | "success" | "error"; message: string | null };

export async function submitPolicyOcrDatabaseComparison(_previousState: ConfirmPolicyOcrTrainingState, formData: FormData): Promise<ConfirmPolicyOcrTrainingState> {
  try {
    await confirmPolicyOcrDatabaseComparison(formData);
    return { status: "success", message: "Comparison confirmed and sanitized training candidate approved." };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not approve this training candidate." };
  }
}

export type RunPolicyOcrTrainingState = { status: "idle" | "success" | "error"; message: string | null };

export async function runPolicyOcrTrainingLabel(_previousState: RunPolicyOcrTrainingState, formData: FormData): Promise<RunPolicyOcrTrainingState> {
  await requirePolicyOcrTrainingOperator();
  const labelId = text(formData, "training_label_id");
  if (!labelId) return { status: "error", message: "Training label reference is missing." };

  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin.from("policy_ocr_training_labels").select("id,processing_status").eq("id", labelId).maybeSingle<{ id: string; processing_status: string }>();
  if (currentError || !current) return { status: "error", message: "The OCR comparison record could not be loaded." };
  if (current.processing_status === "processing") return { status: "error", message: "This policy copy is already being read." };
  const result = await processPolicyOcrTrainingDocument(labelId);
  if (!result.ok) {
    const configurationError = result.error === "google_ocr_configuration_missing" || result.error === "google_oidc_subject_token_missing";
    return { status: "error", message: configurationError ? "Google OCR is not configured for manual runs. Contact the administrator." : "The selected policy copy could not be started. Refresh and try again." };
  }
  revalidatePath("/policies/ocr-training");
  return result.succeeded === 1 ? { status: "success", message: "Google OCR completed. Review the comparison below." } : { status: "error", message: "Google OCR ran, but this copy did not produce a proposal. Review the row failure and retry if appropriate." };
}

function assertFinancialReconciliation(values: { od_premium: number | null; tp_premium: number | null; cpa_premium: number | null; printed_net_premium: number | null }) {
  if (values.od_premium === null || values.tp_premium === null || values.cpa_premium === null || values.printed_net_premium === null) return;

  const expected = values.od_premium + values.tp_premium + values.cpa_premium;
  if (Math.abs(expected - values.printed_net_premium) > 2) {
    throw new Error("OD + TP + CPA must reconcile to printed net premium before training approval.");
  }
}
