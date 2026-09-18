import "server-only";

import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { AccountsDashboardFilters } from "@/lib/accounts-dashboard";

export const BUSINESS_MIS_HEADERS = [
  "Month",
  "Policy Issuance Date",
  "RM Name",
  "Intermediary Type",
  "Lead Source",
  "Intermediary Code",
  "Registration No.",
  "Insured Name",
  "OD Premium",
  "Third Party Premium",
  "CPA",
  "Net Premium",
  "Policy Number",
  "Insurance Company",
  "Valid Upto",
  "Pay-in % OD",
  "OD Pay-in Amount",
  "Pay-in % TP",
  "TP Pay-in Amount",
  "Total Pay-in",
  "Bill Number",
  "Bill Amount",
  "Bill Date",
  "Difference",
  "TDS",
  "Payout OD %",
  "Payout TP %",
  "Gross Payout",
  "Retention",
  "Paid Amount",
  "Paid Date",
  "UTR Details",
] as const;

export const BUSINESS_MIS_HIDDEN_HEADERS = ["System Policy ID", "System Payout ID"] as const;
export const BUSINESS_MIS_EDITABLE_COLUMNS = new Set([20, 21, 22, 23, 29, 30, 31]);
export const BUSINESS_MIS_AMOUNT_COLUMNS = new Set([8, 9, 10, 11, 16, 18, 19, 21, 23, 24, 27, 28, 29]);
export const BUSINESS_MIS_PERCENT_COLUMNS = new Set([15, 17, 25, 26]);
export const BUSINESS_MIS_DATE_COLUMNS = new Set([1, 14, 22, 30]);
export const BUSINESS_MIS_TOTAL_COLUMNS = [8, 9, 10, 11, 16, 18, 19, 21, 23, 24, 27, 28, 29] as const;

export type BusinessMisCell = string | number | Date;
export type BusinessMisRow = BusinessMisCell[];
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
};

type InvoiceLine = {
  policy_id: string | null;
  invoice_line_amount: number | string | null;
  accounts_invoices: { invoice_no?: string | null; invoice_date?: string | null; status?: string | null } | Array<{ invoice_no?: string | null; invoice_date?: string | null; status?: string | null }> | null;
};

type PayinSnapshotRow = {
  policy_id: string;
  projected_od_percent: number | string | null;
  projected_od_amount: number | string | null;
  projected_tp_percent: number | string | null;
  projected_tp_amount: number | string | null;
  total_projected_payin: number | string | null;
  tds_amount: number | string | null;
  payin_after_tds: number | string | null;
};

type PremiumSnapshotRow = {
  policy_id: string;
  od_premium: number | string | null;
  tp_premium: number | string | null;
  cpa_amount: number | string | null;
  net_premium: number | string | null;
};

type PaymentAllocation = {
  payable_id: string;
  allocated_amount: number | string | null;
  partner_payments: { payment_date?: string | null; payment_reference?: string | null } | Array<{ payment_date?: string | null; payment_reference?: string | null }> | null;
};

const POLICY_SELECT = "id,customer_id,insurance_company_id,policy_no,issuance_date,start_date,end_date,created_at,intermediary_type,intermediary_code,lead_source,rm_name,customers(contact_name,company_name),vehicles(vehicle_no),insurance_companies(name)";

