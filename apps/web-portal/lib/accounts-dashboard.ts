import "server-only";

import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ViewerProfile = { id: string; role: string | null };

export type AccountsDashboardQuery = {
  period?: string;
  from?: string;
  to?: string;
  insurer?: string;
};

export type AccountsDashboardFilters = {
  period: "last_month" | "mtd" | "custom";
  fromDate: string;
  toDate: string;
  insurerId: string | null;
};

export type InsurerSummaryRow = {
  insurerId: string;
  insuranceCompany: string;
  netPremium: number;
  projectedPayin: number;
  receivedPayin: number;
};

export type IntermediaryPayoutSummaryRow = {
  key: string;
  leadSource: string;
  rmName: string;
  intermediaryType: string;
  intermediaryCode: string;
  netPremium: number;
  calculatedPayout: number;
  releasedPayout: number;
  pendingPayout: number;
};

export type AccountsDashboardData = {
  filters: AccountsDashboardFilters;
  periodLabel: string;
  insurers: Array<{ id: string; name: string }>;
  policyCount: number;
  netPremium: number;
  projectedNetPayin: number;
  projectedNetPayout: number;
  payoutIntermediaryCount: number;
  projectedRetention: number;
  insurerSummary: InsurerSummaryRow[];
  intermediaryPayoutSummary: IntermediaryPayoutSummaryRow[];
  warnings: string[];
};

type PolicyRow = {
  id: string;
  customer_id: string;
  insurance_company_id: string | null;
  issuance_date: string | null;
  start_date: string | null;
  created_at: string;
  intermediary_type: string | null;
  intermediary_code: string | null;
  lead_source: string | null;
  rm_name: string | null;
};

type PremiumRow = { policy_id: string; net_premium: number | string | null };
type PayinRow = { policy_id: string; payin_after_tds: number | string | null };
type PayoutRow = {
  policy_id: string;
  gross_payout: number | string | null;
  retention_amount: number | string | null;
};
type InsurerRow = { id: string; name: string };
type InvoiceLineRow = { invoice_id: string; policy_id: string | null };
type ReceiptAllocationRow = { invoice_id: string; allocated_amount: number | string | null };
type PartnerPayableRow = { id: string; policy_id: string };
type PartnerPaymentAllocationRow = { payable_id: string; allocated_amount: number | string | null };

