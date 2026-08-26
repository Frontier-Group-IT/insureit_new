import {
  getAccessibleIntermediaryApplicationIds,
  getAccessibleIntermediaryIds,
} from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ProfileLike = { id: string; role?: string | null };

type IntermediaryRow = {
  id: string;
  intermediary_code: string | null;
  intermediary_type: string | null;
  display_name: string | null;
  account_status: string | null;
};

type ApplicationRow = {
  id: string;
  registration_status: string | null;
};

type PolicyRow = {
  id: string;
  intermediary_code: string | null;
  intermediary_type: string | null;
  lead_source: string | null;
  issuance_date: string | null;
  created_at: string;
  insurance_company_id: string | null;
  policy_product: string | null;
  business_type: string | null;
};

type PremiumRow = { policy_id: string; gross_premium: number | string | null };
type InsurerRow = { id: string; name: string };

type SourceAccumulator = {
  code: string;
  name: string;
  type: DistributionType;
  policies: number;
  grossPremium: number;
};

export type DistributionType = "partner" | "posp" | "misp" | "other";

export type DistributionMtdAnalytics = {
  monthLabel: string;
  pendingApplications: number;
  activeIntermediaries: number;
  production: {
    policiesMtd: number;
    activeProducersMtd: number;
    grossPremiumMtd: number | null;
    averageGrossPremiumMtd: number | null;
    byType: Record<DistributionType, number>;
    byBusinessType: Array<{ label: string; count: number }>;
    byProduct: Array<{ label: string; count: number }>;
    topInsurers: Array<{ id: string; name: string; policies: number; grossPremium: number | null }>;
  } | null;
  topSources: Array<{
    code: string;
    name: string;
    type: DistributionType;
    policies: number;
    grossPremium: number | null;
  }>;
  warnings: string[];
};

const completeRegistrationStatuses = new Set([
  "iib_registered",
  "partner_active",
  "active",
  "approved",
  "completed",
]);

