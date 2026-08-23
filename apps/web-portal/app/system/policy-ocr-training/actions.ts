"use server";

import { revalidatePath } from "next/cache";
import { processPolicyOcrTrainingDocument } from "@/app/policies/policy-ocr-actions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingOperator } from "@/lib/policy-ocr-training-access";

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
    await admin
      .from("policy_ocr_benchmark_items")
      .update({
        baseline_status: baselineReady ? "ready" : "failed",
        baseline_proposal: label?.proposal ?? null,
        baseline_parser_id: label?.parser_id ?? null,
        baseline_parser_version: label?.parser_version ?? null,
        baseline_extraction_method: label?.extraction_method ?? null,
        baseline_failure_code: baselineReady ? null : (label?.failure_code ?? actionResult && "error" in actionResult ? actionResult.error : "processing_failed"),
        baseline_captured_at: label?.proposed_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
  }

  await refreshRunSummary(runId);
  revalidatePath(PAGE_PATH);
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