export async function loadAccountsDashboard(
  profile: ViewerProfile,
  query: AccountsDashboardQuery,
): Promise<AccountsDashboardData> {
  const filters = resolveAccountsDashboardFilters(query);
  const customerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_accounts");
  if (customerIds !== null && customerIds.length === 0) return emptyDashboard(filters);

  const admin = createSupabaseAdminClient();
  let policyQuery = admin
    .from("policies")
    .select("id,customer_id,insurance_company_id,issuance_date,start_date,created_at,intermediary_type,intermediary_code,lead_source,rm_name")
    .limit(15000);
  if (customerIds !== null) policyQuery = policyQuery.in("customer_id", customerIds);

  const policyResult = await policyQuery.returns<PolicyRow[]>();
  if (policyResult.error) {
    return { ...emptyDashboard(filters), warnings: ["Accounts dashboard business data could not be refreshed."] };
  }

  const allPolicies = policyResult.data ?? [];
  const insurerIds = Array.from(new Set(allPolicies.map((row) => row.insurance_company_id).filter((value): value is string => Boolean(value))));
  const insurerResult = insurerIds.length
    ? await admin.from("insurance_companies").select("id,name").in("id", insurerIds).returns<InsurerRow[]>()
    : { data: [] as InsurerRow[], error: null };
  const insurers = (insurerResult.data ?? []).sort((a, b) => a.name.localeCompare(b.name, "en-IN", { sensitivity: "base" }));

  const filteredPolicies = allPolicies.filter((row) => {
    const businessDate = row.issuance_date || row.start_date || row.created_at.slice(0, 10);
    if (businessDate < filters.fromDate || businessDate > filters.toDate) return false;
    if (filters.insurerId && row.insurance_company_id !== filters.insurerId) return false;
    return true;
  });

  const policyIds = filteredPolicies.map((row) => row.id);
  const warnings: string[] = [];
  if (insurerResult.error) warnings.push("Insurance-company filter options could not be refreshed.");
  if (!policyIds.length) {
    return {
      ...emptyDashboard(filters),
      insurers,
      warnings,
    };
  }

  const batches = chunkValues(policyIds, 120);
  const [premiumResults, payinResults, payoutResults, invoiceLineResults, payableResults] = await Promise.all([
    Promise.all(batches.map((batch) => admin.from("policy_premium_details").select("policy_id,net_premium").in("policy_id", batch).returns<PremiumRow[]>())),
    Promise.all(batches.map((batch) => admin.from("policy_payin_details").select("policy_id,payin_after_tds").in("policy_id", batch).returns<PayinRow[]>())),
    Promise.all(batches.map((batch) => admin.from("policy_intermediary_payouts").select("policy_id,gross_payout,retention_amount").in("policy_id", batch).returns<PayoutRow[]>())),
    Promise.all(batches.map((batch) => admin.from("accounts_invoice_lines").select("invoice_id,policy_id").in("policy_id", batch).returns<InvoiceLineRow[]>())),
    Promise.all(batches.map((batch) => admin.from("partner_payables").select("id,policy_id").in("policy_id", batch).returns<PartnerPayableRow[]>())),
  ]);

  const premiumFailed = premiumResults.some((result) => result.error);
  const payinFailed = payinResults.some((result) => result.error);
  const payoutFailed = payoutResults.some((result) => result.error);
  const invoiceLinesFailed = invoiceLineResults.some((result) => result.error);
  const payablesFailed = payableResults.some((result) => result.error);
  if (premiumFailed) warnings.push("Net premium could not be refreshed.");
  if (payinFailed) warnings.push("Projected net pay-in could not be refreshed.");
  if (payoutFailed) warnings.push("Projected payout and retention could not be refreshed.");
  if (invoiceLinesFailed) warnings.push("Received pay-in allocations could not be refreshed.");
  if (payablesFailed) warnings.push("Released payout allocations could not be refreshed.");

  const premiums = premiumFailed ? [] : premiumResults.flatMap((result) => result.data ?? []);
  const payins = payinFailed ? [] : payinResults.flatMap((result) => result.data ?? []);
  const payouts = payoutFailed ? [] : payoutResults.flatMap((result) => result.data ?? []);
  const invoiceLines = invoiceLinesFailed ? [] : invoiceLineResults.flatMap((result) => result.data ?? []);
  const payables = payablesFailed ? [] : payableResults.flatMap((result) => result.data ?? []);

  const invoiceIds = Array.from(new Set(invoiceLines.map((row) => row.invoice_id).filter(Boolean)));
  const payableIds = Array.from(new Set(payables.map((row) => row.id).filter(Boolean)));
  const [receiptAllocationResults, partnerPaymentAllocationResults] = await Promise.all([
    invoiceIds.length
      ? Promise.all(chunkValues(invoiceIds, 120).map((batch) => admin.from("accounts_receipt_allocations").select("invoice_id,allocated_amount").in("invoice_id", batch).returns<ReceiptAllocationRow[]>()))
      : Promise.resolve([]),
    payableIds.length
      ? Promise.all(chunkValues(payableIds, 120).map((batch) => admin.from("partner_payment_allocations").select("payable_id,allocated_amount").in("payable_id", batch).returns<PartnerPaymentAllocationRow[]>()))
      : Promise.resolve([]),
  ]);

  const receiptAllocationsFailed = receiptAllocationResults.some((result) => result.error);
  const partnerPaymentAllocationsFailed = partnerPaymentAllocationResults.some((result) => result.error);
  if (receiptAllocationsFailed) warnings.push("Received pay-in allocations could not be refreshed.");
  if (partnerPaymentAllocationsFailed) warnings.push("Released payout allocations could not be refreshed.");

  const receiptAllocations = receiptAllocationsFailed ? [] : receiptAllocationResults.flatMap((result) => result.data ?? []);
  const partnerPaymentAllocations = partnerPaymentAllocationsFailed ? [] : partnerPaymentAllocationResults.flatMap((result) => result.data ?? []);

  const premiumByPolicy = sumByPolicy(premiums, (row) => numberValue(row.net_premium));
  const payinByPolicy = sumByPolicy(payins, (row) => numberValue(row.payin_after_tds));
  const payoutByPolicy = sumByPolicy(payouts, (row) => payoutValue(row));
  const retentionByPolicy = sumByPolicy(payouts, (row) => numberValue(row.retention_amount));
  const policyById = new Map(filteredPolicies.map((policy) => [policy.id, policy]));

  const invoiceInsurerById = new Map<string, string>();
  for (const line of invoiceLines) {
    const insurerId = line.policy_id ? policyById.get(line.policy_id)?.insurance_company_id : null;
    if (insurerId) invoiceInsurerById.set(line.invoice_id, insurerId);
  }
  const receivedPayinByInsurer = new Map<string, number>();
  for (const allocation of receiptAllocations) {
    const insurerId = invoiceInsurerById.get(allocation.invoice_id);
    if (!insurerId) continue;
    receivedPayinByInsurer.set(insurerId, (receivedPayinByInsurer.get(insurerId) ?? 0) + numberValue(allocation.allocated_amount));
  }

  const payablePolicyById = new Map(payables.map((row) => [row.id, row.policy_id]));
  const releasedPayoutByPolicy = new Map<string, number>();
  for (const allocation of partnerPaymentAllocations) {
    const policyId = payablePolicyById.get(allocation.payable_id);
    if (!policyId) continue;
    releasedPayoutByPolicy.set(policyId, (releasedPayoutByPolicy.get(policyId) ?? 0) + numberValue(allocation.allocated_amount));
  }

  const insurerNameById = new Map(insurers.map((insurer) => [insurer.id, insurer.name]));
  const insurerSummaryMap = new Map<string, InsurerSummaryRow>();
  for (const policy of filteredPolicies) {
    const insurerId = policy.insurance_company_id;
    if (!insurerId) continue;
    const row = insurerSummaryMap.get(insurerId) ?? {
      insurerId,
      insuranceCompany: insurerNameById.get(insurerId) ?? "Unknown insurer",
      netPremium: 0,
      projectedPayin: 0,
      receivedPayin: receivedPayinByInsurer.get(insurerId) ?? 0,
    };
    row.netPremium += premiumByPolicy.get(policy.id) ?? 0;
    row.projectedPayin += payinByPolicy.get(policy.id) ?? 0;
    insurerSummaryMap.set(insurerId, row);
  }
  const insurerSummary = Array.from(insurerSummaryMap.values()).sort((a, b) => b.netPremium - a.netPremium || a.insuranceCompany.localeCompare(b.insuranceCompany, "en-IN"));

  const intermediarySummaryMap = new Map<string, IntermediaryPayoutSummaryRow>();
  for (const policy of filteredPolicies) {
    const intermediaryType = clean(policy.intermediary_type) || "—";
    const intermediaryCode = clean(policy.intermediary_code) || "—";
    const leadSource = clean(policy.lead_source) || "—";
    const rmName = clean(policy.rm_name) || "—";
    const key = [leadSource, rmName, intermediaryType, intermediaryCode].join("::");
    const row = intermediarySummaryMap.get(key) ?? {
      key,
      leadSource,
      rmName,
      intermediaryType,
      intermediaryCode,
      netPremium: 0,
      calculatedPayout: 0,
      releasedPayout: 0,
      pendingPayout: 0,
    };
    row.netPremium += premiumByPolicy.get(policy.id) ?? 0;
    row.calculatedPayout += payoutByPolicy.get(policy.id) ?? 0;
    row.releasedPayout += releasedPayoutByPolicy.get(policy.id) ?? 0;
    intermediarySummaryMap.set(key, row);
  }
  const intermediaryPayoutSummary = Array.from(intermediarySummaryMap.values())
    .map((row) => ({ ...row, pendingPayout: Math.max(0, row.calculatedPayout - row.releasedPayout) }))
    .filter((row) => row.netPremium !== 0 || row.calculatedPayout !== 0 || row.releasedPayout !== 0)
    .sort((a, b) => b.netPremium - a.netPremium || b.calculatedPayout - a.calculatedPayout || a.intermediaryCode.localeCompare(b.intermediaryCode, "en-IN"));

  const payoutPolicyIds = new Set(payouts.filter((row) => payoutValue(row) !== 0).map((row) => row.policy_id));
  const payoutIntermediaries = new Set(
    filteredPolicies
      .filter((row) => payoutPolicyIds.has(row.id))
      .map((row) => clean(row.intermediary_code))
      .filter(Boolean),
  );

  return {
    filters,
    periodLabel: displayRange(filters.fromDate, filters.toDate),
    insurers,
    policyCount: filteredPolicies.length,
    netPremium: sumMap(premiumByPolicy),
    projectedNetPayin: sumMap(payinByPolicy),
    projectedNetPayout: sumMap(payoutByPolicy),
    payoutIntermediaryCount: payoutIntermediaries.size,
    projectedRetention: sumMap(retentionByPolicy),
    insurerSummary,
    intermediaryPayoutSummary,
    warnings: Array.from(new Set(warnings)),
  };
}

