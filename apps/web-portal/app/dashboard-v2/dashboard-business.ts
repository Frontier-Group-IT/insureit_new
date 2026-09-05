import "server-only";
import { getAccessiblePolicyRmEmployeeIds } from "@/lib/policy-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ProfileLike = { id: string; role?: string | null };

export type DashboardBusinessQuery = {
  period?: string;
  from?: string;
  to?: string;
  insurer?: string;
  rm?: string;
  partnerType?: string;
  partner?: string;
  business?: string;
  vehicleClass?: string;
};

export type DashboardBusinessFilters = {
  period: "mtd" | "today" | "yesterday" | "7d" | "30d" | "fy" | "custom";
  fromDate: string;
  toDate: string;
  insurerId: string | null;
  rmEmployeeId: string | null;
  intermediaryType: string | null;
  intermediaryCode: string | null;
  businessLine: string | null;
  vehicleClass: string | null;
};

export type DashboardFilterOption = { value: string; label: string };

export type DashboardBusinessMixRow = {
  key: string;
  label: string;
  policies: number;
  grossPremium: number | null;
};

export type DashboardBusinessRankRow = {
  key: string;
  label: string;
  detail: string | null;
  policies: number;
  grossPremium: number;
};

export type DashboardBusinessData = {
  filters: DashboardBusinessFilters;
  periodLabel: string;
  periodShortLabel: string;
  appliedFilterCount: number;
  options: {
    insurers: DashboardFilterOption[];
    rms: DashboardFilterOption[];
    partnerTypes: DashboardFilterOption[];
    partners: DashboardFilterOption[];
    businessLines: DashboardFilterOption[];
    vehicleClasses: DashboardFilterOption[];
  };
  policyCount: number;
  incompletePolicies: number;
  activeProducerCount: number;
  netPremium: number | null;
  grossPremium: number | null;
  averageGrossPremium: number | null;
  channelMix: DashboardBusinessMixRow[];
  vehicleClassMix: DashboardBusinessMixRow[];
  coverageMix: DashboardBusinessMixRow[];
  businessLineMix: DashboardBusinessMixRow[];
  topInsurers: DashboardBusinessRankRow[];
  topProducers: DashboardBusinessRankRow[];
  topGroups: DashboardBusinessRankRow[];
  commercial: {
    projectedPayin: number;
    tdsAmount: number;
    payinAfterTds: number;
    partnerPayout: number;
    retention: number;
    retentionRate: number;
    payinPolicies: number;
    payoutPolicies: number;
    needsReview: number;
    reconciliationExceptions: number;
  } | null;
  warnings: string[];
};

type PolicyRow = {
  id: string;
  vehicle_id: string | null;
  insurance_company_id: string | null;
  policy_type: string | null;
  business_line: string | null;
  issuance_date: string | null;
  created_at: string;
  intermediary_type: string | null;
  intermediary_code: string | null;
  lead_source: string | null;
  rm_employee_id: string | null;
  rm_name: string | null;
  intermediary_group_id: string | null;
  intermediary_group_name: string | null;
};

type PremiumRow = {
  policy_id: string;
  net_premium: number | string | null;
  gross_premium: number | string | null;
};

type PayinRow = {
  policy_id: string;
  total_projected_payin: number | string | null;
  tds_amount: number | string | null;
  payin_after_tds: number | string | null;
  commercial_status: string | null;
};

type PayoutRow = {
  policy_id: string;
  gross_payout: number | string | null;
  partner_payout_amount: number | string | null;
  retention_amount: number | string | null;
  commercial_status: string | null;
};

type VehicleClassRow = { id: string; vehicle_type: string | null };
type InsurerRow = { id: string; name: string };

