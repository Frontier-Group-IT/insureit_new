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
  warnings: string[];
};

type PolicyRow = {
  id: string;
  customer_id: string;
  insurance_company_id: string | null;
  issuance_date: string | null;
  start_date: string | null;
  created_at: string;
  intermediary_code: string | null;
};

type PremiumRow = { policy_id: string; net_premium: number | string | null };
type PayinRow = { policy_id: string; payin_after_tds: number | string | null };
type PayoutRow = {
  policy_id: string;
  gross_payout: number | string | null;
  partner_payout_amount: number | string | null;
  retention_amount: number | string | null;
};
type InsurerRow = { id: string; name: string };

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
    .select("id,customer_id,insurance_company_id,issuance_date,start_date,created_at,intermediary_code")
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
  const [premiumResults, payinResults, payoutResults] = await Promise.all([
    Promise.all(batches.map((batch) => admin.from("policy_premium_details").select("policy_id,net_premium").in("policy_id", batch).returns<PremiumRow[]>())),
    Promise.all(batches.map((batch) => admin.from("policy_payin_details").select("policy_id,payin_after_tds").in("policy_id", batch).returns<PayinRow[]>())),
    Promise.all(batches.map((batch) => admin.from("policy_intermediary_payouts").select("policy_id,gross_payout,partner_payout_amount,retention_amount").in("policy_id", batch).returns<PayoutRow[]>())),
  ]);

  const premiumFailed = premiumResults.some((result) => result.error);
  const payinFailed = payinResults.some((result) => result.error);
  const payoutFailed = payoutResults.some((result) => result.error);
  if (premiumFailed) warnings.push("Net premium could not be refreshed.");
  if (payinFailed) warnings.push("Projected net pay-in could not be refreshed.");
  if (payoutFailed) warnings.push("Projected payout and retention could not be refreshed.");

  const premiums = premiumFailed ? [] : premiumResults.flatMap((result) => result.data ?? []);
  const payins = payinFailed ? [] : payinResults.flatMap((result) => result.data ?? []);
  const payouts = payoutFailed ? [] : payoutResults.flatMap((result) => result.data ?? []);
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
    netPremium: premiums.reduce((sum, row) => sum + numberValue(row.net_premium), 0),
    projectedNetPayin: payins.reduce((sum, row) => sum + numberValue(row.payin_after_tds), 0),
    projectedNetPayout: payouts.reduce((sum, row) => sum + payoutValue(row), 0),
    payoutIntermediaryCount: payoutIntermediaries.size,
    projectedRetention: payouts.reduce((sum, row) => sum + numberValue(row.retention_amount), 0),
    warnings,
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
    warnings: [],
  };
}

function payoutValue(row: PayoutRow) {
  return row.partner_payout_amount === null || row.partner_payout_amount === undefined
    ? numberValue(row.gross_payout)
    : numberValue(row.partner_payout_amount);
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
