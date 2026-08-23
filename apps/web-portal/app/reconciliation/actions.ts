"use server";

import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type ReconciliationPolicyMatch = {
  policyId: string;
  policyNo: string;
  insurerId: string;
  insurerName: string;
  customerName: string;
  vehicleNo: string;
  issuanceDate: string;
  projectedPayin: number | null;
};

export type ReconciliationMatchResult = {
  inputPolicyNo: string;
  normalizedPolicyNo: string;
  match: ReconciliationPolicyMatch | null;
  status: "matched" | "unmatched";
};

export type ReconciliationSubmitRow = {
  policyNo: string;
  actualPayin: number;
  tds?: number;
  adjustment?: number;
  transactionType?: string;
  reason?: string;
  reference?: string;
  remarks?: string;
};

type PolicyLookupRow = {
  id: string;
  policy_no: string | null;
  policy_no_normalized: string | null;
  insurance_company_id: string | null;
  issuance_date: string | null;
  customers: { contact_name: string | null } | null;
  vehicles: { vehicle_no: string | null } | null;
  insurance_companies: { name: string | null } | null;
  policy_payin_details: Array<{ total_projected_payin: number | null }> | { total_projected_payin: number | null } | null;
};

function normalizePolicyNo(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function projectedPayin(row: PolicyLookupRow) {
  const relation = row.policy_payin_details;
  const detail = Array.isArray(relation) ? relation[0] : relation;
  if (!detail || detail.total_projected_payin === null || detail.total_projected_payin === undefined) return null;
  const value = Number(detail.total_projected_payin);
  return Number.isFinite(value) ? value : null;
}

function toMatch(row: PolicyLookupRow): ReconciliationPolicyMatch {
  return {
    policyId: row.id,
    policyNo: row.policy_no ?? "",
    insurerId: row.insurance_company_id ?? "",
    insurerName: row.insurance_companies?.name ?? "",
    customerName: row.customers?.contact_name ?? "",
    vehicleNo: row.vehicles?.vehicle_no ?? "",
    issuanceDate: row.issuance_date ?? "",
    projectedPayin: projectedPayin(row),
  };
}

async function requireReconciliationUser() {
  const profile = await requireCapability("view_reports");
  if (!canAccessPolicyCommercials(profile)) throw new Error("Commercial details restricted");
  return profile;
}

async function loadPolicyMap(policyNumbers: string[], insurerId?: string) {
  const unique = Array.from(new Set(policyNumbers.map(normalizePolicyNo).filter(Boolean)));
  const map = new Map<string, PolicyLookupRow>();
  if (!unique.length) return map;
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("policies")
    .select("id,policy_no,policy_no_normalized,insurance_company_id,issuance_date,customers(contact_name),vehicles(vehicle_no),insurance_companies(name),policy_payin_details(total_projected_payin)")
    .in("policy_no_normalized", unique);
  if (insurerId) query = query.eq("insurance_company_id", insurerId);
  const { data, error } = await query;
  if (error) throw new Error("Policy matching is temporarily unavailable.");
  for (const raw of data ?? []) {
    const row = raw as unknown as PolicyLookupRow;
    const key = row.policy_no_normalized || normalizePolicyNo(row.policy_no ?? "");
    if (key && !map.has(key)) map.set(key, row);
  }
  return map;
}

export async function listReconciliationInsurers() {
  await requireReconciliationUser();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("insurance_companies").select("id,name").eq("is_active", true).order("name");
  if (error) throw new Error("Insurers are temporarily unavailable.");
  return (data ?? []).map((row) => ({ id: String(row.id), name: String(row.name ?? "") })).filter((row) => row.name);
}

export async function matchReconciliationPolicies(policyNumbers: string[], insurerId?: string): Promise<ReconciliationMatchResult[]> {
  await requireReconciliationUser();
  const inputs = policyNumbers.map((value) => ({ raw: value, normalized: normalizePolicyNo(value) })).filter((item) => item.normalized);
  const byPolicyNo = await loadPolicyMap(inputs.map((item) => item.raw), insurerId);
  return inputs.map((item) => {
    const row = byPolicyNo.get(item.normalized) ?? null;
    return { inputPolicyNo: item.raw, normalizedPolicyNo: item.normalized, match: row ? toMatch(row) : null, status: row ? "matched" : "unmatched" };
  });
}

export async function loadExpectedReconciliationPolicies(input: { insurerId: string; periodStart: string; periodEnd: string }): Promise<ReconciliationPolicyMatch[]> {
  await requireReconciliationUser();
  if (!input.insurerId) return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(input.periodEnd)) return [];
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("policies")
    .select("id,policy_no,policy_no_normalized,insurance_company_id,issuance_date,customers(contact_name),vehicles(vehicle_no),insurance_companies(name),policy_payin_details(total_projected_payin)")
    .eq("insurance_company_id", input.insurerId)
    .gte("issuance_date", input.periodStart)
    .lte("issuance_date", input.periodEnd)
    .order("issuance_date", { ascending: true });
  if (error) throw new Error("Expected policies could not be loaded.");
  return (data ?? []).map((row) => toMatch(row as unknown as PolicyLookupRow));
}

