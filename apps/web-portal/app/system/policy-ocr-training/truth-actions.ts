"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingOperator } from "@/lib/policy-ocr-training-access";
import { BENCHMARK_FIELDS, buildReferenceFields, compareTruth } from "./benchmark-truth";

const PAGE_PATH = "/system/policy-ocr-training";

export async function saveBenchmarkTruthReview(formData: FormData) {
  const profile = await requirePolicyOcrTrainingOperator();
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) throw new Error("Benchmark item is required.");

  const admin = createSupabaseAdminClient();
  const { data: item, error: itemError } = await admin
    .from("policy_ocr_benchmark_items")
    .select("id,run_id,cohort_role,training_label_id,baseline_proposal,truth_status")
    .eq("id", itemId)
    .maybeSingle();
  if (itemError || !item) throw new Error("Unable to load the benchmark item.");
  if (item.cohort_role === "blind_holdout" || item.truth_status === "sealed_holdout") {
    throw new Error("Blind holdout truth remains sealed until post-training verification.");
  }

  const { data: label, error: labelError } = await admin
    .from("policy_ocr_training_labels")
    .select("insurer_name,policy_product,policy_number,valid_from,valid_upto,idv,od_premium,tp_premium,cpa_opted,cpa_premium,printed_net_premium,printed_gst,printed_gross_premium,section_02_reference")
    .eq("id", item.training_label_id)
    .maybeSingle();
  if (labelError || !label) throw new Error("Unable to load the benchmark reference candidate.");

  const truth: Record<string, string> = {};
  for (const field of BENCHMARK_FIELDS) {
    const value = String(formData.get(`truth_${field.key}`) ?? "").trim();
    if (value) truth[field.key] = value;
  }
  if (!Object.keys(truth).length) throw new Error("Verify at least one PDF truth field before saving.");

  const reference = buildReferenceFields(label as Record<string, unknown>);
  const comparison = compareTruth(item.baseline_proposal, reference, truth);
  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("policy_ocr_benchmark_items")
    .update({
      truth_status: "verified",
      truth_fields: truth,
      truth_source: "pdf_operator_verified",
      truth_verified_by: profile.id,
      truth_verified_at: now,
      result_classification: comparison.fields,
      baseline_metrics: comparison.metrics,
      updated_at: now,
    })
    .eq("id", itemId);
  if (updateError) throw new Error("Unable to save PDF truth verification.");

  await refreshTruthRunSummary(item.run_id);
  revalidatePath(PAGE_PATH);
  revalidatePath(`${PAGE_PATH}/${itemId}`);
  redirect(PAGE_PATH);
}

async function refreshTruthRunSummary(runId: string) {
  const admin = createSupabaseAdminClient();
  const { data: items, error } = await admin
    .from("policy_ocr_benchmark_items")
    .select("cohort_role,truth_status,baseline_metrics")
    .eq("run_id", runId);
  if (error || !items) return;

  const trainingItems = items.filter((item) => item.cohort_role === "training");
  const verified = trainingItems.filter((item) => item.truth_status === "verified");
  const aggregate = verified.reduce(
    (acc, item) => {
      const metrics = (item.baseline_metrics ?? {}) as Record<string, unknown>;
      acc.expected += numberValue(metrics.expected);
      acc.autoFilled += numberValue(metrics.autoFilled);
      acc.correct += numberValue(metrics.correct);
      acc.referenceConflicts += numberValue(metrics.referenceConflicts);
      acc.ocrMissing += numberValue(metrics.ocrMissing);
      acc.semanticErrors += numberValue(metrics.semanticErrors);
      if (metrics.perfect === true) acc.perfectPolicies += 1;
      return acc;
    },
    { expected: 0, autoFilled: 0, correct: 0, referenceConflicts: 0, ocrMissing: 0, semanticErrors: 0, perfectPolicies: 0 },
  );

  const { data: run } = await admin
    .from("policy_ocr_benchmark_runs")
    .select("summary,status")
    .eq("id", runId)
    .maybeSingle();
  const previousSummary = run?.summary && typeof run.summary === "object" ? run.summary : {};
  const truthReady = trainingItems.length > 0 && verified.length === trainingItems.length;
  await admin
    .from("policy_ocr_benchmark_runs")
    .update({
      status: truthReady ? "truth_ready" : (run?.status ?? "baseline_ready"),
      summary: {
        ...previousSummary,
        truth: {
          training_items: trainingItems.length,
          verified: verified.length,
          expected_fields: aggregate.expected,
          auto_filled_fields: aggregate.autoFilled,
          correct_fields: aggregate.correct,
          precision: aggregate.autoFilled ? aggregate.correct / aggregate.autoFilled : null,
          coverage: aggregate.expected ? aggregate.autoFilled / aggregate.expected : null,
          perfect_policies: aggregate.perfectPolicies,
          reference_conflicts: aggregate.referenceConflicts,
          ocr_missing: aggregate.ocrMissing,
          semantic_errors: aggregate.semanticErrors,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
