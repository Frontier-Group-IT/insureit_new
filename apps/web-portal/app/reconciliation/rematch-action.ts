"use server";

import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function normalizePolicyNo(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function projectedPayin(relation: unknown) {
  const detail = Array.isArray(relation) ? relation[0] : relation;
  if (!detail || typeof detail !== "object" || !("total_projected_payin" in detail)) return null;
  const raw = (detail as { total_projected_payin?: unknown }).total_projected_payin;
  if (raw === null || raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

async function requireReconciliationUser() {
  const profile = await requireCapability("view_reports");
  if (!canAccessPolicyCommercials(profile) || !profile?.id) throw new Error("Commercial details restricted");
  return profile;
}

async function refreshCycleTotals(cycleId: string) {
  const admin = createSupabaseAdminClient();
  const { data: lines, error } = await admin
    .from("reconciliation_lines")
    .select("match_status,projected_payin_snapshot,actual_recognized_payin,adjustment_amount,tds_amount,variance_amount")
    .eq("cycle_id", cycleId);
  if (error || !lines) throw new Error("Cycle totals could not be recalculated.");

  const totals = lines.reduce((acc, line) => {
    const projected = line.projected_payin_snapshot === null ? 0 : Number(line.projected_payin_snapshot ?? 0);
    const actual = Number(line.actual_recognized_payin ?? 0);
    const adjustment = Number(line.adjustment_amount ?? 0);
    const tds = Number(line.tds_amount ?? 0);
    const variance = line.variance_amount === null ? 0 : Number(line.variance_amount ?? 0);
    acc.projected += Number.isFinite(projected) ? projected : 0;
    acc.actual += Number.isFinite(actual) ? actual : 0;
    acc.adjustment += Number.isFinite(adjustment) ? adjustment : 0;
    acc.tds += Number.isFinite(tds) ? tds : 0;
    acc.variance += Number.isFinite(variance) ? variance : 0;
    if (line.match_status === "Matched") acc.matched += 1;
    if (line.variance_amount !== null && Math.abs(variance) > 1) acc.varianceRows += 1;
    return acc;
  }, { projected: 0, actual: 0, adjustment: 0, tds: 0, variance: 0, matched: 0, varianceRows: 0 });

  const { error: updateError } = await admin.from("reconciliation_cycles").update({
    matched_row_count: totals.matched,
    variance_row_count: totals.varianceRows,
    projected_total: totals.projected,
    actual_total: totals.actual,
    adjustment_total: totals.adjustment,
    tds_total: totals.tds,
    variance_total: totals.variance,
    updated_at: new Date().toISOString(),
  }).eq("id", cycleId);
  if (updateError) throw new Error("Cycle totals could not be updated.");
}

export async function rematchReconciliationLine(input: { cycleId: string; lineId: string; policyNo: string }) {
  const profile = await requireReconciliationUser();
  const normalized = normalizePolicyNo(input.policyNo);
  if (!normalized) throw new Error("Enter a policy number.");
  const admin = createSupabaseAdminClient();

  const { data: cycle, error: cycleError } = await admin.from("reconciliation_cycles").select("id,insurer_id,status").eq("id", input.cycleId).single();
  if (cycleError || !cycle) throw new Error("Reconciliation cycle not found.");
  if (!["Submitted", "Under Review", "Reopened"].includes(String(cycle.status))) throw new Error("This cycle is locked for matching changes.");

  const { data: existingLine, error: lineError } = await admin.from("reconciliation_lines")
    .select("id,input_policy_no,actual_recognized_payin,adjustment_amount")
    .eq("id", input.lineId).eq("cycle_id", input.cycleId).single();
  if (lineError || !existingLine) throw new Error("Reconciliation line not found.");

  const { data: policies, error: policyError } = await admin.from("policies")
    .select("id,policy_no,policy_no_normalized,insurance_company_id,policy_payin_details(total_projected_payin)")
    .eq("insurance_company_id", cycle.insurer_id)
    .eq("policy_no_normalized", normalized)
    .limit(2);
  if (policyError) throw new Error("Policy matching is temporarily unavailable.");
  if (!policies?.length) throw new Error("No policy for this insurer matches that policy number.");
  if (policies.length > 1) throw new Error("More than one policy matches. Resolve the duplicate policy record first.");

  const policy = policies[0];
  const projected = projectedPayin(policy.policy_payin_details);
  const actual = Number(existingLine.actual_recognized_payin ?? 0);
  const adjustment = Number(existingLine.adjustment_amount ?? 0);
  const variance = projected === null ? null : actual + adjustment - projected;
  const exact = variance !== null && Math.abs(variance) <= 1;
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await admin.from("reconciliation_lines").update({
    input_policy_no: String(policy.policy_no ?? input.policyNo).trim(),
    normalized_policy_no: normalized,
    policy_id: policy.id,
    match_status: "Matched",
    projected_payin_snapshot: projected,
    variance_amount: variance,
    review_status: exact ? "Accepted" : "Pending",
    reviewed_by: exact ? profile.id : null,
    reviewed_at: exact ? now : null,
  }).eq("id", input.lineId).eq("cycle_id", input.cycleId).select("id").single();
  if (updateError || !updated) throw new Error("Reconciliation line could not be rematched.");

  if (cycle.status === "Submitted") {
    await admin.from("reconciliation_cycles").update({ status: "Under Review", updated_at: now }).eq("id", input.cycleId);
  }
  await refreshCycleTotals(input.cycleId);
  await admin.from("reconciliation_events").insert({
    cycle_id: input.cycleId,
    line_id: input.lineId,
    event_type: "Line rematched",
    from_status: "Unmatched",
    to_status: exact ? "Accepted" : "Pending",
    reason: `Policy corrected from ${String(existingLine.input_policy_no)} to ${String(policy.policy_no ?? input.policyNo)}`,
    event_data: { previous_policy_no: existingLine.input_policy_no, new_policy_no: policy.policy_no, policy_id: policy.id, projected_payin_snapshot: projected, variance_amount: variance },
    actor_profile_id: profile.id,
  });
  return { ok: true, policyNo: String(policy.policy_no ?? input.policyNo), projectedPayin: projected, variance, reviewStatus: exact ? "Accepted" : "Pending" };
}