export async function getDashboardBusinessData(
  profile: ProfileLike | null | undefined,
  query: DashboardBusinessQuery,
  commercialAccess: boolean,
  accountsAccess: boolean,
): Promise<DashboardBusinessData> {
  const filters = resolveDashboardBusinessFilters(query);
  const empty = emptyBusiness(filters);
  if (!profile?.id) return empty;

  const rmEmployeeIds = await getAccessiblePolicyRmEmployeeIds(profile.id, profile.role, "view_policies");
  if (rmEmployeeIds !== null && rmEmployeeIds.length === 0) return empty;

  const admin = createSupabaseAdminClient();
  let policyQuery = admin
    .from("policies")
    .select("id,vehicle_id,insurance_company_id,policy_type,business_line,issuance_date,created_at,intermediary_type,intermediary_code,lead_source,rm_employee_id,rm_name,intermediary_group_id,intermediary_group_name")
    .limit(15000);
  if (rmEmployeeIds !== null) policyQuery = policyQuery.in("rm_employee_id", rmEmployeeIds);

  const policyResult = await policyQuery.returns<PolicyRow[]>();
  if (policyResult.error) {
    return { ...empty, warnings: ["Filtered business production could not be refreshed."] };
  }

  const allPolicies = policyResult.data ?? [];
  const vehicleIds = Array.from(new Set(allPolicies.map((row) => row.vehicle_id).filter((value): value is string => Boolean(value))));
  const insurerIds = Array.from(new Set(allPolicies.map((row) => row.insurance_company_id).filter((value): value is string => Boolean(value))));

  const insurerPromise = insurerIds.length
    ? admin.from("insurance_companies").select("id,name").in("id", insurerIds).returns<InsurerRow[]>()
    : Promise.resolve({ data: [] as InsurerRow[], error: null });

  const vehicleRows: VehicleClassRow[] = [];
  let vehicleLookupError: string | null = null;
  for (const batch of chunkValues(vehicleIds, 120)) {
    const result = await admin
      .from("vehicles")
      .select("id,vehicle_type")
      .in("id", batch)
      .returns<VehicleClassRow[]>();
    if (result.error) {
      vehicleLookupError = result.error.message;
      break;
    }
    vehicleRows.push(...(result.data ?? []));
  }

  const insurerResult = await insurerPromise;
  const warnings: string[] = [];
  if (vehicleLookupError) warnings.push("Vehicle-class business mix could not be refreshed.");
  if (insurerResult.error) warnings.push("Insurance-company business mix could not be refreshed.");

  const vehicleClassById = new Map(vehicleRows.map((row) => [row.id, clean(row.vehicle_type) || "Incomplete"]));
  const insurerById = new Map((insurerResult.data ?? []).map((row) => [row.id, row.name]));

  const filteredPolicies = allPolicies.filter((row) => {
    const businessDate = row.issuance_date || row.created_at.slice(0, 10);
    if (businessDate < filters.fromDate || businessDate > filters.toDate) return false;
    if (filters.insurerId && row.insurance_company_id !== filters.insurerId) return false;
    if (filters.rmEmployeeId && row.rm_employee_id !== filters.rmEmployeeId) return false;
    if (filters.intermediaryType && clean(row.intermediary_type) !== filters.intermediaryType) return false;
    if (filters.intermediaryCode && clean(row.intermediary_code) !== filters.intermediaryCode) return false;
    if (filters.businessLine && clean(row.business_line) !== filters.businessLine) return false;
    if (filters.vehicleClass) {
      const vehicleClass = row.vehicle_id ? vehicleClassById.get(row.vehicle_id) ?? "Incomplete" : row.business_line === "Non Motor" ? "Non-Motor" : "Incomplete";
      if (vehicleClass !== filters.vehicleClass) return false;
    }
    return true;
  });

  const incompletePolicies = filteredPolicies.filter((row) => {
    const line = clean(row.business_line);
    const vehicleClass = row.vehicle_id ? vehicleClassById.get(row.vehicle_id) : null;
    return !row.insurance_company_id
      || !row.rm_employee_id
      || !line
      || (line === "Motor" && (!row.vehicle_id || !vehicleClass || vehicleClass === "Incomplete"));
  }).length;

  const policyIds = filteredPolicies.map((row) => row.id);
  const premiumByPolicy = new Map<string, { net: number; gross: number }>();

  if (commercialAccess && policyIds.length) {
    const premiumResults = await Promise.all(
      chunkValues(policyIds, 120).map((batch) =>
        admin
          .from("policy_premium_details")
          .select("policy_id,net_premium,gross_premium")
          .in("policy_id", batch)
          .returns<PremiumRow[]>()
      )
    );
    const premiumError = premiumResults.find((result) => result.error)?.error;
    if (premiumError) warnings.push("Premium figures could not be refreshed.");
    else {
      for (const result of premiumResults) {
        for (const row of result.data ?? []) {
          premiumByPolicy.set(row.policy_id, { net: numberValue(row.net_premium), gross: numberValue(row.gross_premium) });
        }
      }
    }
  }

  const channel = new Map<string, Accumulator>();
  const vehicleClass = new Map<string, Accumulator>();
  const coverage = new Map<string, Accumulator>();
  const businessLine = new Map<string, Accumulator>();
  const insurers = new Map<string, Accumulator>();
  const producers = new Map<string, Accumulator & { detail: string | null }>();
  const groups = new Map<string, Accumulator & { detail: string | null }>();

  for (const policy of filteredPolicies) {
    const grossPremium = premiumByPolicy.get(policy.id)?.gross ?? 0;
    add(channel, clean(policy.intermediary_type) || "Direct", grossPremium);
    const classLabel = policy.vehicle_id
      ? vehicleClassById.get(policy.vehicle_id) ?? "Incomplete"
      : policy.business_line === "Non Motor" ? "Non-Motor" : "Incomplete";
    add(vehicleClass, classLabel, grossPremium);
    add(coverage, clean(policy.policy_type) || "Incomplete", grossPremium);
    add(businessLine, clean(policy.business_line) || "Incomplete", grossPremium);

    if (policy.insurance_company_id) add(insurers, policy.insurance_company_id, grossPremium);

    const producerKey = clean(policy.intermediary_code) || "direct";
    const producer = producers.get(producerKey) ?? {
      label: clean(policy.lead_source) || producerKey,
      detail: clean(policy.intermediary_type) || null,
      policies: 0,
      amount: 0,
    };
    producer.policies += 1;
    producer.amount += grossPremium;
    producers.set(producerKey, producer);

    if (policy.intermediary_group_id || clean(policy.intermediary_group_name)) {
      const groupKey = policy.intermediary_group_id || clean(policy.intermediary_group_name) || "group";
      const group = groups.get(groupKey) ?? {
        label: clean(policy.intermediary_group_name) || "Intermediary Group",
        detail: null,
        policies: 0,
        amount: 0,
      };
      group.policies += 1;
      group.amount += grossPremium;
      groups.set(groupKey, group);
    }
  }

  const netPremium = commercialAccess
    ? Array.from(premiumByPolicy.values()).reduce((sum, value) => sum + value.net, 0)
    : null;
  const grossPremium = commercialAccess
    ? Array.from(premiumByPolicy.values()).reduce((sum, value) => sum + value.gross, 0)
    : null;

  let commercial: DashboardBusinessData["commercial"] = null;
  if (commercialAccess && accountsAccess && policyIds.length) {
    const policyIdBatches = chunkValues(policyIds, 120);
    const [payinResults, payoutResults] = await Promise.all([
      Promise.all(
        policyIdBatches.map((batch) =>
          admin
            .from("policy_payin_details")
            .select("policy_id,total_projected_payin,tds_amount,payin_after_tds,commercial_status")
            .in("policy_id", batch)
            .returns<PayinRow[]>()
        )
      ),
      Promise.all(
        policyIdBatches.map((batch) =>
          admin
            .from("policy_intermediary_payouts")
            .select("policy_id,gross_payout,partner_payout_amount,retention_amount,commercial_status")
            .in("policy_id", batch)
            .returns<PayoutRow[]>()
        )
      ),
    ]);

    const commercialError =
      payinResults.some((result) => result.error) || payoutResults.some((result) => result.error);
    if (commercialError) warnings.push("Commercial operations could not be refreshed.");
    else {
      const payins = payinResults.flatMap((result) => result.data ?? []);
      const payouts = payoutResults.flatMap((result) => result.data ?? []);
      const projectedPayin = payins.reduce((sum, row) => sum + numberValue(row.total_projected_payin), 0);
      const tdsAmount = payins.reduce((sum, row) => sum + numberValue(row.tds_amount), 0);
      const payinAfterTds = payins.reduce((sum, row) => sum + numberValue(row.payin_after_tds), 0);
      const partnerPayout = payouts.reduce((sum, row) => sum + payoutValue(row), 0);
      const retention = payouts.reduce((sum, row) => sum + numberValue(row.retention_amount), 0);
      const reconciliationExceptions = payins.filter((row) =>
        Math.abs(
          numberValue(row.payin_after_tds)
          - (numberValue(row.total_projected_payin) - numberValue(row.tds_amount))
        ) > 0.02
      ).length;
      commercial = {
        projectedPayin,
        tdsAmount,
        payinAfterTds,
        partnerPayout,
        retention,
        retentionRate: payinAfterTds > 0 ? (retention / payinAfterTds) * 100 : 0,
        payinPolicies: payins.filter((row) => numberValue(row.total_projected_payin) !== 0).length,
        payoutPolicies: payouts.filter((row) => payoutValue(row) !== 0).length,
        needsReview:
          payins.filter((row) => row.commercial_status === "needs_review").length
          + payouts.filter((row) => row.commercial_status === "needs_review").length,
        reconciliationExceptions,
      };
    }
  }

  return {
    filters,
    periodLabel: periodLabel(filters),
    periodShortLabel: periodShortLabel(filters),
    appliedFilterCount: appliedFilterCount(filters),
    options: buildOptions(allPolicies, insurerById, vehicleClassById),
    policyCount: filteredPolicies.length,
    incompletePolicies,
    activeProducerCount: new Set(filteredPolicies.map((row) => clean(row.intermediary_code)).filter(Boolean)).size,
    netPremium,
    grossPremium,
    averageGrossPremium: grossPremium !== null && filteredPolicies.length ? grossPremium / filteredPolicies.length : null,
    channelMix: mix(channel, commercialAccess),
    vehicleClassMix: mix(vehicleClass, commercialAccess),
    coverageMix: mix(coverage, commercialAccess),
    businessLineMix: mix(businessLine, commercialAccess),
    topInsurers: commercialAccess
      ? Array.from(insurers.entries())
          .map(([key, value]) => ({
            key,
            label: insurerById.get(key) || "Insurance company",
            detail: null,
            policies: value.policies,
            grossPremium: value.amount,
          }))
          .sort(rankByGrossPremium)
          .slice(0, 5)
      : [],
    topProducers: commercialAccess
      ? Array.from(producers.entries())
          .map(([key, value]) => ({
            key,
            label: value.label,
            detail: value.detail,
            policies: value.policies,
            grossPremium: value.amount,
          }))
          .sort(rankByGrossPremium)
          .slice(0, 6)
      : [],
    topGroups: commercialAccess
      ? Array.from(groups.entries())
          .map(([key, value]) => ({
            key,
            label: value.label,
            detail: value.detail,
            policies: value.policies,
            grossPremium: value.amount,
          }))
          .sort(rankByGrossPremium)
          .slice(0, 5)
      : [],
    commercial,
    warnings,
  };
}

