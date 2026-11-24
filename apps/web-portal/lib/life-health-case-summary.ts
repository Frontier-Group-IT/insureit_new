import type { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type LifeHealthCaseSummary = {
  pending: number;
  rejected: number;
  issued: number;
  all: number;
};

export async function loadLifeHealthCaseSummary(admin: AdminClient, scopeFilter: string | null = null): Promise<LifeHealthCaseSummary | null> {
  try {
    const scoped = () => {
      const query = admin.from("life_health_cases").select("id", { count: "exact", head: true });
      return scopeFilter === null ? query : query.or(scopeFilter || "id.eq.00000000-0000-0000-0000-000000000000");
    };
    const [pendingResult, rejectedResult, issuedResult, allResult] = await Promise.all([
      scoped().is("final_policy_id", null).neq("status", "rejected"),
      scoped().eq("status", "rejected").is("final_policy_id", null),
      scoped().not("final_policy_id", "is", null),
      scoped(),
    ]);

    if (pendingResult.error || rejectedResult.error || issuedResult.error || allResult.error) return null;

    return {
      pending: pendingResult.count ?? 0,
      rejected: rejectedResult.count ?? 0,
      issued: issuedResult.count ?? 0,
      all: allResult.count ?? 0,
    };
  } catch {
    return null;
  }
}
