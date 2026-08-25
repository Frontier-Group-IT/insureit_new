import { AppShell } from "@/components/shell";
import { PolicyIntakeWorkspace, type PolicyIntakeWorkspaceRow } from "@/components/policy-intake-workspace";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { requirePolicyIntakeViewer } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PolicyIntakesPage() {
  const profile = await requirePolicyIntakeViewer();
  const [reviewer, creator] = await Promise.all([
    hasEffectiveCapability(profile, "review_policy_intakes", "edit"),
    hasEffectiveCapability(profile, "create_policy_intakes", "edit"),
  ]);
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("policy_intake_requests")
    .select("id,intake_number,status,lead_source_name,lead_source_type,lead_source_code,customer_mobile,created_at,ocr_status,ocr_fields,file_name")
    .order("created_at", { ascending: false })
    .limit(500);
  if (!reviewer) query = query.eq("submitted_by_profile_id", profile.id);
  const { data, error } = await query.returns<PolicyIntakeWorkspaceRow[]>();

  return <AppShell title={reviewer ? "Policy Intakes" : "My Policy Intakes"}>
    {error ? <div className="mx-auto max-w-[1480px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-700">Policy Intakes are temporarily unavailable.</div> : <PolicyIntakeWorkspace rows={data ?? []} reviewer={reviewer} creator={creator} />}
  </AppShell>;
}
