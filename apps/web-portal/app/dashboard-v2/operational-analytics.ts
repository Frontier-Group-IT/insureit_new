import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AnalyticsProfile = {
  id: string;
  role?: string | null;
};

export type DashboardV2Analytics = {
  renewal: {
    expired: number;
    due0to7: number;
    due8to15: number;
    due16to30: number;
    due31to45: number;
    beyond45: number;
  } | null;
  claimAging: {
    under3: number;
    days3to7: number;
    days8to15: number;
    days16to30: number;
    over30: number;
  } | null;
  warnings: string[];
};

const closedClaimStatuses = ["Claim Complete", "Settled", "Closed"];

export async function getDashboardV2Analytics(
  profile: AnalyticsProfile | null | undefined,
  options: { policies: boolean; claims: boolean },
): Promise<DashboardV2Analytics> {
  if (!profile?.id) return { renewal: null, claimAging: null, warnings: [] };

  const admin = createSupabaseAdminClient();
  const [policyCustomerIds, claimCustomerIds] = await Promise.all([
    options.policies ? getAccessibleCustomerIds(profile.id, profile.role, "view_policies") : Promise.resolve([]),
    options.claims ? getAccessibleCustomerIds(profile.id, profile.role, "view_claims") : Promise.resolve([]),
  ]);

  const policyRequest = options.policies && policyCustomerIds?.length !== 0
    ? (() => {
        let query = admin.from("policies").select("id,end_date");
        if (policyCustomerIds !== null) query = query.in("customer_id", policyCustomerIds);
        return query.returns<Array<{ id: string; end_date: string }>>();
      })()
    : Promise.resolve({ data: [] as Array<{ id: string; end_date: string }>, error: null });

  const claimRequest = options.claims && claimCustomerIds?.length !== 0
    ? (() => {
        let query = admin.from("claims").select("id,current_status,created_at");
        if (claimCustomerIds !== null) query = query.in("customer_id", claimCustomerIds);
        return query.returns<Array<{ id: string; current_status: string; created_at: string }>>();
      })()
    : Promise.resolve({ data: [] as Array<{ id: string; current_status: string; created_at: string }>, error: null });

  const [policies, claims] = await Promise.all([policyRequest, claimRequest]);
  const warnings = [
    policies.error ? "Renewal aging could not be refreshed." : null,
    claims.error ? "Claim aging could not be refreshed." : null,
  ].filter(Boolean) as string[];

  const now = new Date();
  const today = dateKey(now);
  const plus7 = dateKey(addDays(now, 7));
  const plus15 = dateKey(addDays(now, 15));
  const plus30 = dateKey(addDays(now, 30));
  const plus45 = dateKey(addDays(now, 45));
  const policyRows = policies.data ?? [];

  const renewal = options.policies && !policies.error ? {
    expired: policyRows.filter((row) => row.end_date < today).length,
    due0to7: policyRows.filter((row) => row.end_date >= today && row.end_date <= plus7).length,
    due8to15: policyRows.filter((row) => row.end_date > plus7 && row.end_date <= plus15).length,
    due16to30: policyRows.filter((row) => row.end_date > plus15 && row.end_date <= plus30).length,
    due31to45: policyRows.filter((row) => row.end_date > plus30 && row.end_date <= plus45).length,
    beyond45: policyRows.filter((row) => row.end_date > plus45).length,
  } : null;

  const openClaims = (claims.data ?? []).filter((row) => !closedClaimStatuses.includes(row.current_status));
  const claimAging = options.claims && !claims.error ? {
    under3: openClaims.filter((row) => ageDays(row.created_at, now) < 3).length,
    days3to7: openClaims.filter((row) => between(ageDays(row.created_at, now), 3, 7)).length,
    days8to15: openClaims.filter((row) => between(ageDays(row.created_at, now), 8, 15)).length,
    days16to30: openClaims.filter((row) => between(ageDays(row.created_at, now), 16, 30)).length,
    over30: openClaims.filter((row) => ageDays(row.created_at, now) > 30).length,
  } : null;

  return { renewal, claimAging, warnings };
}

function between(value: number, min: number, max: number) {
  return value >= min && value <= max;
}

function ageDays(value: string, now: Date) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((now.getTime() - time) / 86400000));
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
