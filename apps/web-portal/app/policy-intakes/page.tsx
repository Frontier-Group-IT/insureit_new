import { AppShell } from "@/components/shell";
import { ItSuperUserDeletePanel } from "@/components/it-super-user-delete-panel";
import { PolicyIntakeWorkspace, type PolicyIntakeWorkspaceRow } from "@/components/policy-intake-workspace";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";
import { requirePolicyIntakeViewer } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PolicyIntakeListRow = Omit<PolicyIntakeWorkspaceRow, "submitted_by_name"> & {
  submitted_by_profile_id: string | null;
  submitted_by_portal_account_id: string | null;
};
type ProfileName = { id: string; full_name: string };
type PortalAccount = { id: string; intermediary_id: string };
type IntermediaryName = { id: string; display_name: string };

export default async function PolicyIntakesPage() {
  const profile = await requirePolicyIntakeViewer();
  const [reviewer, creator] = await Promise.all([
    hasEffectiveCapability(profile, "review_policy_intakes", "edit"),
    hasEffectiveCapability(profile, "create_policy_intakes", "edit"),
  ]);
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("policy_intake_requests")
    .select("id,intake_number,status,lead_source_name,lead_source_type,lead_source_code,customer_mobile,created_at,ocr_status,ocr_fields,file_name,assigned_to_profile_id,submitted_by_profile_id,submitted_by_portal_account_id")
    .order("created_at", { ascending: false })
    .limit(500);
  if (!reviewer) query = query.eq("submitted_by_profile_id", profile.id);
  const { data, error } = await query.returns<PolicyIntakeListRow[]>();

  const rows = data ?? [];
  const profileIds = Array.from(new Set(rows.map((row) => row.submitted_by_profile_id).filter(Boolean) as string[]));
  const portalAccountIds = Array.from(new Set(rows.map((row) => row.submitted_by_portal_account_id).filter(Boolean) as string[]));
  const [{ data: profileRows }, { data: portalAccountRows }] = await Promise.all([
    profileIds.length
      ? admin.from("profiles").select("id,full_name").in("id", profileIds).returns<ProfileName[]>()
      : Promise.resolve({ data: [] as ProfileName[] }),
    portalAccountIds.length
      ? admin.from("intermediary_portal_accounts").select("id,intermediary_id").in("id", portalAccountIds).returns<PortalAccount[]>()
      : Promise.resolve({ data: [] as PortalAccount[] }),
  ]);
  const intermediaryIds = Array.from(new Set((portalAccountRows ?? []).map((account) => account.intermediary_id).filter(Boolean)));
  const { data: intermediaryRows } = intermediaryIds.length
    ? await admin.from("intermediaries").select("id,display_name").in("id", intermediaryIds).returns<IntermediaryName[]>()
    : { data: [] as IntermediaryName[] };
  const profileNameById = new Map((profileRows ?? []).map((item) => [item.id, item.full_name]));
  const portalAccountById = new Map((portalAccountRows ?? []).map((item) => [item.id, item]));
  const intermediaryNameById = new Map((intermediaryRows ?? []).map((item) => [item.id, item.display_name]));

  const duplicateCheck = error ? null : await loadPolicyIntakeDuplicateMatches(admin, rows);
  const workspaceRows: PolicyIntakeWorkspaceRow[] = duplicateCheck?.ok
    ? rows.map((row) => {
        let submittedBy = row.submitted_by_profile_id ? profileNameById.get(row.submitted_by_profile_id)?.trim() || "Sales user" : "INSUREIT Partner user";
        if (row.submitted_by_portal_account_id) {
          const portalAccount = portalAccountById.get(row.submitted_by_portal_account_id);
          const intermediaryName = portalAccount ? intermediaryNameById.get(portalAccount.intermediary_id)?.trim() : "";
          if (intermediaryName) submittedBy = intermediaryName;
        }
        return {
          ...row,
          submitted_by_name: submittedBy,
          status: duplicateCheck.matches.has(row.id) ? "Duplicate" : row.status,
        };
      })
    : [];
  const unavailable = Boolean(error || (duplicateCheck && !duplicateCheck.ok));

  return <AppShell title={reviewer ? "Policy Intakes" : "My Policy Intakes"}>
    {profile.role === "it_super_user" && !unavailable ? <ItSuperUserDeletePanel
      entity="policy_intake"
      title="Delete policy intake record"
      records={workspaceRows.map((intake) => ({
        id: intake.id,
        label: intake.intake_number,
        detail: [intake.status.replaceAll("_", " "), intake.lead_source_name, intake.customer_mobile].filter(Boolean).join(" • "),
      }))}
    /> : null}
    {unavailable ? <div className="mx-auto max-w-[1480px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-700">Policy Intakes are temporarily unavailable.</div> : <PolicyIntakeWorkspace rows={workspaceRows} reviewer={reviewer} creator={creator} currentProfileId={profile.id} />}
  </AppShell>;
}