export function resolveDashboardBusinessFilters(query: DashboardBusinessQuery): DashboardBusinessFilters {
  const period = isPeriod(query.period) ? query.period : "mtd";
  const today = indiaDate(new Date());
  const todayDate = new Date(`${today}T00:00:00+05:30`);
  let fromDate = today;
  let toDate = today;

  if (period === "mtd") fromDate = `${today.slice(0, 8)}01`;
  if (period === "yesterday") {
    fromDate = indiaDate(addDays(todayDate, -1));
    toDate = fromDate;
  }
  if (period === "7d") fromDate = indiaDate(addDays(todayDate, -6));
  if (period === "30d") fromDate = indiaDate(addDays(todayDate, -29));
  if (period === "fy") {
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const fyStart = month >= 4 ? year : year - 1;
    fromDate = `${fyStart}-04-01`;
  }
  if (period === "custom") {
    fromDate = validDate(query.from) || today;
    toDate = validDate(query.to) || today;
    if (fromDate > toDate) [fromDate, toDate] = [toDate, fromDate];
  }

  return {
    period,
    fromDate,
    toDate,
    insurerId: validUuid(query.insurer),
    rmEmployeeId: validUuid(query.rm),
    intermediaryType: cleanFilter(query.partnerType),
    intermediaryCode: cleanFilter(query.partner),
    businessLine: cleanFilter(query.business),
    vehicleClass: cleanFilter(query.vehicleClass),
  };
}

