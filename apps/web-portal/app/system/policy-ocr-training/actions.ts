"use server";

import { revalidatePath } from "next/cache";
import { extractPolicyDocument, processPolicyOcrTrainingDocument } from "@/app/policies/policy-ocr-actions";
import { buildTrainingProposal } from "@/lib/policy-ocr-training";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingOperator } from "@/lib/policy-ocr-training-access";
import { buildReferenceFields, compareTruth } from "./benchmark-truth";

const PAGE_PATH = "/system/policy-ocr-training";
const MAX_BATCH_SIZE = 2;

export async function createProductionOcrBenchmarkRun() {
  const profile = await requirePolicyOcrTrainingOperator();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("create_policy_ocr_production_benchmark_run", {
    p_actor_id: profile.id,
    p_per_family: 4,
  });
  if (error || !data) {
    console.error("Policy OCR benchmark selection failed", error?.code ?? "missing_run_id");
    throw new Error("Unable to create the production OCR benchmark run.");
  }
  revalidatePath(PAGE_PATH);
}

export async function processNextProductionOcrBenchmarkBatch(formData: FormData) {
  await requirePolicyOcrTrainingOperator();
  const runId = String(formData.get("runId") ?? "").trim();
  if (!runId) throw new Error("Benchmark run is required.");

  const admin = createSupabaseAdminClient();
  const { data: items, error: itemError } = await admin
    .from("policy_ocr_benchmark_items")
    .select("id,training_label_id")
    .eq("run_id", runId)
    .eq("baseline_status", "pending")
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH_SIZE);
  if (itemError) {
    console.error("Policy OCR benchmark item lookup failed", itemError.code);
    throw new Error("Unable to load the next benchmark batch.");
  }

  if (!items?.length) {
    await refreshRunSummary(runId);
    revalidatePath(PAGE_PATH);
    return;
  }

  await admin
    .from("policy_ocr_benchmark_runs")
    .update({ status: "processing", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", runId)
    .in("status", ["selected", "processing"]);

  for (const item of items) {
    await admin
      .from("policy_ocr_benchmark_items")
      .update({ baseline_status: "processing", updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("baseline_status", "pending");

    let actionResult: Awaited<ReturnType<typeof processPolicyOcrTrainingDocument>> | null = null;
    try {
      actionResult = await processPolicyOcrTrainingDocument(item.training_label_id);
    } catch (error) {
      console.error("Policy OCR benchmark baseline action failed", error instanceof Error ? error.name : typeof error);
    }

    const { data: label } = await admin
      .from("policy_ocr_training_labels")
      .select("proposal,parser_id,parser_version,extraction_method,processing_status,failure_code,proposed_at")
      .eq("id", item.training_label_id)
      .maybeSingle();

    const baselineReady = Boolean(actionResult?.ok && label?.processing_status === "ready" && label?.proposal);
    const actionError = actionResult && !actionResult.ok && "error" in actionResult
      ? actionResult.error
      : null;

    await admin
      .from("policy_ocr_benchmark_items")
      .update({
        baseline_status: baselineReady ? "ready" : "failed",
        baseline_proposal: label?.proposal ?? null,
        baseline_parser_id: label?.parser_id ?? null,
        baseline_parser_version: label?.parser_version ?? null,
        baseline_extraction_method: label?.extraction_method ?? null,
        baseline_failure_code: baselineReady ? null : (label?.failure_code ?? actionError ?? "processing_failed"),
        baseline_captured_at: label?.proposed_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
  }

  await refreshRunSummary(runId);
  revalidatePath(PAGE_PATH);
}

export async function processNextProductionOcrPostTrainingBatch(formData: FormData) {
  await requirePolicyOcrTrainingOperator();
  const runId = String(formData.get("runId") ?? "").trim();
  if (!runId) throw new Error("Benchmark run is required.");

  const admin = createSupabaseAdminClient();
  const { data: items, error: itemError } = await admin
    .from("policy_ocr_benchmark_items")
    .select("id,training_label_id,truth_fields,truth_status")
    .eq("run_id", runId)
    .eq("cohort_role", "training")
    .eq("truth_status", "verified")
    .eq("post_training_status", "pending")
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH_SIZE);
  if (itemError) {
    console.error("Policy OCR post-training replay lookup failed", itemError.code);
    throw new Error("Unable to load the next post-training replay batch.");
  }

  if (!items?.length) {
    revalidatePath(PAGE_PATH);
    return;
  }

  for (const item of items) {
    const { data: claimed, error: claimError } = await admin
      .from("policy_ocr_benchmark_items")
      .update({ post_training_status: "processing", post_training_failure_code: null, updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("cohort_role", "training")
      .eq("truth_status", "verified")
      .eq("post_training_status", "pending")
      .select("id")
      .maybeSingle<{ id: string }>();
    if (claimError || !claimed) continue;

    try {
      const { data: label, error: labelError } = await admin
        .from("policy_ocr_training_labels")
        .select("policy_document_id,insurer_name,policy_product,policy_number,valid_from,valid_upto,idv,od_premium,tp_premium,cpa_opted,cpa_premium,printed_net_premium,printed_gst,printed_gross_premium,section_02_reference")
        .eq("id", item.training_label_id)
        .maybeSingle<Record<string, unknown>>();
      if (labelError || !label?.policy_document_id) {
        await failPostTrainingReplay(item.id, "training_reference_missing");
        continue;
      }

      const { data: document, error: documentError } = await admin
        .from("policy_documents")
        .select("file_name,storage_bucket,storage_path,mime_type")
        .eq("id", String(label.policy_document_id))
        .eq("document_type", "policy_copy")
        .maybeSingle<{ file_name: string; storage_bucket: string; storage_path: string; mime_type: string | null }>();
      if (documentError || !document) {
        await failPostTrainingReplay(item.id, "policy_copy_not_found");
        continue;
      }

      const { data: blob, error: storageError } = await admin.storage
        .from(document.storage_bucket)
        .download(document.storage_path);
      if (storageError || !blob) {
        await failPostTrainingReplay(item.id, "private_copy_unavailable");
        continue;
      }

      const file = new File([blob], document.file_name, {
        type: document.mime_type || blob.type || "application/pdf",
      });
      const input = new FormData();
      input.set("policy_document", file);
      const result = await extractPolicyDocument(input);
      if (!result.ok) {
        await failPostTrainingReplay(item.id, "ocr_processing_failed");
        continue;
      }

      const proposal = buildTrainingProposal(result);
      const reference = buildReferenceFields(label);
      const truth = isRecord(item.truth_fields) ? stringRecord(item.truth_fields) : {};
      const comparison = compareTruth(proposal, reference, truth);

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
          post_training_metrics: comparison.metrics,
          post_training_field_results: comparison.fields,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("post_training_status", "processing");
      if (updateError) throw new Error("post_training_update_failed");
    } catch (error) {
      console.error("Policy OCR post-training replay failed", error instanceof Error ? error.name : typeof error);
      await failPostTrainingReplay(item.id, "processing_failed");
    }
  }

  revalidatePath(PAGE_PATH);
}

async function failPostTrainingReplay(itemId: string, code: string) {
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
    .eq("post_training_status", "processing");
}

async function refreshRunSummary(runId: string) {
  const admin = createSupabaseAdminClient();
  const { data: items, error } = await admin
    .from("policy_ocr_benchmark_items")
    .select("baseline_status,cohort_role")
    .eq("run_id", runId);
  if (error) {
    console.error("Policy OCR benchmark summary failed", error.code);
    return;
  }

  const total = items?.length ?? 0;
  const ready = items?.filter((item) => item.baseline_status === "ready").length ?? 0;
  const failed = items?.filter((item) => item.baseline_status === "failed").length ?? 0;
  const processing = items?.filter((item) => item.baseline_status === "processing").length ?? 0;
  const pending = items?.filter((item) => item.baseline_status === "pending").length ?? 0;
  const training = items?.filter((item) => item.cohort_role === "training").length ?? 0;
  const holdout = items?.filter((item) => item.cohort_role === "blind_holdout").length ?? 0;
  const complete = total > 0 && pending === 0 && processing === 0;

  await admin
    .from("policy_ocr_benchmark_runs")
    .update({
      status: complete ? "baseline_ready" : "processing",
      completed_at: complete ? new Date().toISOString() : null,
      summary: { total, ready, failed, processing, pending, training, holdout },
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringRecord(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      if (entry == null || entry === "") return [];
      return [[key, typeof entry === "boolean" ? (entry ? "Yes" : "No") : String(entry)]];
    }),
  );
}
