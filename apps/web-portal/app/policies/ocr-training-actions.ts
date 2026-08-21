"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import {
  createSanitizedTrainingCandidate,
  parseReviewerDate,
  sanitizeEvidenceNote,
  type TrainingProposal,
} from "@/lib/policy-ocr-training";
import { schedulePolicyOcrTraining } from "@/lib/policy-ocr-training-schedule";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const TRAINING_COPY_URL_TTL_SECONDS = 5 * 60;

type OptionalNumericField =
  | "idv"
  | "od_premium"
  | "tp_premium"
  | "cpa_premium"
  | "printed_net_premium"
  | "printed_gst"
  | "printed_gross_premium";

type TrainingLabelForApproval = {
  id: string;
  status: string;
  reviewed_by: string | null;
  parser_id: string | null;
  parser_version: string | null;
  proposal: TrainingProposal | null;
  insurer_name: string | null;
  policy_product: string | null;
  valid_from: string | null;
  valid_upto: string | null;
  idv: number | null;
  od_premium: number | null;
  tp_premium: number | null;
  cpa_opted: boolean | null;
  cpa_premium: number | null;
  printed_net_premium: number | null;
  printed_gst: number | null;
  printed_gross_premium: number | null;
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numeric(formData: FormData, key: OptionalNumericField) {
  const value = text(formData, key);
  if (value === null) return null;
  const parsed = Number(value.replaceAll(",", ""));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${key.replaceAll("_", " ")} must be a valid non-negative number.`);
  return parsed;
}

function reviewerDate(formData: FormData, key: "valid_from" | "valid_upto") {
  const value = text(formData, key);
  if (value === null) return null;
  const parsed = parseReviewerDate(value);
  if (!parsed) throw new Error(`${key === "valid_from" ? "Valid from" : "Valid upto"} must use DD/MM/YYYY.`);
  return parsed;
}

async function requireTrainingReviewer() {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile?.id || !(await hasEffectiveCapability(profile, "review_policy_ocr_training", "edit"))) {
    redirect("/access-denied");
  }
  return profile;
}

async function requireTrainingOwner() {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile?.id || !(await hasEffectiveCapability(profile, "approve_policy_ocr_training", "approve"))) {
    redirect("/access-denied");
  }
  return profile;
}

async function requireTrainingViewer() {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile?.id) redirect("/access-denied");
  const [canReview, canApprove] = await Promise.all([
    hasEffectiveCapability(profile, "review_policy_ocr_training", "edit"),
    hasEffectiveCapability(profile, "approve_policy_ocr_training", "approve"),
  ]);
  if (!canReview && !canApprove) redirect("/access-denied");
  return profile;
}

export async function openPolicyOcrTrainingCopy(documentId: string) {
  await requireTrainingViewer();
  const normalizedDocumentId = documentId.trim();
  if (!normalizedDocumentId) return { ok: false as const, error: "Policy document reference is missing." };

  const admin = createSupabaseAdminClient();
  const { data: document, error } = await admin
    .from("policy_documents")
    .select("storage_bucket,storage_path")
    .eq("id", normalizedDocumentId)
    .eq("document_type", "policy_copy")
    .maybeSingle<{ storage_bucket: string; storage_path: string }>();
  if (error || !document) return { ok: false as const, error: "The private policy copy is unavailable." };

  const { data: signed, error: signedError } = await admin.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, TRAINING_COPY_URL_TTL_SECONDS);
  if (signedError || !signed?.signedUrl) return { ok: false as const, error: "The private policy copy could not be opened." };
  return { ok: true as const, url: signed.signedUrl };
}

export async function savePolicyOcrTrainingReview(formData: FormData) {
  const reviewer = await requireTrainingReviewer();
  const documentId = text(formData, "policy_document_id");
  if (!documentId) throw new Error("Policy document reference is missing.");

  const decision = text(formData, "decision");
  if (decision !== "reviewed" && decision !== "rejected") throw new Error("Invalid reviewer decision.");

  const validFrom = reviewerDate(formData, "valid_from");
  const validUpto = reviewerDate(formData, "valid_upto");
  if (validFrom && validUpto && validFrom > validUpto) throw new Error("Valid upto must be on or after Valid from.");

  const values = {
    insurer_name: text(formData, "insurer_name"),
    policy_product: text(formData, "policy_product"),
    policy_number: text(formData, "policy_number"),
    valid_from: validFrom,
    valid_upto: validUpto,
    idv: numeric(formData, "idv"),
    od_premium: numeric(formData, "od_premium"),
    tp_premium: numeric(formData, "tp_premium"),
    cpa_opted: text(formData, "cpa_opted") === "yes",
    cpa_premium: numeric(formData, "cpa_premium"),
    printed_net_premium: numeric(formData, "printed_net_premium"),
    printed_gst: numeric(formData, "printed_gst"),
    printed_gross_premium: numeric(formData, "printed_gross_premium"),
  };
  const evidenceNote = sanitizeEvidenceNote(text(formData, "evidence_note"));

  if (decision === "reviewed" && !evidenceNote) {
    throw new Error("Add a bounded evidence note without raw OCR text or personal data.");
  }
  if (decision === "reviewed") assertFinancialReconciliation(values);

  const admin = createSupabaseAdminClient();
  const { data: label, error: labelError } = await admin
    .from("policy_ocr_training_labels")
    .select("id,processing_status")
    .eq("policy_document_id", documentId)
    .maybeSingle<{ id: string; processing_status: string }>();
  if (labelError || !label) throw new Error("The OCR proposal could not be loaded.");
  if (label.processing_status !== "ready") throw new Error("Wait for the automatic OCR proposal before completing review.");

  const { error } = await admin
    .from("policy_ocr_training_labels")
    .update({
      ...values,
      evidence_note: evidenceNote,
      status: decision,
      reviewed_by: reviewer.id,
      reviewed_at: new Date().toISOString(),
      owner_approved_by: null,
      owner_approved_at: null,
    })
    .eq("id", label.id);
  if (error) throw new Error("Could not save the OCR training review.");

  await admin.from("policy_ocr_training_candidates").delete().eq("training_label_id", label.id);
  revalidatePath("/policies/ocr-training");
}

export async function approvePolicyOcrTrainingLabel(formData: FormData) {
  const owner = await requireTrainingOwner();
  const labelId = text(formData, "training_label_id");
  if (!labelId) throw new Error("Training label reference is missing.");

  const admin = createSupabaseAdminClient();
  const { data: label, error } = await admin
    .from("policy_ocr_training_labels")
    .select("id,status,reviewed_by,parser_id,parser_version,proposal,insurer_name,policy_product,valid_from,valid_upto,idv,od_premium,tp_premium,cpa_opted,cpa_premium,printed_net_premium,printed_gst,printed_gross_premium")
    .eq("id", labelId)
    .maybeSingle<TrainingLabelForApproval>();
  if (error || !label) throw new Error("The reviewed training label could not be loaded.");
  if (label.status !== "reviewed" || !label.reviewed_by) throw new Error("A reviewer must submit corrections before owner approval.");
  if (label.reviewed_by === owner.id) throw new Error("The reviewer cannot approve their own training label.");

  const candidate = createSanitizedTrainingCandidate({
    labelId: label.id,
    parserId: label.parser_id,
    parserVersion: label.parser_version,
    values: label,
    proposal: label.proposal,
  });
  const { error: approvalError } = await admin.rpc("approve_policy_ocr_training_candidate", {
    p_label_id: label.id,
    p_actor_id: owner.id,
    p_candidate_payload: candidate,
  });
  if (approvalError) {
    if (approvalError.message.includes("self_approval")) throw new Error("The reviewer cannot approve their own training label.");
    throw new Error("Could not approve the sanitized training candidate.");
  }

  revalidatePath("/policies/ocr-training");
}

export async function retryPolicyOcrTrainingLabel(formData: FormData) {
  await requireTrainingReviewer();
  const labelId = text(formData, "training_label_id");
  if (!labelId) throw new Error("Training label reference is missing.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("policy_ocr_training_labels")
    .update({
      processing_status: "pending",
      processing_attempts: 0,
      next_attempt_at: new Date().toISOString(),
      lease_token: null,
      lease_expires_at: null,
      failure_code: null,
      status: "needs_review",
      owner_approved_by: null,
      owner_approved_at: null,
    })
    .eq("id", labelId);
  if (error) throw new Error("Could not queue the policy copy for another OCR attempt.");

  await admin.from("policy_ocr_training_candidates").delete().eq("training_label_id", labelId);
  await schedulePolicyOcrTraining();
  revalidatePath("/policies/ocr-training");
}

function assertFinancialReconciliation(values: {
  od_premium: number | null;
  tp_premium: number | null;
  cpa_premium: number | null;
  printed_net_premium: number | null;
}) {
  if (
    values.od_premium === null
    || values.tp_premium === null
    || values.cpa_premium === null
    || values.printed_net_premium === null
  ) return;

  const expected = values.od_premium + values.tp_premium + values.cpa_premium;
  if (Math.abs(expected - values.printed_net_premium) > 2) {
    throw new Error("OD + TP + CPA must reconcile to printed net premium before reviewer submission.");
  }
}
