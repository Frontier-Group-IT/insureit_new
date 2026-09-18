import "server-only";

import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { AccountsDashboardFilters } from "@/lib/accounts-dashboard";

import {
  BUSINESS_MIS_AMOUNT_COLUMNS,
  BUSINESS_MIS_DATE_COLUMNS,
  BUSINESS_MIS_EDITABLE_COLUMNS,
  BUSINESS_MIS_HEADERS,
  BUSINESS_MIS_HIDDEN_HEADERS,
  BUSINESS_MIS_PERCENT_COLUMNS,
  BUSINESS_MIS_TOTAL_COLUMNS,
  type BusinessMisCell,
  type BusinessMisRow,
} from "@/lib/accounts-business-mis-schema";

export {
  BUSINESS_MIS_AMOUNT_COLUMNS,
  BUSINESS_MIS_DATE_COLUMNS,
  BUSINESS_MIS_EDITABLE_COLUMNS,
  BUSINESS_MIS_HEADERS,
  BUSINESS_MIS_HIDDEN_HEADERS,
  BUSINESS_MIS_PERCENT_COLUMNS,
  BUSINESS_MIS_TOTAL_COLUMNS,
} from "@/lib/accounts-business-mis-schema";
export type { BusinessMisCell, BusinessMisRow } from "@/lib/accounts-business-mis-schema";

export type BusinessMisRecord = { policyId: string; payoutId: string; row: BusinessMisRow };
export type AccountsDashboardSnapshot = {
  rows: BusinessMisRow[];
  insurers: Array<{ id: string; name: string }>;
  policyCount: number;
  netPremium: number;
  projectedNetPayin: number;
  projectedNetPayout: number;
  projectedRetention: number;
  warnings: string[];
};

type ViewerProfile = { id: string; role: string | null };

type Policy = {
  id: string;
  customer_id: string;
  insurance_company_id: string | null;
  policy_no: string | null;
  issuance_date: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  lead_source: string | null;
  rm_name: string | null;
  customers: { contact_name?: string | null; company_name?: string | null } | Array<{ contact_name?: string | null; company_name?: string | null }> | null;
  vehicles: { vehicle_no?: string | null } | Array<{ vehicle_no?: string | null }> | null;
  insurance_companies: { name?: string | null } | Array<{ name?: string | null }> | null;
  policy_premium_details: PremiumSnapshotRow | PremiumSnapshotRow[] | null;
  policy_payin_details: PayinSnapshotRow | PayinSnapshotRow[] | null;
  policy_intermediary_payouts: PayoutSnapshotRow[] | null;
  accounts_invoice_lines: InvoiceLine[] | null;
  partner_payables: PartnerPayableNested[] | null;
};

type InvoiceLine = {
  invoice_line_amount: number | string | null;
  accounts_invoices: { invoice_no?: string | null; invoice_date?: string | null; status?: string | null } | Array<{ invoice_no?: string | null; invoice_date?: string | null; status?: string | null }> | null;
};

type PayinSnapshotRow = {
  projected_od_percent: number | string | null;
  projected_od_amount: number | string | null;
  projected_tp_percent: number | string | null;
  projected_tp_amount: number | string | null;
  total_projected_payin: number | string | null;
  tds_amount: number | string | null;
  payin_after_tds: number | string | null;
};

type PremiumSnapshotRow = {
  od_premium: number | string | null;
  tp_premium: number | string | null;
  cpa_amount: number | string | null;
  net_premium: number | string | null;
};

type PayoutSnapshotRow = {
  id: string;
  od_payout_percent: number | string | null;
  tp_payout_percent: number | string | null;
  gross_payout: number | string | null;
  retention_amount: number | string | null;
};

type PaymentAllocation = {
  allocated_amount: number | string | null;
  partner_payments: { payment_date?: string | null; payment_reference?: string | null } | Array<{ payment_date?: string | null; payment_reference?: string | null }> | null;
};

type PartnerPayableNested = {
  id: string;
  partner_payment_allocations: PaymentAllocation[] | null;
};