function emptyBusiness(filters: DashboardBusinessFilters): DashboardBusinessData {
  return {
    filters,
    periodLabel: periodLabel(filters),
    periodShortLabel: periodShortLabel(filters),
    appliedFilterCount: appliedFilterCount(filters),
    options: { insurers: [], rms: [], partnerTypes: [], partners: [], businessLines: [], vehicleClasses: [] },
    policyCount: 0,
    incompletePolicies: 0,
    activeProducerCount: 0,
    netPremium: null,
    grossPremium: null,
    averageGrossPremium: null,
    channelMix: [],
    vehicleClassMix: [],
    coverageMix: [],
    businessLineMix: [],
    topInsurers: [],
    topProducers: [],
    topGroups: [],
    commercial: null,
    warnings: [],
  };
}

type Accumulator = { label: string; policies: number; amount: number };

function add(map: Map<string, Accumulator>, key: string, amount: number) {
  const current = map.get(key) ?? { label: key, policies: 0, amount: 0 };
  current.policies += 1;
  current.amount += amount;
  map.set(key, current);
}

function mix(map: Map<string, Accumulator>, commercial: boolean): DashboardBusinessMixRow[] {
  return Array.from(map.entries())
    .map(([key, value]) => ({
      key,
      label: value.label,
      policies: value.policies,
      grossPremium: commercial ? value.amount : null,
    }))
    .sort((a, b) => commercial
      ? (b.grossPremium ?? 0) - (a.grossPremium ?? 0) || b.policies - a.policies
      : b.policies - a.policies)
    .slice(0, 6);
}

