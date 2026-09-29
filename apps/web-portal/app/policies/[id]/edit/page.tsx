import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import StandardPolicyEditPage from "./policy-edit-standard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PolicyRouteRow = {
  business_line: string | null;
};

type LifeHealthCaseRouteRow = {
  id: string;
};

/**
 * Route Life/Health policies through their canonical case workspace instead of
 * the Motor edit loader. Life/Health policies legitimately have no vehicle,
 * while the standard Motor edit page requires one.
 */
export default async function EditPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const admin = createSupabaseAdminClient();
  const { data: policy, error } = await admin
    .from("policies")
    .select("business_line")
    .eq("id", resolvedParams.id)
    .maybeSingle<PolicyRouteRow>();

  if (!error && (policy?.business_line === "Life" || policy?.business_line === "Health")) {
    const { data: lifeHealthCase } = await admin
      .from("life_health_cases")
      .select("id")
      .eq("final_policy_id", resolvedParams.id)
      .order("converted_at", { ascending: false })
      .limit(1)
      .maybeSingle<LifeHealthCaseRouteRow>();

    if (lifeHealthCase?.id) {
      redirect(`/policies/life-health-cases/${lifeHealthCase.id}`);
    }

    // Legacy/imported Life/Health policies may not have a source case. They
    // still must open safely rather than being forced through Motor vehicle logic.
    redirect(`/policies/${resolvedParams.id}`);
  }

  return <StandardPolicyEditPage params={Promise.resolve(resolvedParams)} />;
}
