import {
  getAccessibleIntermediaryApplicationIds,
  getAccessibleIntermediaryIds,
} from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ProfileLike = {
  id: string;
  role?: string | null;
};

type IntermediaryRow = {
  id: string;
  intermediary_code: string | null;
  intermediary_type: string | null;
  display_name: string | null;
  account_status: string | null;
};

type ApplicationRow = {
  id: string;
  requested_type: string | null;
  final_type: string | null;
  registration_status: string | null;
};

type PolicyRow = {
  id: string;
  intermediary_code: string | null;
  intermediary_type: string | null;
  lead_source: string | null;
  issuance_date: string | null;
  created_at: string;
};

type PremiumRow = {
  policy_id: string;
  gross_premium: number | string | null;
};

type SourceAccumulator = {
  code: string;
  name: string;
  type: DistributionType;
  policies: number;
  grossPremium: number;
};

export type DistributionType = "partner" | "posp" | "misp" | "other";

export type DistributionAnalytics = {
  network: {
    total: number;
    active: number;
    partner: { total: number; active: number };
    posp: { total: number; active: number };
    misp: { total: number; active: number };
    pendingApplications: number;
  };
  production: {
    policies30d: number;
    grossPremium30d: number | null;
    byType: Record<DistributionType, number>;
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

export async function getDistributionAnalytics(
  profile: ProfileLike | null | undefined,
  options: {
    canViewIntermediaries: boolean;
    canViewProduction: boolean;
    canViewCommercials: boolean;
  },
): Promise<DistributionAnalytics | null> {
  if (!profile?.id || !options.canViewIntermediaries) return null;

  const admin = createSupabaseAdminClient();
  const [accessibleIds, accessibleApplicationIds] = await Promise.all([
    getAccessibleIntermediaryIds(profile.id, profile.role, "view_intermediaries"),
    getAccessibleIntermediaryApplicationIds(profile.id, profile.role, "view_intermediaries"),
  ]);

  let intermediaryRequest = admin
    .from("intermediaries")
    .select("id,intermediary_code,intermediary_type,display_name,account_status")
    .limit(2000);
  if (accessibleIds !== null) {
    intermediaryRequest = accessibleIds.length
      ? intermediaryRequest.in("id", accessibleIds)
      : intermediaryRequest.in("id", ["00000000-0000-0000-0000-000000000000"]);
  }

  let applicationRequest = admin
    .from("intermediary_onboarding_applications")
    .select("id,requested_type,final_type,registration_status")
    .limit(2000);
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
  if (intermediaryResult.error) warnings.push("Distribution network figures could not be refreshed.");
  if (applicationResult.error) warnings.push("Intermediary onboarding figures could not be refreshed.");

  const intermediaries = intermediaryResult.data ?? [];
  const applications = applicationResult.data ?? [];
  const activeRows = intermediaries.filter((row) => row.account_status === "active");

  const network = {
    total: intermediaries.length,
    active: activeRows.length,
    partner: typeCounts(intermediaries, "partner"),
    posp: typeCounts(intermediaries, "posp"),
    misp: typeCounts(intermediaries, "misp"),
    pendingApplications: applications.filter((row) => {
      const status = (row.registration_status ?? "").toLowerCase();
      return !completeRegistrationStatuses.has(status);
    }).length,
  };

  if (!options.canViewProduction) {
    return { network, production: null, topSources: [], warnings };
  }

  const intermediaryCodes = Array.from(new Set(
    intermediaries
      .map((row) => row.intermediary_code)
      .filter((value): value is string => Boolean(value)),
  ));

  if (accessibleIds !== null && !intermediaryCodes.length) {
    return {
      network,
      production: {
        policies30d: 0,
        grossPremium30d: options.canViewCommercials ? 0 : null,
        byType: { partner: 0, posp: 0, misp: 0, other: 0 },
      },
      topSources: [],
      warnings,
    };
  }

  let policyRequest = admin
    .from("policies")
    .select("id,intermediary_code,intermediary_type,lead_source,issuance_date,created_at")
    .not("intermediary_code", "is", null)
    .limit(10000);
  if (accessibleIds !== null) policyRequest = policyRequest.in("intermediary_code", intermediaryCodes);

  const policyResult = await policyRequest.returns<PolicyRow[]>();
  if (policyResult.error) {
    warnings.push("Intermediary production figures could not be refreshed.");
    return { network, production: null, topSources: [], warnings };
  }

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const policies30d = (policyResult.data ?? []).filter((row) => {
    const effectiveDate = row.issuance_date || row.created_at.slice(0, 10);
    return effectiveDate >= cutoffKey;
  });

  const premiumMap = new Map<string, number>();
  if (options.canViewCommercials && policies30d.length) {
    const policyIds = policies30d.map((row) => row.id);
    const premiumResult = await admin
      .from("policy_premium_details")
      .select("policy_id,gross_premium")
      .in("policy_id", policyIds)
      .returns<PremiumRow[]>();
    if (premiumResult.error) {
      warnings.push("Intermediary premium figures could not be refreshed.");
    } else {
      for (const row of premiumResult.data ?? []) premiumMap.set(row.policy_id, numberValue(row.gross_premium));
    }
  }

  const intermediaryByCode = new Map(
    intermediaries
      .filter((row) => row.intermediary_code)
      .map((row) => [row.intermediary_code as string, row]),
  );
  const byType: Record<DistributionType, number> = { partner: 0, posp: 0, misp: 0, other: 0 };
  const sourceMap = new Map<string, SourceAccumulator>();

  for (const policy of policies30d) {
    const code = policy.intermediary_code || "unattributed";
    const intermediary = intermediaryByCode.get(code);
    const type = normalizeType(intermediary?.intermediary_type ?? policy.intermediary_type);
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
  }

  const grossPremium30d = options.canViewCommercials
    ? Array.from(premiumMap.values()).reduce((sum, value) => sum + value, 0)
    : null;

  const topSources = Array.from(sourceMap.values())
    .sort((a, b) => b.policies - a.policies || b.grossPremium - a.grossPremium)
    .slice(0, 5)
    .map((row) => ({
      code: row.code,
      name: row.name,
      type: row.type,
      policies: row.policies,
      grossPremium: options.canViewCommercials ? row.grossPremium : null,
    }));

  return {
    network,
    production: {
      policies30d: policies30d.length,
      grossPremium30d,
      byType,
    },
    topSources,
    warnings,
  };
}

function typeCounts(rows: IntermediaryRow[], type: DistributionType) {
  const matching = rows.filter((row) => normalizeType(row.intermediary_type) === type);
  return {
    total: matching.length,
    active: matching.filter((row) => row.account_status === "active").length,
  };
}

function normalizeType(value: string | null | undefined): DistributionType {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized.includes("posp")) return "posp";
  if (normalized.includes("misp")) return "misp";
  if (normalized.includes("partner")) return "partner";
  return "other";
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
