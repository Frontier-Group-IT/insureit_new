import type { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type LifeHealthCaseSummary = {
  pending: number;
  rejected: number;
  issued: number;
  all: number;
};

export async function loadLifeHealthCaseSummary(admin: AdminClient): Promise<LifeHealthCaseSummary | null> {
  try {
    const [pendingResult, rejectedResult, issuedResult, allResult] = await Promise.all([
      admin.from("life_health_cases").select("id", { count: "exact", head: true }).is("final_policy_id", null).neq("status", "rejected"),
      admin.from("life_health_cases").select("id", { count: "exact", head: true }).eq("status", "rejected").is("final_policy_id", null),
      admin.from("life_health_cases").select("id", { count: "exact", head: true }).not("final_policy_id", "is", null),
      admin.from("life_health_cases").select("id", { count: "exact", head: true }),
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
