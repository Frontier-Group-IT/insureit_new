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

export async function listReconciliationInsurers() {
  await requireReconciliationUser();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("insurance_companies")
    .select("id,name")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error("Insurers are temporarily unavailable.");
  return (data ?? []).map((row) => ({ id: String(row.id), name: String(row.name ?? "") })).filter((row) => row.name);
}

export async function matchReconciliationPolicies(policyNumbers: string[], insurerId?: string): Promise<ReconciliationMatchResult[]> {
  await requireReconciliationUser();
  const inputs = policyNumbers.map((value) => ({ raw: value, normalized: normalizePolicyNo(value) })).filter((item) => item.normalized);
  if (!inputs.length) return [];

  const unique = Array.from(new Set(inputs.map((item) => item.normalized)));
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("policies")
    .select("id,policy_no,policy_no_normalized,insurance_company_id,issuance_date,customers(contact_name),vehicles(vehicle_no),insurance_companies(name),policy_payin_details(total_projected_payin)")
    .in("policy_no_normalized", unique);
  if (insurerId) query = query.eq("insurance_company_id", insurerId);
  const { data, error } = await query;
  if (error) throw new Error("Policy matching is temporarily unavailable.");

  const byPolicyNo = new Map<string, PolicyLookupRow>();
  for (const raw of data ?? []) {
    const row = raw as unknown as PolicyLookupRow;
    const key = row.policy_no_normalized || normalizePolicyNo(row.policy_no ?? "");
    if (key && !byPolicyNo.has(key)) byPolicyNo.set(key, row);
  }

  return inputs.map((item) => {
    const row = byPolicyNo.get(item.normalized) ?? null;
    return {
      inputPolicyNo: item.raw,
      normalizedPolicyNo: item.normalized,
      match: row ? toMatch(row) : null,
      status: row ? "matched" : "unmatched",
    };
  });
}

export async function loadExpectedReconciliationPolicies(input: {
  insurerId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<ReconciliationPolicyMatch[]> {
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
