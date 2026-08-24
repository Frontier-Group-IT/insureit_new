"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { extractPolicyDocument } from "@/app/policies/policy-ocr-actions";
import { buildTrainingProposal } from "@/lib/policy-ocr-training";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingOperator } from "@/lib/policy-ocr-training-access";
import { BENCHMARK_FIELDS, compareTruth } from "../benchmark-truth";

const PAGE_PATH = "/system/policy-ocr-training/holdout";
const MAX_BATCH_SIZE = 2;

export async function processNextBlindHoldoutCaptureBatch(formData: FormData) {
  await requirePolicyOcrTrainingOperator();
  const runId = String(formData.get("runId") ?? "").trim();
  if (!runId) throw new Error("Benchmark run is required.");

  const admin = createSupabaseAdminClient();
  const { data: items, error: itemError } = await admin
    .from("policy_ocr_benchmark_items")
    .select("id,training_label_id")
    .eq("run_id", runId)
    .eq("cohort_role", "blind_holdout")
    .eq("truth_status", "sealed_holdout")
    .in("post_training_status", ["pending", "failed"])
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH_SIZE);
  if (itemError) throw new Error("Unable to load the next blind holdout batch.");
  if (!items?.length) {
    revalidatePath(PAGE_PATH);
    return;
  }

  for (const item of items) {
    const { data: claimed } = await admin
      .from("policy_ocr_benchmark_items")
      .update({ post_training_status: "processing", post_training_failure_code: null, updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("cohort_role", "blind_holdout")
      .eq("truth_status", "sealed_holdout")
      .in("post_training_status", ["pending", "failed"])
      .select("id")
      .maybeSingle<{ id: string }>();
    if (!claimed) continue;

    try {
      // Deliberately fetch only the document pointer. No reference/truth fields are
      // read before the final parser prediction has been frozen.
      const { data: label } = await admin
        .from("policy_ocr_training_labels")
        .select("policy_document_id")
        .eq("id", item.training_label_id)
        .maybeSingle<{ policy_document_id: string | null }>();
      if (!label?.policy_document_id) {
        await failCapture(item.id, "policy_document_missing");
        continue;
      }

      const { data: document } = await admin
        .from("policy_documents")
        .select("file_name,storage_bucket,storage_path,mime_type")
        .eq("id", label.policy_document_id)
        .eq("document_type", "policy_copy")
        .maybeSingle<{ file_name: string; storage_bucket: string; storage_path: string; mime_type: string | null }>();
      if (!document) {
        await failCapture(item.id, "policy_copy_not_found");
        continue;
      }

      const { data: blob, error: storageError } = await admin.storage.from(document.storage_bucket).download(document.storage_path);
      if (storageError || !blob) {
        await failCapture(item.id, "private_copy_unavailable");
        continue;
      }

      const file = new File([blob], document.file_name, { type: document.mime_type || blob.type || "application/pdf" });
      const input = new FormData();
      input.set("policy_document", file);
      const result = await extractPolicyDocument(input);
      if (!result.ok) {
        await failCapture(item.id, "ocr_processing_failed");
        continue;
      }

      const proposal = buildTrainingProposal(result);
      const { error: updateError } = await admin
        .from("policy_ocr_benchmark_items")
        .update({
          post_training_status: "ready",
          post_training_proposal: proposal,
          post_training_parser_id: result.parserId,
          post_training_parser_version: result.parserVersion,
          post_training_extraction_method: result.extractionMethod,
          post_training_failure_code: null,
          post_training_captured_at: new Date().toISOString(),
          post_training_metrics: null,
          post_training_field_results: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("cohort_role", "blind_holdout")
        .eq("truth_status", "sealed_holdout")
        .eq("post_training_status", "processing");
      if (updateError) throw new Error("holdout_capture_update_failed");
    } catch {
      await failCapture(item.id, "processing_failed");
    }
  }

  revalidatePath(PAGE_PATH);
}

export async function saveBlindHoldoutTruth(formData: FormData) {
  const profile = await requirePolicyOcrTrainingOperator();
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) throw new Error("Benchmark item is required.");

  const admin = createSupabaseAdminClient();
  const { data: item } = await admin
    .from("policy_ocr_benchmark_items")
    .select("id,run_id,cohort_role,truth_status,baseline_proposal,post_training_status,post_training_proposal")
    .eq("id", itemId)
    .maybeSingle<{
      id: string;
      run_id: string;
      cohort_role: string;
      truth_status: string;
      baseline_proposal: Record<string, unknown> | null;
      post_training_status: string;
      post_training_proposal: Record<string, unknown> | null;
    }>();
  if (!item || item.cohort_role !== "blind_holdout" || item.truth_status !== "sealed_holdout") {
    throw new Error("This item is not a sealed blind holdout.");
  }
  if (item.post_training_status !== "ready" || !item.post_training_proposal) {
    throw new Error("Capture the frozen post-training prediction before unsealing truth.");
  }

  const truth: Record<string, string> = {};
  for (const field of BENCHMARK_FIELDS) {
    const value = String(formData.get(`truth_${field.key}`) ?? "").trim();
    if (value) truth[field.key] = value;
  }
  if (!Object.keys(truth).length) throw new Error("Verify at least one PDF truth field before saving.");

  // No database-reference candidate is used in blind scoring. The PDF truth is
  // compared only with predictions frozen before this action was available.
  const baselineComparison = compareTruth(item.baseline_proposal ?? {}, {}, truth);
  const postComparison = compareTruth(item.post_training_proposal, {}, truth);
  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("policy_ocr_benchmark_items")
    .update({
      truth_status: "verified",
      truth_fields: truth,
      truth_source: "pdf_operator_verified_blind_holdout",
      truth_verified_by: profile.id,
      truth_verified_at: now,
      result_classification: baselineComparison.fields,
      baseline_metrics: baselineComparison.metrics,
      post_training_metrics: postComparison.metrics,
      post_training_field_results: postComparison.fields,
      updated_at: now,
    })
    .eq("id", item.id)
    .eq("cohort_role", "blind_holdout")
    .eq("truth_status", "sealed_holdout")
    .eq("post_training_status", "ready");
  if (updateError) throw new Error("Unable to save blind holdout PDF truth.");

  revalidatePath(PAGE_PATH);
  revalidatePath(`${PAGE_PATH}/${item.id}`);
  redirect(PAGE_PATH);
}

async function failCapture(itemId: string, code: string) {
  const admin = createSupabaseAdminClient();
  await admin
    .from("policy_ocr_benchmark_items")
    .update({
      post_training_status: "failed",
      post_training_failure_code: code,
      post_training_captured_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("cohort_role", "blind_holdout")
    .eq("truth_status", "sealed_holdout")
    .eq("post_training_status", "processing");
}
