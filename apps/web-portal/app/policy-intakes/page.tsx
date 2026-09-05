import { AppShell } from "@/components/shell";
import { PolicyIntakeWorkspace, type PolicyIntakeWorkspaceRow } from "@/components/policy-intake-workspace";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { requirePolicyIntakeViewer } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function intakeField(row: PolicyIntakeWorkspaceRow, key: string) {
  return row.ocr_fields?.find((item) => item.key === key)?.value?.trim() ?? "";
}

function normalizePolicyNumber(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default async function PolicyIntakesPage() {
  const profile = await requirePolicyIntakeViewer();
  const [reviewer, creator] = await Promise.all([
    hasEffectiveCapability(profile, "review_policy_intakes", "edit"),
    hasEffectiveCapability(profile, "create_policy_intakes", "edit"),
  ]);
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("policy_intake_requests")
    .select("id,intake_number,status,lead_source_name,lead_source_type,lead_source_code,customer_mobile,created_at,ocr_status,ocr_fields,file_name,assigned_to_profile_id")
    .order("created_at", { ascending: false })
    .limit(500);
  if (!reviewer) query = query.eq("submitted_by_profile_id", profile.id);
  const { data, error } = await query.returns<PolicyIntakeWorkspaceRow[]>();

  const rows = data ?? [];
  const rawPolicyNumbers = Array.from(new Set(rows.map((row) => intakeField(row, "policy_number")).filter(Boolean)));
  const firstIntakeByPolicyNumber = new Map<string, string>();
  for (const row of [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
    const normalized = normalizePolicyNumber(intakeField(row, "policy_number"));
    if (normalized && !firstIntakeByPolicyNumber.has(normalized)) firstIntakeByPolicyNumber.set(normalized, row.id);
  }

  let registeredPolicyNumbers = new Set<string>();
  if (rawPolicyNumbers.length) {
    const { data: policies } = await admin
      .from("policies")
      .select("policy_code")
      .in("policy_code", rawPolicyNumbers)
      .returns<Array<{ policy_code: string | null }>>();
    registeredPolicyNumbers = new Set((policies ?? []).map((policy) => normalizePolicyNumber(policy.policy_code ?? "")).filter(Boolean));
  }

  const workspaceRows = rows.map((row) => {
    const normalized = normalizePolicyNumber(intakeField(row, "policy_number"));
    if (!normalized || row.status === "completed") return row;
    const duplicateInRegister = registeredPolicyNumbers.has(normalized);
    const duplicateInIntake = firstIntakeByPolicyNumber.get(normalized) !== row.id;
    return duplicateInRegister || duplicateInIntake ? { ...row, status: "Duplicate" } : row;
  });

  return <AppShell title={reviewer ? "Policy Intakes" : "My Policy Intakes"}>
    {error ? <div className="mx-auto max-w-[1480px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-700">Policy Intakes are temporarily unavailable.</div> : <PolicyIntakeWorkspace rows={workspaceRows} reviewer={reviewer} creator={creator} currentProfileId={profile.id} />}
  </AppShell>;
}