export async function getDistributionMtdAnalytics(
  profile: ProfileLike | null | undefined,
  options: {
    canViewIntermediaries: boolean;
    canViewProduction: boolean;
    canViewCommercials: boolean;
  },
): Promise<DistributionMtdAnalytics | null> {
  if (!profile?.id || !options.canViewIntermediaries) return null;

  const admin = createSupabaseAdminClient();
  const [accessibleIds, accessibleApplicationIds] = await Promise.all([
    getAccessibleIntermediaryIds(profile.id, profile.role, "view_intermediaries"),
    getAccessibleIntermediaryApplicationIds(profile.id, profile.role, "view_intermediaries"),
  ]);

  let intermediaryRequest = admin
    .from("intermediaries")
    .select("id,intermediary_code,intermediary_type,display_name,account_status")
    .limit(3000);
  if (accessibleIds !== null) {
    intermediaryRequest = accessibleIds.length
      ? intermediaryRequest.in("id", accessibleIds)
      : intermediaryRequest.in("id", ["00000000-0000-0000-0000-000000000000"]);
  }

  let applicationRequest = admin
    .from("intermediary_onboarding_applications")
    .select("id,registration_status")
    .limit(3000);
  if (accessibleApplicationIds !== null) {
    applicationRequest = accessibleApplicationIds.length
      ? applicationRequest.in("id", accessibleApplicationIds)
      : applicationRequest.in("id", ["00000000-0000-0000-0000-000000000000"]);
  }

  const [intermediaryResult, applicationResult] = await Promise.all([
    intermediaryRequest.returns<IntermediaryRow[]>(),
    applicationRequest.returns<ApplicationRow[]>(),
  ]);

  const warnings: string[] = [];
  if (intermediaryResult.error) warnings.push("Intermediary figures could not be refreshed.");
  if (applicationResult.error) warnings.push("Intermediary onboarding figures could not be refreshed.");

  const intermediaries = intermediaryResult.data ?? [];
  const applications = applicationResult.data ?? [];
  const pendingApplications = applications.filter((row) => {
    const status = (row.registration_status ?? "").trim().toLowerCase();
    return !completeRegistrationStatuses.has(status);
  }).length;
  const activeIntermediaries = intermediaries.filter((row) => row.account_status === "active").length;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthStartKey = monthStart.toISOString().slice(0, 10);
  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  if (!options.canViewProduction) {
    return { monthLabel, pendingApplications, activeIntermediaries, production: null, topSources: [], warnings };
  }

  const intermediaryCodes = Array.from(new Set(
    intermediaries.map((row) => row.intermediary_code).filter((value): value is string => Boolean(value)),
  ));

  if (accessibleIds !== null && !intermediaryCodes.length) {
    return {
      monthLabel,
      pendingApplications,
      activeIntermediaries,
      production: emptyProduction(options.canViewCommercials),
      topSources: [],
      warnings,
    };
  }

  let policyRequest = admin
    .from("policies")
    .select("id,intermediary_code,intermediary_type,lead_source,issuance_date,created_at,insurance_company_id,policy_product,business_type")
    .not("intermediary_code", "is", null)
    .limit(15000);
  if (accessibleIds !== null) policyRequest = policyRequest.in("intermediary_code", intermediaryCodes);

  const policyResult = await policyRequest.returns<PolicyRow[]>();
  if (policyResult.error) {
    warnings.push("Month-to-date intermediary business could not be refreshed.");
    return { monthLabel, pendingApplications, activeIntermediaries, production: null, topSources: [], warnings };
  }

  const policiesMtd = (policyResult.data ?? []).filter((row) => {
    const effectiveDate = row.issuance_date || row.created_at.slice(0, 10);
    return effectiveDate >= monthStartKey;
  });

  const premiumMap = new Map<string, number>();
  if (options.canViewCommercials && policiesMtd.length) {
    const premiumResult = await admin
      .from("policy_premium_details")
      .select("policy_id,gross_premium")
      .in("policy_id", policiesMtd.map((row) => row.id))
      .returns<PremiumRow[]>();
    if (premiumResult.error) warnings.push("MTD premium figures could not be refreshed.");
    else for (const row of premiumResult.data ?? []) premiumMap.set(row.policy_id, numberValue(row.gross_premium));
  }

  const insurerIds = Array.from(new Set(
    policiesMtd.map((row) => row.insurance_company_id).filter((value): value is string => Boolean(value)),
  ));
  const insurerMap = new Map<string, string>();
  if (insurerIds.length) {
    const insurerResult = await admin
      .from("insurance_companies")
      .select("id,name")
      .in("id", insurerIds)
      .returns<InsurerRow[]>();
    if (insurerResult.error) warnings.push("MTD insurer mix could not be refreshed.");
    else for (const row of insurerResult.data ?? []) insurerMap.set(row.id, row.name);
  }

  const intermediaryByCode = new Map(
    intermediaries
      .filter((row) => row.intermediary_code)
      .map((row) => [row.intermediary_code as string, row]),
  );
  const byType: Record<DistributionType, number> = { partner: 0, posp: 0, misp: 0, other: 0 };
  const sourceMap = new Map<string, SourceAccumulator>();
  const businessTypeCounts = new Map<string, number>();
  const productCounts = new Map<string, number>();
  const insurerCounts = new Map<string, { policies: number; grossPremium: number }>();

  for (const policy of policiesMtd) {
    const code = policy.intermediary_code || "unattributed";
    const intermediary = intermediaryByCode.get(code);
    const type = normalizeType(intermediary?.intermediary_type ?? policy.intermediary_type, code);
    byType[type] += 1;

    const current = sourceMap.get(code) ?? {
      code,
      name: intermediary?.display_name || policy.lead_source || code,
      type,
      policies: 0,
      grossPremium: 0,
    };
    current.policies += 1;
    current.grossPremium += premiumMap.get(policy.id) ?? 0;
    sourceMap.set(code, current);

    increment(businessTypeCounts, cleanLabel(policy.business_type, "Unspecified"));
    increment(productCounts, cleanLabel(policy.policy_product, "Unspecified"));

    if (policy.insurance_company_id) {
      const insurer = insurerCounts.get(policy.insurance_company_id) ?? { policies: 0, grossPremium: 0 };
      insurer.policies += 1;
      insurer.grossPremium += premiumMap.get(policy.id) ?? 0;
      insurerCounts.set(policy.insurance_company_id, insurer);
    }
  }

  const grossPremiumMtd = options.canViewCommercials
    ? Array.from(premiumMap.values()).reduce((sum, value) => sum + value, 0)
    : null;
  const averageGrossPremiumMtd = options.canViewCommercials && policiesMtd.length
    ? (grossPremiumMtd ?? 0) / policiesMtd.length
    : options.canViewCommercials ? 0 : null;

  const topSources = Array.from(sourceMap.values())
    .sort((a, b) => options.canViewCommercials
      ? b.grossPremium - a.grossPremium || b.policies - a.policies
      : b.policies - a.policies || a.name.localeCompare(b.name))
    .slice(0, 6)
    .map((row) => ({
      code: row.code,
      name: row.name,
      type: row.type,
      policies: row.policies,
      grossPremium: options.canViewCommercials ? row.grossPremium : null,
    }));

  const topInsurers = Array.from(insurerCounts.entries())
    .map(([id, value]) => ({
      id,
      name: insurerMap.get(id) || "Insurance company",
      policies: value.policies,
      grossPremium: options.canViewCommercials ? value.grossPremium : null,
    }))
    .sort((a, b) => options.canViewCommercials
      ? (b.grossPremium ?? 0) - (a.grossPremium ?? 0) || b.policies - a.policies
      : b.policies - a.policies || a.name.localeCompare(b.name))
    .slice(0, 5);

  return {
    monthLabel,
    pendingApplications,
    activeIntermediaries,
    production: {
      policiesMtd: policiesMtd.length,
      activeProducersMtd: sourceMap.size,
      grossPremiumMtd,
      averageGrossPremiumMtd,
      byType,
      byBusinessType: rankedCounts(businessTypeCounts, 4),
      byProduct: rankedCounts(productCounts, 4),
      topInsurers,
    },
    topSources,
    warnings,
  };
}

function emptyProduction(canViewCommercials: boolean) {
  return {
    policiesMtd: 0,
    activeProducersMtd: 0,
    grossPremiumMtd: canViewCommercials ? 0 : null,
    averageGrossPremiumMtd: canViewCommercials ? 0 : null,
    byType: { partner: 0, posp: 0, misp: 0, other: 0 } as Record<DistributionType, number>,
    byBusinessType: [] as Array<{ label: string; count: number }>,
    byProduct: [] as Array<{ label: string; count: number }>,
    topInsurers: [] as Array<{ id: string; name: string; policies: number; grossPremium: number | null }>,
  };
}

function normalizeType(value: string | null | undefined, code?: string | null): DistributionType {
  const normalizedCode = (code ?? "").trim().toLowerCase();
  if (normalizedCode.startsWith("misp")) return "misp";
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized.includes("posp")) return "posp";
  if (normalized.includes("misp")) return "misp";
  if (normalized.includes("partner")) return "partner";
  return "other";
}

function cleanLabel(value: string | null | undefined, fallback: string) {
  const label = (value ?? "").trim();
  return label || fallback;
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function rankedCounts(map: Map<string, number>, limit: number) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}