export async function submitReconciliationCycle(input: {
  insurerId: string;
  periodStart: string;
  periodEnd: string;
  statementReference?: string;
  rows: ReconciliationSubmitRow[];
}) {
  const profile = await requireReconciliationUser();
  if (!profile?.id) throw new Error("User profile unavailable.");
  if (!input.insurerId) throw new Error("Select an insurer.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(input.periodEnd) || input.periodEnd < input.periodStart) throw new Error("Enter a valid reconciliation period.");

  const rows = input.rows.filter((row) => normalizePolicyNo(row.policyNo));
  if (!rows.length) throw new Error("Add at least one reconciliation row.");
  for (const row of rows) {
    if (!Number.isFinite(Number(row.actualPayin))) throw new Error(`Actual recognized pay-in is required for ${row.policyNo}.`);
  }

  const policyMap = await loadPolicyMap(rows.map((row) => row.policyNo), input.insurerId);
  const prepared = rows.map((row, index) => {
    const normalized = normalizePolicyNo(row.policyNo);
    const policy = policyMap.get(normalized) ?? null;
    const projected = policy ? projectedPayin(policy) : null;
    const actual = finiteNumber(row.actualPayin);
    const tds = finiteNumber(row.tds);
    const adjustment = finiteNumber(row.adjustment);
    const variance = projected === null ? null : actual + adjustment - projected;
    const exact = policy && variance !== null && Math.abs(variance) <= 1;
    return {
      source_row_no: index + 1,
      input_policy_no: row.policyNo.trim(),
      normalized_policy_no: normalized,
      policy_id: policy?.id ?? null,
      match_status: policy ? "Matched" : "Unmatched",
      projected_payin_snapshot: projected,
      actual_recognized_payin: actual,
      tds_amount: tds,
      adjustment_amount: adjustment,
      variance_amount: variance,
      transaction_type: row.transactionType?.trim() || "Commission",
      variance_reason: row.reason?.trim() || null,
      insurer_reference: row.reference?.trim() || null,
      remarks: row.remarks?.trim() || null,
      review_status: exact ? "Accepted" : "Pending",
      reviewed_by: exact ? profile.id : null,
      reviewed_at: exact ? new Date().toISOString() : null,
    };
  });

  const totals = prepared.reduce((acc, row) => {
    acc.projected += row.projected_payin_snapshot ?? 0;
    acc.actual += row.actual_recognized_payin;
    acc.adjustment += row.adjustment_amount;
    acc.tds += row.tds_amount;
    acc.variance += row.variance_amount ?? 0;
    if (row.match_status === "Matched") acc.matched += 1;
    if (row.variance_amount !== null && Math.abs(row.variance_amount) > 1) acc.varianceRows += 1;
    return acc;
  }, { projected: 0, actual: 0, adjustment: 0, tds: 0, variance: 0, matched: 0, varianceRows: 0 });

  const admin = createSupabaseAdminClient();
  const { data: cycle, error: cycleError } = await admin.from("reconciliation_cycles").insert({
    insurer_id: input.insurerId,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    statement_reference: input.statementReference?.trim() || null,
    status: "Submitted",
    row_count: prepared.length,
    matched_row_count: totals.matched,
    variance_row_count: totals.varianceRows,
    projected_total: totals.projected,
    actual_total: totals.actual,
    adjustment_total: totals.adjustment,
    tds_total: totals.tds,
    variance_total: totals.variance,
    created_by: profile.id,
  }).select("id").single();
  if (cycleError || !cycle?.id) throw new Error("Reconciliation cycle could not be created.");

  const cycleId = String(cycle.id);
  const { data: insertedLines, error: lineError } = await admin.from("reconciliation_lines").insert(prepared.map((row) => ({ ...row, cycle_id: cycleId }))).select("id,source_row_no");
  if (lineError) {
    await admin.from("reconciliation_cycles").delete().eq("id", cycleId);
    throw new Error("Reconciliation rows could not be saved.");
  }

  const { error: eventError } = await admin.from("reconciliation_events").insert({
    cycle_id: cycleId,
    event_type: "Cycle submitted",
    to_status: "Submitted",
    event_data: { row_count: prepared.length, matched_row_count: totals.matched, variance_row_count: totals.varianceRows, inserted_line_count: insertedLines?.length ?? 0 },
    actor_profile_id: profile.id,
  });
  if (eventError) console.error("Reconciliation audit event insert failed", eventError);
  return { cycleId };
}

export async function listReconciliationCycles() {
  await requireReconciliationUser();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("reconciliation_cycles")
    .select("id,period_start,period_end,statement_reference,status,row_count,matched_row_count,variance_row_count,projected_total,actual_total,variance_total,submitted_at,insurance_companies(name),profiles!reconciliation_cycles_created_by_fkey(full_name)")
    .order("submitted_at", { ascending: false }).limit(100);
  if (error) throw new Error("Reconciliation history is temporarily unavailable.");
  return data ?? [];
}

export async function getReconciliationCycle(cycleId: string) {
  await requireReconciliationUser();
  const admin = createSupabaseAdminClient();
  const [{ data: cycle, error: cycleError }, { data: lines, error: linesError }, { data: events, error: eventsError }] = await Promise.all([
    admin.from("reconciliation_cycles").select("*,insurance_companies(name),creator:profiles!reconciliation_cycles_created_by_fkey(full_name),reviewer:profiles!reconciliation_cycles_reviewed_by_fkey(full_name),closer:profiles!reconciliation_cycles_closed_by_fkey(full_name)").eq("id", cycleId).single(),
    admin.from("reconciliation_lines").select("*,policies(policy_no,customers(contact_name),vehicles(vehicle_no))").eq("cycle_id", cycleId).order("source_row_no"),
    admin.from("reconciliation_events").select("*,profiles(full_name)").eq("cycle_id", cycleId).order("created_at", { ascending: false }),
  ]);
  if (cycleError || !cycle) throw new Error("Reconciliation cycle not found.");
  if (linesError || eventsError) throw new Error("Reconciliation cycle details could not be loaded.");
  return { cycle, lines: lines ?? [], events: events ?? [] };
}

export async function reviewReconciliationLine(input: { cycleId: string; lineId: string; reviewStatus: "Accepted" | "Follow-up" | "Resolved"; reason?: string }) {
  const profile = await requireReconciliationUser();
  if (!profile?.id) throw new Error("User profile unavailable.");
  const admin = createSupabaseAdminClient();
  const { data: cycle } = await admin.from("reconciliation_cycles").select("status").eq("id", input.cycleId).single();
  if (!cycle || !["Submitted", "Under Review", "Reopened"].includes(String(cycle.status))) throw new Error("This cycle is not open for review.");
  const { data: line, error } = await admin.from("reconciliation_lines").update({ review_status: input.reviewStatus, reviewed_by: profile.id, reviewed_at: new Date().toISOString(), variance_reason: input.reason?.trim() || undefined }).eq("id", input.lineId).eq("cycle_id", input.cycleId).select("review_status").single();
  if (error || !line) throw new Error("Reconciliation line could not be reviewed.");
  if (cycle.status === "Submitted") await admin.from("reconciliation_cycles").update({ status: "Under Review", updated_at: new Date().toISOString() }).eq("id", input.cycleId);
  await admin.from("reconciliation_events").insert({ cycle_id: input.cycleId, line_id: input.lineId, event_type: "Line reviewed", to_status: input.reviewStatus, reason: input.reason?.trim() || null, actor_profile_id: profile.id });
  return { ok: true };
}

export async function markReconciliationCycleReconciled(cycleId: string) {
  const profile = await requireReconciliationUser();
  if (!profile?.id) throw new Error("User profile unavailable.");
  const admin = createSupabaseAdminClient();
  const { data: lines, error } = await admin.from("reconciliation_lines").select("match_status,review_status").eq("cycle_id", cycleId);
  if (error || !lines?.length) throw new Error("Reconciliation rows could not be checked.");
  if (lines.some((line) => line.match_status !== "Matched")) throw new Error("Unmatched rows must be resolved before reconciliation can be completed.");
  if (lines.some((line) => !["Accepted", "Resolved"].includes(String(line.review_status)))) throw new Error("Pending or follow-up rows must be resolved first.");
  const now = new Date().toISOString();
  const { data: cycle, error: updateError } = await admin.from("reconciliation_cycles").update({ status: "Reconciled", reviewed_by: profile.id, reviewed_at: now, updated_at: now }).eq("id", cycleId).in("status", ["Submitted", "Under Review", "Reopened"]).select("id").single();
  if (updateError || !cycle) throw new Error("Cycle could not be marked reconciled.");
  await admin.from("reconciliation_events").insert({ cycle_id: cycleId, event_type: "Cycle reconciled", to_status: "Reconciled", actor_profile_id: profile.id });
  return { ok: true };
}

export async function closeReconciliationCycle(cycleId: string) {
  const profile = await requireReconciliationUser();
  if (!profile?.id) throw new Error("User profile unavailable.");
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin.from("reconciliation_cycles").update({ status: "Closed", closed_by: profile.id, closed_at: now, updated_at: now }).eq("id", cycleId).eq("status", "Reconciled").select("id").single();
  if (error || !data) throw new Error("Only a reconciled cycle can be closed.");
  await admin.from("reconciliation_events").insert({ cycle_id: cycleId, event_type: "Cycle closed", from_status: "Reconciled", to_status: "Closed", actor_profile_id: profile.id });
  return { ok: true };
}

export async function reopenReconciliationCycle(input: { cycleId: string; reason: string }) {
  const profile = await requireReconciliationUser();
  if (!profile?.id) throw new Error("User profile unavailable.");
  if (!input.reason.trim()) throw new Error("A reopen reason is required.");
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin.from("reconciliation_cycles").update({ status: "Reopened", reopened_by: profile.id, reopened_at: now, reopen_reason: input.reason.trim(), closed_by: null, closed_at: null, updated_at: now }).eq("id", input.cycleId).eq("status", "Closed").select("id").single();
  if (error || !data) throw new Error("Only a closed cycle can be reopened.");
  await admin.from("reconciliation_events").insert({ cycle_id: input.cycleId, event_type: "Cycle reopened", from_status: "Closed", to_status: "Reopened", reason: input.reason.trim(), actor_profile_id: profile.id });
  return { ok: true };
}