export function resolveAccountsDashboardFilters(query: AccountsDashboardQuery): AccountsDashboardFilters {
  const period = query.period === "last_month" || query.period === "custom" ? query.period : "mtd";
  const today = indiaDate(new Date());
  const firstOfCurrentMonth = `${today.slice(0, 8)}01`;
  let fromDate = firstOfCurrentMonth;
  let toDate = today;

  if (period === "last_month") {
    const firstCurrent = new Date(`${firstOfCurrentMonth}T00:00:00+05:30`);
    const lastPrevious = indiaDate(addDays(firstCurrent, -1));
    fromDate = `${lastPrevious.slice(0, 8)}01`;
    toDate = lastPrevious;
  }
  if (period === "custom") {
    fromDate = validDate(query.from) || firstOfCurrentMonth;
    toDate = validDate(query.to) || today;
    if (fromDate > toDate) [fromDate, toDate] = [toDate, fromDate];
  }

  return {
    period,
    fromDate,
    toDate,
    insurerId: validUuid(query.insurer),
  };
}

function emptyDashboard(filters: AccountsDashboardFilters): AccountsDashboardData {
  return {
    filters,
    periodLabel: displayRange(filters.fromDate, filters.toDate),
    insurers: [],
    policyCount: 0,
    netPremium: 0,
    projectedNetPayin: 0,
    projectedNetPayout: 0,
    payoutIntermediaryCount: 0,
    projectedRetention: 0,
    insurerSummary: [],
    intermediaryPayoutSummary: [],
    warnings: [],
  };
}

// Finance totals use the computed policy payout. partner_payout_amount is an input/planning
// field and can exist without insurer pay-in, so it must not be used as dashboard cashflow.
function payoutValue(row: PayoutRow) {
  return numberValue(row.gross_payout);
}

function sumByPolicy<T extends { policy_id: string }>(rows: T[], value: (row: T) => number) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.policy_id, (totals.get(row.policy_id) ?? 0) + value(row));
  return totals;
}

function sumMap(values: Map<string, number>) {
  let total = 0;
  for (const value of values.values()) total += value;
  return total;
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function clean(value: unknown) { return String(value ?? "").trim(); }
function validDate(value: string | undefined) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }
function validUuid(value: string | undefined) { return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null; }
function addDays(date: Date, days: number) { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
function indiaDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function displayRange(from: string, to: string) {
  const format = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${value}T00:00:00+05:30`));
  return from === to ? format(from) : `${format(from)} – ${format(to)}`;
}