const POLICY_SELECT = [
  "id",
  "customer_id",
  "insurance_company_id",
  "policy_no",
  "issuance_date",
  "start_date",
  "end_date",
  "created_at",
  "intermediary_type",
  "intermediary_code",
  "lead_source",
  "rm_name",
  "customers(contact_name,company_name)",
  "vehicles(vehicle_no)",
  "insurance_companies(name)",
  "policy_premium_details(od_premium,tp_premium,cpa_amount,net_premium)",
  "policy_payin_details(projected_od_percent,projected_od_amount,projected_tp_percent,projected_tp_amount,total_projected_payin,tds_amount,payin_after_tds)",
  "policy_intermediary_payouts(id,od_payout_percent,tp_payout_percent,gross_payout,retention_amount)",
  "accounts_invoice_lines(invoice_line_amount,accounts_invoices(invoice_no,invoice_date,status))",
  "partner_payables(id,partner_payment_allocations(allocated_amount,partner_payments(payment_date,payment_reference)))",
].join(",");

export async function loadAccountsDashboardSnapshot(profile: ViewerProfile, filters: AccountsDashboardFilters, options: { includeInsurers?: boolean } = {}): Promise<AccountsDashboardSnapshot> {
  const db = createSupabaseAdminClient();
  const customerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_accounts");
  if (customerIds !== null && customerIds.length === 0) {
    return { rows: [], insurers: [], policyCount: 0, netPremium: 0, projectedNetPayin: 0, projectedNetPayout: 0, projectedRetention: 0, warnings: [] };
  }

  let filteredPolicyQuery = db
    .from("policies")
    .select(POLICY_SELECT)
    .or(businessDateFilter(filters.fromDate, filters.toDate))
    .limit(15000);
  const includeInsurers = options.includeInsurers !== false;
  let insurerOptionsQuery = includeInsurers
    ? db
        .from("policies")
        .select("insurance_company_id,insurance_companies(name)")
        .not("insurance_company_id", "is", null)
        .limit(15000)
    : null;

  if (customerIds !== null) {
    filteredPolicyQuery = filteredPolicyQuery.in("customer_id", customerIds);
    if (insurerOptionsQuery) insurerOptionsQuery = insurerOptionsQuery.in("customer_id", customerIds);
  }
  if (filters.insurerId) filteredPolicyQuery = filteredPolicyQuery.eq("insurance_company_id", filters.insurerId);

  const [policyResult, insurerOptionsResult] = await Promise.all([
    filteredPolicyQuery,
    insurerOptionsQuery ?? Promise.resolve({ data: [], error: null }),
  ]);
  if (policyResult.error) {
    return {
      rows: [],
      insurers: [],
      policyCount: 0,
      netPremium: 0,
      projectedNetPayin: 0,
      projectedNetPayout: 0,
      projectedRetention: 0,
      warnings: ["Accounts dashboard business data could not be refreshed."],
    };
  }

  const filteredPolicies = (policyResult.data ?? []) as unknown as Policy[];
  const insurerMap = new Map<string, string>();
  for (const policy of (insurerOptionsResult.data ?? []) as Array<{ insurance_company_id: string | null; insurance_companies: Policy["insurance_companies"] }>) {
    if (!policy.insurance_company_id) continue;
    const insurer = one(policy.insurance_companies);
    insurerMap.set(policy.insurance_company_id, insurer?.name ?? "Unknown insurer");
  }
  const insurers = [...insurerMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en-IN", { sensitivity: "base" }));

  if (!filteredPolicies.length) {
    return { rows: [], insurers, policyCount: 0, netPremium: 0, projectedNetPayin: 0, projectedNetPayout: 0, projectedRetention: 0, warnings: [] };
  }

  try {
    const snapshot = await buildBusinessMisSnapshot(filteredPolicies);
    return {
      rows: snapshot.records.map((record) => record.row),
      insurers,
      policyCount: filteredPolicies.length,
      netPremium: snapshot.netPremium,
      projectedNetPayin: snapshot.projectedNetPayin,
      projectedNetPayout: snapshot.projectedNetPayout,
      projectedRetention: snapshot.projectedRetention,
      warnings: [],
    };
  } catch {
    return {
      rows: [],
      insurers,
      policyCount: filteredPolicies.length,
      netPremium: 0,
      projectedNetPayin: 0,
      projectedNetPayout: 0,
      projectedRetention: 0,
      warnings: ["Accounts dashboard business data could not be refreshed."],
    };
  }
}

export async function loadBusinessMisRows(profile: ViewerProfile, filters: AccountsDashboardFilters): Promise<BusinessMisRow[]> {
  return (await loadBusinessMisRecords(profile, filters)).map((record) => record.row);
}

export async function loadBusinessMisRecords(profile: ViewerProfile, filters: AccountsDashboardFilters): Promise<BusinessMisRecord[]> {
  const db = createSupabaseAdminClient();
  const customerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_accounts");
  if (customerIds !== null && customerIds.length === 0) return [];

  let policyQuery = db
    .from("policies")
    .select(POLICY_SELECT)
    .or(businessDateFilter(filters.fromDate, filters.toDate))
    .limit(15000);
  if (customerIds !== null) policyQuery = policyQuery.in("customer_id", customerIds);
  if (filters.insurerId) policyQuery = policyQuery.eq("insurance_company_id", filters.insurerId);

  const { data: policyData, error: policyError } = await policyQuery;
  if (policyError) throw new Error("Unable to load Business MIS data.");

  const policies = (policyData ?? []) as unknown as Policy[];
  return (await buildBusinessMisSnapshot(policies)).records;
}

export async function loadBusinessMisRecordsByPolicyIds(profile: ViewerProfile, policyIds: string[]): Promise<BusinessMisRecord[]> {
  const uniqueIds = [...new Set(policyIds.filter(Boolean))];
  if (!uniqueIds.length) return [];

  const db = createSupabaseAdminClient();
  const customerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_accounts");
  if (customerIds !== null && customerIds.length === 0) return [];

  const policyResults = await Promise.all(chunk(uniqueIds, 120).map((ids) => {
    let query = db.from("policies").select(POLICY_SELECT).in("id", ids);
    if (customerIds !== null) query = query.in("customer_id", customerIds);
    return query;
  }));
  const firstError = policyResults.find((result) => result.error)?.error;
  if (firstError) throw new Error(firstError.message || "Unable to load Business MIS data.");
  const policyMap = new Map(policyResults.flatMap((result) => (result.data ?? []) as unknown as Policy[]).map((policy) => [policy.id, policy]));
  const policies = uniqueIds.map((id) => policyMap.get(id)).filter((policy): policy is Policy => Boolean(policy));
  return (await buildBusinessMisSnapshot(policies)).records;
}

async function buildBusinessMisSnapshot(policies: Policy[]): Promise<{
  records: BusinessMisRecord[];
  netPremium: number;
  projectedNetPayin: number;
  projectedNetPayout: number;
  projectedRetention: number;
}> {
  if (!policies.length) return { records: [], netPremium: 0, projectedNetPayin: 0, projectedNetPayout: 0, projectedRetention: 0 };

  const records = [...policies]
    .sort((a, b) => businessDate(a).localeCompare(businessDate(b)) || String(a.policy_no ?? "").localeCompare(String(b.policy_no ?? "")))
    .map((policy) => {
      const premium = one(policy.policy_premium_details);
      const payin = one(policy.policy_payin_details);
      const policyPayouts = list(policy.policy_intermediary_payouts);
      const policyInvoices = list(policy.accounts_invoice_lines).filter((line) => one(line.accounts_invoices)?.status !== "Cancelled");
      const policyPayments = list(policy.partner_payables).flatMap((payable) => list(payable.partner_payment_allocations));
      const issued = businessDate(policy);
      const customer = one(policy.customers);
      const vehicle = one(policy.vehicles);
      const insurer = one(policy.insurance_companies);

      const billNumbers = unique(policyInvoices.map((line) => one(line.accounts_invoices)?.invoice_no).filter(Boolean));
      const billDates = unique(policyInvoices.map((line) => one(line.accounts_invoices)?.invoice_date).filter(Boolean)).sort();
      const billAmount = sum(policyInvoices.map((line) => line.invoice_line_amount));
      const totalPayin = money(payin?.total_projected_payin);
      const paymentRefs = unique(policyPayments.map((allocation) => one(allocation.partner_payments)?.payment_reference).filter(Boolean));
      const paymentDates = unique(policyPayments.map((allocation) => one(allocation.partner_payments)?.payment_date).filter(Boolean)).sort();
      const payoutId = policyPayouts.length === 1 ? String(policyPayouts[0]?.id ?? "") : "";

      return {
        policyId: policy.id,
        payoutId,
        row: [
          monthLabel(issued),
          excelDate(issued),
          policy.rm_name ?? "",
          policy.intermediary_type ?? "",
          policy.lead_source ?? "",
          policy.intermediary_code ?? "",
          vehicle?.vehicle_no ?? "",
          customer?.contact_name || customer?.company_name || "",
          money(premium?.od_premium),
          money(premium?.tp_premium),
          money(premium?.cpa_amount),
          money(premium?.net_premium),
          policy.policy_no ?? "",
          insurer?.name ?? "",
          excelDate(policy.end_date),
          money(payin?.projected_od_percent),
          money(payin?.projected_od_amount),
          money(payin?.projected_tp_percent),
          money(payin?.projected_tp_amount),
          totalPayin,
          billNumbers.join(", "),
          billAmount || "",
          excelDate(billDates.at(-1) ?? null),
          billAmount ? money(totalPayin - billAmount) : "",
          money(payin?.tds_amount),
          average(policyPayouts.map((row) => row.od_payout_percent)),
          average(policyPayouts.map((row) => row.tp_payout_percent)),
          sum(policyPayouts.map((row) => row.gross_payout)),
          sum(policyPayouts.map((row) => row.retention_amount)),
          sum(policyPayments.map((allocation) => allocation.allocated_amount)) || "",
          excelDate(paymentDates.at(-1) ?? null),
          paymentRefs.join(", "),
        ],
      };
    });

  return {
    records,
    netPremium: sum(policies.map((policy) => one(policy.policy_premium_details)?.net_premium)),
    projectedNetPayin: sum(policies.map((policy) => one(policy.policy_payin_details)?.payin_after_tds)),
    projectedNetPayout: sum(policies.flatMap((policy) => list(policy.policy_intermediary_payouts).map((row) => row.gross_payout))),
    projectedRetention: sum(policies.flatMap((policy) => list(policy.policy_intermediary_payouts).map((row) => row.retention_amount))),
  };
}

export function businessMisPeriodLabel(from: string, to: string) {
  const fromMonth = monthLabel(from);
  const toMonth = monthLabel(to);
  return fromMonth === toMonth ? fromMonth : `${fromMonth} - ${toMonth}`;
}

function one<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function list<T>(value: T[] | null | undefined): T[] { return Array.isArray(value) ? value : []; }
function pushMap<T>(map: Map<string, T[]>, key: string, value: T) { const list = map.get(key) ?? []; list.push(value); map.set(key, list); }
function unique(values: Array<string | null | undefined>) { return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))]; }
function chunk<T>(values: T[], size: number) { const result: T[][] = []; for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size)); return result; }
function number(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function money(value: unknown) { return Math.round(number(value) * 100) / 100; }
function sum(values: unknown[]) { return money(values.reduce<number>((total, value) => total + number(value), 0)); }
function average(values: unknown[]) { const numbers = values.map(number).filter((value) => value !== 0); return numbers.length ? money(numbers.reduce((total, value) => total + value, 0) / numbers.length) : 0; }
function businessDate(policy: Policy) { return policy.issuance_date || policy.start_date || String(policy.created_at ?? "").slice(0, 10); }
function businessDateFilter(fromDate: string, toDate: string) {
  const nextDate = addDays(toDate, 1);
  return [
    `and(issuance_date.gte.${fromDate},issuance_date.lte.${toDate})`,
    `and(issuance_date.is.null,start_date.gte.${fromDate},start_date.lte.${toDate})`,
    `and(issuance_date.is.null,start_date.is.null,created_at.gte.${fromDate}T00:00:00+05:30,created_at.lt.${nextDate}T00:00:00+05:30)`,
  ].join(",");
}
function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00+05:30`);
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function excelDate(value: string | null | undefined): Date | "" { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+05:30`) : ""; }
function monthLabel(value: string) { if (!value) return ""; return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${value}T00:00:00+05:30`)); }
