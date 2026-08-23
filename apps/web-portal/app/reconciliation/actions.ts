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

export type ReconciliationSourceMethod = "manual" | "excel_paste" | "template_import" | "expected_policies";

export type ReconciliationDraftRow = {
  policyNo: string;
  actualPayin: number | null;
  tds?: number | null;
  adjustment?: number | null;
  transactionType?: string;
  reason?: string;
  reference?: string;
  remarks?: string;
};

export type ReconciliationDraftInput = {
  cycleId?: string | null;
  insurerId: string;
  periodStart: string;
  periodEnd: string;
  accountingPeriodStart?: string;
  accountingPeriodEnd?: string;
  statementDate?: string;
  statementReference?: string;
  settlementCycle?: string;
  sourceMethod?: ReconciliationSourceMethod;
  rows: ReconciliationDraftRow[];
};

export type ReconciliationSubmitRow = Omit<ReconciliationDraftRow, "actualPayin"> & { actualPayin: number };

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

function optionalFinite(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isDate(value: string | undefined) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
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
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) throw new Error("Commercial details restricted");
  return profile;
}

function validateHeader(input: ReconciliationDraftInput, requireInsurer = true) {
  if (requireInsurer && !input.insurerId) throw new Error("Select an insurer.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(input.periodEnd) || input.periodEnd < input.periodStart) {
    throw new Error("Enter a valid statement period.");
  }
  if (!isDate(input.statementDate) || !isDate(input.accountingPeriodStart) || !isDate(input.accountingPeriodEnd)) throw new Error("Enter valid dates.");
  if (input.accountingPeriodStart && input.accountingPeriodEnd && input.accountingPeriodEnd < input.accountingPeriodStart) throw new Error("Accounting period end cannot be before its start.");
}