function rankByGrossPremium(a: DashboardBusinessRankRow, b: DashboardBusinessRankRow) {
  return b.grossPremium - a.grossPremium || b.policies - a.policies || a.label.localeCompare(b.label);
}

function buildOptions(
  policies: PolicyRow[],
  insurerById: Map<string, string>,
  vehicleClassById: Map<string, string>,
): DashboardBusinessData["options"] {
  const rms = new Map<string, string>();
  const partners = new Map<string, string>();
  const partnerTypes = new Set<string>();
  const businessLines = new Set<string>();
  const vehicleClasses = new Set<string>();

  for (const policy of policies) {
    if (policy.rm_employee_id) rms.set(policy.rm_employee_id, clean(policy.rm_name) || "Relationship manager");
    const intermediaryCode = clean(policy.intermediary_code);
    if (intermediaryCode) partners.set(intermediaryCode, clean(policy.lead_source) || intermediaryCode);
    if (clean(policy.intermediary_type)) partnerTypes.add(clean(policy.intermediary_type));
    if (clean(policy.business_line)) businessLines.add(clean(policy.business_line));
    const vehicleClass = policy.vehicle_id
      ? vehicleClassById.get(policy.vehicle_id)
      : policy.business_line === "Non Motor" ? "Non-Motor" : null;
    if (vehicleClass) vehicleClasses.add(vehicleClass);
  }

  return {
    insurers: Array.from(insurerById.entries()).map(([value, label]) => ({ value, label })).sort(optionSort),
    rms: Array.from(rms.entries()).map(([value, label]) => ({ value, label })).sort(optionSort),
    partnerTypes: Array.from(partnerTypes).map((value) => ({ value, label: value })).sort(optionSort),
    partners: Array.from(partners.entries()).map(([value, label]) => ({ value, label: label === value ? value : `${label} · ${value}` })).sort(optionSort),
    businessLines: Array.from(businessLines).map((value) => ({ value, label: value })).sort(optionSort),
    vehicleClasses: Array.from(vehicleClasses).map((value) => ({ value, label: value })).sort(optionSort),
  };
}

function periodLabel(filters: DashboardBusinessFilters) {
  const from = displayDate(filters.fromDate);
  const to = displayDate(filters.toDate);
  return filters.fromDate === filters.toDate ? from : `${from} – ${to}`;
}

function periodShortLabel(filters: DashboardBusinessFilters) {
  if (filters.period === "mtd") return "MTD";
  if (filters.period === "today") return "Today";
  if (filters.period === "yesterday") return "Yesterday";
  if (filters.period === "7d") return "Last 7 days";
  if (filters.period === "30d") return "Last 30 days";
  if (filters.period === "fy") return "This FY";
  return "Custom";
}

function appliedFilterCount(filters: DashboardBusinessFilters) {
  return [
    filters.insurerId,
    filters.rmEmployeeId,
    filters.intermediaryType,
    filters.intermediaryCode,
    filters.businessLine,
    filters.vehicleClass,
  ].filter(Boolean).length;
}

function isPeriod(value: string | undefined): value is DashboardBusinessFilters["period"] {
  return value === "mtd" || value === "today" || value === "yesterday" || value === "7d" || value === "30d" || value === "fy" || value === "custom";
}

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function validUuid(value: string | undefined) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

function cleanFilter(value: string | undefined) {
  const normalized = clean(value);
  return normalized ? normalized.slice(0, 160) : null;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function payoutValue(row: PayoutRow) {
  const partner = row.partner_payout_amount;
  return partner === null || partner === undefined ? numberValue(row.gross_payout) : numberValue(partner);
}

function chunkValues<T>(values: T[], size: number) {
  if (!values.length) return [] as T[][];
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function optionSort(a: DashboardFilterOption, b: DashboardFilterOption) {
  return a.label.localeCompare(b.label, "en-IN", { sensitivity: "base" });
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function indiaDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(`${value}T00:00:00+05:30`));
}