export async function loadAccountsDashboardSnapshot(profile: ViewerProfile, filters: AccountsDashboardFilters): Promise<AccountsDashboardSnapshot> {
  const db = createSupabaseAdminClient();
  const customerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_accounts");
  if (customerIds !== null && customerIds.length === 0) {
    return { rows: [], insurers: [], policyCount: 0, netPremium: 0, projectedNetPayin: 0, projectedNetPayout: 0, projectedRetention: 0, warnings: [] };
  }

  let policyQuery = db.from("policies").select(POLICY_SELECT).limit(15000);
  if (customerIds !== null) policyQuery = policyQuery.in("customer_id", customerIds);

  const { data: policyData, error: policyError } = await policyQuery;
  if (policyError) {
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

  const allPolicies = (policyData ?? []) as Policy[];
  const insurerMap = new Map<string, string>();
  for (const policy of allPolicies) {
    if (!policy.insurance_company_id) continue;
    const insurer = one(policy.insurance_companies);
    insurerMap.set(policy.insurance_company_id, insurer?.name ?? "Unknown insurer");
  }
  const insurers = [...insurerMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en-IN", { sensitivity: "base" }));

  const filteredPolicies = allPolicies.filter((policy) => {
    const date = businessDate(policy);
    if (date < filters.fromDate || date > filters.toDate) return false;
    if (filters.insurerId && policy.insurance_company_id !== filters.insurerId) return false;
    return true;
  });

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

  let policyQuery = db.from("policies").select(POLICY_SELECT).limit(15000);
  if (customerIds !== null) policyQuery = policyQuery.in("customer_id", customerIds);
  if (filters.insurerId) policyQuery = policyQuery.eq("insurance_company_id", filters.insurerId);

  const { data: policyData, error: policyError } = await policyQuery;
  if (policyError) throw new Error("Unable to load Business MIS data.");

  const policies = ((policyData ?? []) as Policy[]).filter((policy) => {
    const date = businessDate(policy);
    return date >= filters.fromDate && date <= filters.toDate;
  });
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
  const policyMap = new Map(policyResults.flatMap((result) => (result.data ?? []) as Policy[]).map((policy) => [policy.id, policy]));
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
  const db = createSupabaseAdminClient();
  const policyIds = policies.map((policy) => policy.id);
  const batches = chunk(policyIds, 120);

  const [premiumResults, payinResults, payoutResults, invoiceLineResults, payableResults] = await Promise.all([
    Promise.all(batches.map((ids) => db.from("policy_premium_details").select("policy_id,od_premium,tp_premium,cpa_amount,net_premium").in("policy_id", ids))),
    Promise.all(batches.map((ids) => db.from("policy_payin_details").select("policy_id,projected_od_percent,projected_od_amount,projected_tp_percent,projected_tp_amount,total_projected_payin,tds_amount,payin_after_tds").in("policy_id", ids))),
    Promise.all(batches.map((ids) => db.from("policy_intermediary_payouts").select("id,policy_id,od_payout_percent,tp_payout_percent,gross_payout,retention_amount").in("policy_id", ids))),
    Promise.all(batches.map((ids) => db.from("accounts_invoice_lines").select("policy_id,invoice_line_amount,accounts_invoices(invoice_no,invoice_date,status)").in("policy_id", ids))),
    Promise.all(batches.map((ids) => db.from("partner_payables").select("id,policy_id").in("policy_id", ids))),
  ]);

  if ([premiumResults, payinResults, payoutResults, invoiceLineResults, payableResults].some((group) => group.some((result) => result.error))) {
    throw new Error("Unable to load Business MIS data.");
  }

  const premiums = premiumResults.flatMap((result) => (result.data ?? []) as PremiumSnapshotRow[]);
  const payins = payinResults.flatMap((result) => (result.data ?? []) as PayinSnapshotRow[]);
  const payouts = payoutResults.flatMap((result) => result.data ?? []);
  const invoiceLines = invoiceLineResults.flatMap((result) => (result.data ?? []) as InvoiceLine[]);
  const payables = payableResults.flatMap((result) => result.data ?? []);
  const payableIds = payables.map((row) => row.id);
  const paymentAllocationResults = await Promise.all(
    chunk(payableIds, 120).map((ids) =>
      db
        .from("partner_payment_allocations")
        .select("payable_id,allocated_amount,partner_payments(payment_date,payment_reference)")
        .in("payable_id", ids),
    ),
  );
  if (paymentAllocationResults.some((result) => result.error)) throw new Error("Unable to load Business MIS data.");
  const paymentAllocations = paymentAllocationResults.flatMap((result) => (result.data ?? []) as PaymentAllocation[]);

  const premiumMap = new Map(premiums.map((row) => [row.policy_id, row]));
  const payinMap = new Map(payins.map((row) => [row.policy_id, row]));
  const payoutMap = new Map<string, Array<Record<string, unknown>>>();
  for (const row of payouts) pushMap(payoutMap, String(row.policy_id), row as Record<string, unknown>);

  const invoiceMap = new Map<string, InvoiceLine[]>();
  for (const row of invoiceLines) {
    if (!row.policy_id) continue;
    const invoice = one(row.accounts_invoices);
    if (invoice?.status !== "Cancelled") pushMap(invoiceMap, row.policy_id, row);
  }

  const payablePolicy = new Map(payables.map((row) => [row.id, row.policy_id]));
  const paymentMap = new Map<string, PaymentAllocation[]>();
  for (const allocation of paymentAllocations) {
    const policyId = payablePolicy.get(allocation.payable_id);
    if (policyId) pushMap(paymentMap, policyId, allocation);
  }

  const records = [...policies]
    .sort((a, b) => businessDate(a).localeCompare(businessDate(b)) || String(a.policy_no ?? "").localeCompare(String(b.policy_no ?? "")))
    .map((policy) => {
      const premium = premiumMap.get(policy.id);
      const payin = payinMap.get(policy.id);
      const policyPayouts = payoutMap.get(policy.id) ?? [];
      const policyInvoices = invoiceMap.get(policy.id) ?? [];
      const policyPayments = paymentMap.get(policy.id) ?? [];
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
    netPremium: sum(premiums.map((row) => row.net_premium)),
    projectedNetPayin: sum(payins.map((row) => row.payin_after_tds)),
    projectedNetPayout: sum(payouts.map((row) => row.gross_payout)),
    projectedRetention: sum(payouts.map((row) => row.retention_amount)),
  };
}

export function businessMisPeriodLabel(from: string, to: string) {
  const fromMonth = monthLabel(from);
  const toMonth = monthLabel(to);
  return fromMonth === toMonth ? fromMonth : `${fromMonth} - ${toMonth}`;
}

function one<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function pushMap<T>(map: Map<string, T[]>, key: string, value: T) { const list = map.get(key) ?? []; list.push(value); map.set(key, list); }
function unique(values: Array<string | null | undefined>) { return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))]; }
function chunk<T>(values: T[], size: number) { const result: T[][] = []; for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size)); return result; }
function number(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function money(value: unknown) { return Math.round(number(value) * 100) / 100; }
function sum(values: unknown[]) { return money(values.reduce<number>((total, value) => total + number(value), 0)); }
function average(values: unknown[]) { const numbers = values.map(number).filter((value) => value !== 0); return numbers.length ? money(numbers.reduce((total, value) => total + value, 0) / numbers.length) : 0; }
function businessDate(policy: Policy) { return policy.issuance_date || policy.start_date || String(policy.created_at ?? "").slice(0, 10); }
function excelDate(value: string | null | undefined): Date | "" { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+05:30`) : ""; }
function monthLabel(value: string) { if (!value) return ""; return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${value}T00:00:00+05:30`)); }