function cleanDraftRows(rows: ReconciliationDraftRow[]) {
  return rows.slice(0, 2000).map((row) => ({
    policyNo: String(row.policyNo ?? "").trim(),
    actualPayin: optionalFinite(row.actualPayin),
    tds: optionalFinite(row.tds),
    adjustment: optionalFinite(row.adjustment),
    transactionType: row.transactionType?.trim() || "Commission",
    reason: row.reason?.trim() || "",
    reference: row.reference?.trim() || "",
    remarks: row.remarks?.trim() || "",
  }));
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

export async function saveReconciliationDraft(input: ReconciliationDraftInput) {
  const profile = await requireReconciliationUser();
  if (!profile?.id) throw new Error("User profile unavailable.");
  validateHeader(input);
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const rows = cleanDraftRows(input.rows);
  const activeRowCount = rows.filter((row) => normalizePolicyNo(row.policyNo)).length;
  const values = {
    insurer_id: input.insurerId,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    accounting_period_start: input.accountingPeriodStart || null,
    accounting_period_end: input.accountingPeriodEnd || null,
    statement_date: input.statementDate || null,
    statement_reference: input.statementReference?.trim() || null,
    settlement_cycle: input.settlementCycle?.trim() || null,
    source_method: input.sourceMethod || "manual",
    status: "Draft",
    row_count: activeRowCount,
    draft_payload: { version: 2, rows },
    draft_saved_at: now,
    updated_at: now,
  };

  if (input.cycleId) {
    const { data, error } = await admin.from("reconciliation_cycles").update(values).eq("id", input.cycleId).eq("status", "Draft").select("id").single();
    if (error || !data) throw new Error("This draft can no longer be edited.");
    return { cycleId: String(data.id), savedAt: now };
  }

  const { data, error } = await admin.from("reconciliation_cycles").insert({ ...values, created_by: profile.id, submitted_at: null }).select("id").single();
  if (error || !data?.id) throw new Error("Draft could not be created.");
  await admin.from("reconciliation_events").insert({
    cycle_id: data.id,
    event_type: "Draft created",
    to_status: "Draft",
    event_data: { source_method: values.source_method, row_count: activeRowCount },
    actor_profile_id: profile.id,
  });
  return { cycleId: String(data.id), savedAt: now };
}

export async function getReconciliationDraft(cycleId: string) {
  const profile = await requireReconciliationUser();
  if (!profile?.id) throw new Error("User profile unavailable.");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("reconciliation_cycles")
    .select("id,insurer_id,period_start,period_end,accounting_period_start,accounting_period_end,statement_date,statement_reference,settlement_cycle,source_method,draft_payload,draft_saved_at,status,created_by")
    .eq("id", cycleId).eq("status", "Draft").single();
  if (error || !data) throw new Error("Draft not found.");
  return data;
}

export async function listReconciliationDrafts() {
  await requireReconciliationUser();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("reconciliation_cycles")
    .select("id,period_start,period_end,statement_reference,statement_date,settlement_cycle,source_method,row_count,draft_saved_at,insurance_companies(name),profiles!reconciliation_cycles_created_by_fkey(full_name)")
    .eq("status", "Draft").order("draft_saved_at", { ascending: false }).limit(25);
  if (error) throw new Error("Drafts are temporarily unavailable.");
  return data ?? [];
}

export async function discardReconciliationDraft(cycleId: string) {
  const profile = await requireReconciliationUser();
  if (!profile?.id) throw new Error("User profile unavailable.");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("reconciliation_cycles").delete().eq("id", cycleId).eq("status", "Draft").select("id").single();
  if (error || !data) throw new Error("Draft could not be discarded.");
  return { ok: true };
}

export async function submitReconciliationCycle(input: ReconciliationDraftInput) {
  const profile = await requireReconciliationUser();
  if (!profile?.id) throw new Error("User profile unavailable.");
  validateHeader(input);
  const rows = cleanDraftRows(input.rows).filter((row) => normalizePolicyNo(row.policyNo));
  if (!rows.length) throw new Error("Add at least one reconciliation row.");
  for (const row of rows) {
    if (row.actualPayin === null) throw new Error(`Actual Recognized Brokerage is required for ${row.policyNo}.`);
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
      transaction_type: row.transactionType || "Commission",
      variance_reason: row.reason || null,
      insurer_reference: row.reference || null,
      remarks: row.remarks || null,
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
  let cycleId = input.cycleId ?? null;
  if (cycleId) {
    const { data: draft, error } = await admin.from("reconciliation_cycles").select("id,status").eq("id", cycleId).eq("status", "Draft").single();
    if (error || !draft) throw new Error("This draft can no longer be submitted.");
  } else {
    const { data: draft, error } = await admin.from("reconciliation_cycles").insert({
      insurer_id: input.insurerId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      status: "Draft",
      created_by: profile.id,
      submitted_at: null,
      row_count: prepared.length,
    }).select("id").single();
    if (error || !draft?.id) throw new Error("Reconciliation cycle could not be created.");
    cycleId = String(draft.id);
  }

  await admin.from("reconciliation_lines").delete().eq("cycle_id", cycleId);
  const { data: insertedLines, error: lineError } = await admin.from("reconciliation_lines").insert(prepared.map((row) => ({ ...row, cycle_id: cycleId }))).select("id,source_row_no");
  if (lineError) throw new Error("Reconciliation rows could not be saved. The cycle remains a draft.");

  const now = new Date().toISOString();
  const { data: submitted, error: cycleError } = await admin.from("reconciliation_cycles").update({
    insurer_id: input.insurerId,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    accounting_period_start: input.accountingPeriodStart || null,
    accounting_period_end: input.accountingPeriodEnd || null,
    statement_date: input.statementDate || null,
    statement_reference: input.statementReference?.trim() || null,
    settlement_cycle: input.settlementCycle?.trim() || null,
    source_method: input.sourceMethod || "manual",
    status: "Submitted",
    row_count: prepared.length,
    matched_row_count: totals.matched,
    variance_row_count: totals.varianceRows,
    projected_total: totals.projected,
    actual_total: totals.actual,
    adjustment_total: totals.adjustment,
    tds_total: totals.tds,
    variance_total: totals.variance,
    draft_payload: null,
    draft_saved_at: null,
    submitted_at: now,
    updated_at: now,
  }).eq("id", cycleId).eq("status", "Draft").select("id").single();
  if (cycleError || !submitted) {
    await admin.from("reconciliation_lines").delete().eq("cycle_id", cycleId);
    throw new Error("Cycle submission could not be finalized. The draft has been preserved.");
  }

  await admin.from("reconciliation_events").insert({
    cycle_id: cycleId,
    event_type: "Cycle submitted",
    from_status: "Draft",
    to_status: "Submitted",
    event_data: { row_count: prepared.length, matched_row_count: totals.matched, variance_row_count: totals.varianceRows, inserted_line_count: insertedLines?.length ?? 0, source_method: input.sourceMethod || "manual" },
    actor_profile_id: profile.id,
  });
  return { cycleId };
}

export async function listReconciliationCycles() {
  await requireReconciliationUser();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("reconciliation_cycles")
    .select("id,period_start,period_end,accounting_period_start,accounting_period_end,statement_date,statement_reference,settlement_cycle,source_method,status,row_count,matched_row_count,variance_row_count,projected_total,actual_total,variance_total,submitted_at,updated_at,insurance_companies(name),profiles!reconciliation_cycles_created_by_fkey(full_name)")
    .neq("status", "Draft").order("submitted_at", { ascending: false }).limit(100);
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

export async function bulkReviewReconciliationLines(input: { cycleId: string; lineIds: string[]; reviewStatus: "Accepted" | "Follow-up" | "Resolved"; reason?: string }) {
  const profile = await requireReconciliationUser();
  if (!profile?.id) throw new Error("User profile unavailable.");
  const lineIds = Array.from(new Set(input.lineIds.filter(Boolean))).slice(0, 1000);
  if (!lineIds.length) throw new Error("Select at least one reconciliation row.");
  const admin = createSupabaseAdminClient();
  const { data: cycle } = await admin.from("reconciliation_cycles").select("status").eq("id", input.cycleId).single();
  if (!cycle || !["Submitted", "Under Review", "Reopened"].includes(String(cycle.status))) throw new Error("This cycle is not open for review.");
  const now = new Date().toISOString();
  const values = { review_status: input.reviewStatus, reviewed_by: profile.id, reviewed_at: now, ...(input.reason?.trim() ? { variance_reason: input.reason.trim() } : {}) };
  const { data, error } = await admin.from("reconciliation_lines").update(values).eq("cycle_id", input.cycleId).in("id", lineIds).select("id");
  if (error || !data?.length) throw new Error("Selected rows could not be reviewed.");
  if (cycle.status === "Submitted") await admin.from("reconciliation_cycles").update({ status: "Under Review", updated_at: now }).eq("id", input.cycleId);
  await admin.from("reconciliation_events").insert({ cycle_id: input.cycleId, event_type: "Bulk line review", to_status: input.reviewStatus, reason: input.reason?.trim() || null, event_data: { line_count: data.length }, actor_profile_id: profile.id });
  return { ok: true, updated: data.length };
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