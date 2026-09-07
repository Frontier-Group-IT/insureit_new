import type { TrainingComparisonSummary } from "@/lib/policy-ocr-training";

export type TrainingSampleCandidate = {
  id: string;
  insurer: string;
  product: string;
  layout: string;
  createdAt: string;
};

export function selectTopInsurers(volume: Record<string, number>, limit = 10) {
  return Object.entries(volume)
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .sort(([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b))
    .slice(0, Math.max(1, Math.min(limit, 10)))
    .map(([name]) => name);
}

/** Round-robin by insurer and then product/layout prevents a single large insurer
 * or layout from consuming a bounded run. */
export function allocateFairSamples(samples: TrainingSampleCandidate[], budget: number) {
  const groups = new Map<string, TrainingSampleCandidate[]>();
  for (const sample of samples) {
    const key = `${sample.insurer}\u0000${sample.product}\u0000${sample.layout}`;
    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }
  for (const group of groups.values()) group.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const selected: TrainingSampleCandidate[] = [];
  while (selected.length < Math.max(0, budget)) {
    let added = false;
    for (const group of groups.values()) {
      const next = group.shift();
      if (next) {
        selected.push(next);
        added = true;
        if (selected.length >= budget) break;
      }
    }
    if (!added) break;
  }
  return selected;
}

export function acceptanceGate(input: {
  fieldAccuracy: number;
  wrongFinancialValues: number;
  freshSiblingCounts: Record<string, number>;
  minimumFreshSiblings?: number;
  holdoutFailures: number;
  budgetExhausted: boolean;
  operatorOverride?: boolean;
}) {
  const freshMinimum = input.minimumFreshSiblings ?? 3;
  const freshReady = Object.values(input.freshSiblingCounts).every((count) => count >= freshMinimum);
  const accepted = input.operatorOverride === true
    || (input.fieldAccuracy >= 0.95
      && input.wrongFinancialValues === 0
      && input.holdoutFailures === 0
      && freshReady
      && !input.budgetExhausted);
  return {
    accepted,
    reason: accepted ? null : input.wrongFinancialValues > 0 ? "wrong_financial_value"
      : input.fieldAccuracy < 0.95 ? "field_accuracy_below_95_percent"
        : input.holdoutFailures > 0 ? "holdout_failure"
          : !freshReady ? "fresh_sibling_coverage_incomplete"
            : input.budgetExhausted ? "iteration_budget_exhausted" : "operator_review_required",
  };
}

export function comparisonMetrics(comparison: TrainingComparisonSummary) {
  const financialKeys = new Set(["idv", "od_premium", "tp_premium", "cpa_premium", "printed_net_premium", "printed_gst", "printed_gross_premium"]);
  const wrongFinancialValues = Object.entries(comparison.fields)
    .filter(([key, status]) => financialKeys.has(key) && status === "mismatch").length;
  return {
    comparable: comparison.comparableFields,
    matched: comparison.matchedFields,
    accuracy: comparison.comparableFields ? comparison.matchedFields / comparison.comparableFields : 0,
    wrongFinancialValues,
  };
}

export function sanitizeCandidatePatch(input: { insurer: string; product: string; layout: string; rule: string }) {
  const clean = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
  return {
    insurer: clean(input.insurer),
    product: clean(input.product),
    layout: clean(input.layout),
    rule: clean(input.rule).replace(/\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g, "[redacted]").replace(/\b[A-Z0-9]{16,}\b/gi, "[redacted]"),
  };
}
