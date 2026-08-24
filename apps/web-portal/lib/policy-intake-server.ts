import { getAccessibleIntermediaryIds } from "@/lib/employee-access-scope";
import { requireAnyCapability, requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PolicyIntakeSource = {
  id: string;
  intermediary_type: "posp" | "misp" | "partner";
  display_name: string;
  intermediary_code: string | null;
};

export async function requirePolicyIntakeCreator() {
  return requireCapability("create_policy_intakes", "edit");
}

export async function requirePolicyIntakeViewer() {
  return requireAnyCapability([
    { capability: "view_policy_intakes" },
    { capability: "review_policy_intakes", minimumAccess: "edit" },
  ]);
}

export async function requirePolicyIntakeReviewer() {
  return requireCapability("review_policy_intakes", "edit");
}

export async function loadEligiblePolicyIntakeSources(profile: { id: string; role: string | null }) {
  const admin = createSupabaseAdminClient();
  const ids = await getAccessibleIntermediaryIds(profile.id, profile.role, "view_intermediaries");
  if (ids !== null && !ids.length) return [] as PolicyIntakeSource[];

  let query = admin
    .from("intermediaries")
    .select("id,intermediary_type,display_name,intermediary_code")
    .in("intermediary_type", ["posp", "misp", "partner"])
    .eq("account_status", "active")
    .order("display_name", { ascending: true });
  if (ids !== null) query = query.in("id", ids);

  const { data, error } = await query.returns<PolicyIntakeSource[]>();
  if (error) throw new Error("policy_intake_sources_unavailable");
  return (data ?? []).filter((item) => item.display_name?.trim());
}
