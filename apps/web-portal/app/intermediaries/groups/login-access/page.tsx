import Link from "next/link";

import { EmailCooldownNotice, LoginAccessActionButton } from "./login-access-action-button";

import { AppShell } from "@/components/shell";
import {
  getIntermediaryGroupEmployeeScope,
  requireIntermediaryGroupManager,
} from "@/lib/intermediary-group-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

import {
  createGroupBranchPortalLogin,
  resendGroupBranchPortalInvite,
  sendGroupBranchPortalPasswordReset,
  setGroupBranchPortalLoginStatus,
} from "../group-branch-login-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Query = { success?: string; error?: string; error_code?: string; retry_after?: string; cooldown_until?: string; cooldown_entity_type?: string; cooldown_entity_id?: string };
type AccessRow = {
  profile_id: string;
  entity_type: "group" | "branch";
  entity_id: string;
  status: "active" | "disabled";
  login_email: string;
  updated_at: string;
};
type GroupRow = {
  id: string;
  group_code: string;
  group_name: string;
  group_mode: string | null;
  owner_employee_id: string | null;
  created_by: string | null;
};
type PartnerRow = {
  id: string;
  partner_code: string;
  display_name: string;
  partner_status: string;
  source_application_id: string | null;
  parent_partner_id: string | null;
};
type BranchProfileRow = { partner_id: string; created_by: string | null };
type MembershipRow = { group_id: string; partner_id: string };
type ParentIntermediaryRow = { application_id: string | null; associate_employee_id: string | null };
type OnboardingOwnerRow = { application_id: string; associate_employee_id: string | null };

type EntityRow = {
  entityType: "group" | "branch";
  id: string;
  code: string;
  name: string;
  context: string;
};

export default async function GroupBranchLoginAccessPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const manager = await requireIntermediaryGroupManager();
  const scope = await getIntermediaryGroupEmployeeScope(manager);
  const admin = createSupabaseAdminClient();

  const [
    { data: groups },
    { data: partners },
    { data: branchProfiles },
    { data: memberships },
    { data: parentIntermediaries },
    { data: onboardingOwners },
    { data: accessRows, error: accessError },
  ] = await Promise.all([
    admin.from("intermediary_groups")
      .select("id,group_code,group_name,group_mode,owner_employee_id,created_by")
      .eq("status", "active")
      .order("group_name")
      .returns<GroupRow[]>(),
    admin.from("partners")
      .select("id,partner_code,display_name,partner_status,source_application_id,parent_partner_id")
      .eq("partner_status", "active_partner")
      .order("display_name")
      .returns<PartnerRow[]>(),
    admin.from("partner_branch_profiles").select("partner_id,created_by").returns<BranchProfileRow[]>(),
    admin.from("intermediary_group_memberships")
      .select("group_id,partner_id")
      .is("effective_to", null)
      .returns<MembershipRow[]>(),
    admin.from("intermediaries")
      .select("application_id,associate_employee_id")
      .eq("intermediary_type", "partner")
      .returns<ParentIntermediaryRow[]>(),
    admin.from("posp_misp_onboarding_profiles")
      .select("application_id,associate_employee_id")
      .returns<OnboardingOwnerRow[]>(),
    admin.from("portal_access_identities")
      .select("profile_id,entity_type,entity_id,status,login_email,updated_at")
      .order("updated_at", { ascending: false })
      .returns<AccessRow[]>(),
  ]);

  const authStateEntries = await Promise.all((accessRows ?? []).map(async (row) => {
    const { data, error } = await admin.auth.admin.getUserById(row.profile_id);
    return [row.profile_id, { exists: !error && Boolean(data.user), hasSignedIn: Boolean(data.user?.last_sign_in_at) }] as const;
  }));
  const authStateByProfile = new Map(authStateEntries);

  const accessByEntity = new Map((accessRows ?? []).map((row) => [`${row.entity_type}:${row.entity_id}`, row]));
  const branchProfileById = new Map((branchProfiles ?? []).map((row) => [row.partner_id, row]));
  const partnerById = new Map((partners ?? []).map((row) => [row.id, row]));
  const parentOwnerByApplication = new Map(
    (parentIntermediaries ?? []).filter((row) => Boolean(row.application_id)).map((row) => [row.application_id as string, row.associate_employee_id]),
  );
  const onboardingOwnerByApplication = new Map((onboardingOwners ?? []).map((row) => [row.application_id, row.associate_employee_id]));
  const allowedEmployees = new Set(scope.employeeIds);

  const rootOwnerByPartner = new Map<string, string | null>();
  for (const partner of partners ?? []) {
    if (partner.parent_partner_id) continue;
    const applicationId = partner.source_application_id;
    rootOwnerByPartner.set(
      partner.id,
      applicationId
        ? parentOwnerByApplication.get(applicationId) ?? onboardingOwnerByApplication.get(applicationId) ?? null
        : null,
    );
  }

  const visibleRootPartnerIds = new Set(
    (partners ?? [])
      .filter((row) => !row.parent_partner_id)
      .filter((row) => scope.mode === "organization" || Boolean(rootOwnerByPartner.get(row.id) && allowedEmployees.has(rootOwnerByPartner.get(row.id) as string)))
      .map((row) => row.id),
  );

  const visibleMembershipGroupIds = new Set(
    (memberships ?? []).filter((row) => visibleRootPartnerIds.has(row.partner_id)).map((row) => row.group_id),
  );

  const entities: EntityRow[] = [];
  for (const group of groups ?? []) {
    const visible = scope.mode === "organization"
      || ((group.group_mode ?? "legacy_employee") === "legacy_employee" && Boolean(group.owner_employee_id && allowedEmployees.has(group.owner_employee_id)))
      || ((group.group_mode ?? "legacy_employee") === "business" && (group.created_by === manager.id || visibleMembershipGroupIds.has(group.id)));
    if (!visible) continue;
    const memberCount = (memberships ?? []).filter((row) => row.group_id === group.id).length;
    entities.push({
      entityType: "group",
      id: group.id,
      code: group.group_code,
      name: group.group_name,
      context: `${memberCount} active Partner${memberCount === 1 ? "" : "s"}`,
    });
  }

  for (const branch of partners ?? []) {
    const branchProfile = branchProfileById.get(branch.id);
    if (!branchProfile) continue;
    const parent = branch.parent_partner_id ? partnerById.get(branch.parent_partner_id) ?? null : null;
    const visible = scope.mode === "organization"
      || Boolean(parent?.id && visibleRootPartnerIds.has(parent.id))
      || branchProfile.created_by === manager.id;
    if (!visible) continue;
    entities.push({
      entityType: "branch",
      id: branch.id,
      code: branch.partner_code,
      name: branch.display_name,
      context: parent ? `Parent: ${parent.display_name}` : "Unassigned Branch",
    });
  }

  const migrationMissing = Boolean(accessError && /relation .*portal_access_identities.* does not exist|schema cache/i.test(accessError.message));
  const parsedCooldownUntil = Number(query.cooldown_until ?? "0");
  const activeCooldownUntil = Number.isFinite(parsedCooldownUntil) && parsedCooldownUntil > Date.now() ? parsedCooldownUntil : 0;
  const cooldownEntityKey = query.cooldown_entity_type && query.cooldown_entity_id
    ? `${query.cooldown_entity_type}:${query.cooldown_entity_id}`
    : "";
  const cooldownRemaining = activeCooldownUntil ? Math.max(0, Math.ceil((activeCooldownUntil - Date.now()) / 1000)) : 0;

  return (
    <AppShell title="Group / Branch Login Access" backHref="/intermediaries/groups">
      <div className="mx-auto max-w-[1480px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div>
            <h1 className="text-base font-semibold text-slate-900">Portal Login Access</h1>
            <p className="mt-0.5 text-xs text-slate-500">Manage Group and Branch invitations. New Groups are invited during creation; existing records can be invited here. Existing Partner logins are unchanged.</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Link href="/intermediaries/groups" className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">Groups</Link>
            <Link href="/intermediaries/groups/branches" className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">Branches</Link>
          </div>
        </div>

        {query.success ? <Notice tone="success">{successMessage(query.success)}</Notice> : null}
        {query.error_code === "email_cooldown" && activeCooldownUntil ? <EmailCooldownNotice cooldownUntil={activeCooldownUntil} initialRemaining={cooldownRemaining} /> : null}
        {query.error ? <Notice tone="error">{friendlyErrorMessage(query.error)}</Notice> : null}
        {migrationMissing ? (
          <Notice tone="warning">The additive Group/Branch login migration has not been applied in this environment yet. Existing hierarchy screens remain available, but login provisioning is disabled.</Notice>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(240px,1.5fr)_minmax(160px,.75fr)_minmax(220px,1fr)_minmax(320px,1.35fr)] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Group / Branch</span><span>Status</span><span>Login ID</span><span>Actions</span>
          </div>
          {entities.length ? entities.map((entity) => {
            const mapping = accessByEntity.get(`${entity.entityType}:${entity.id}`) ?? null;
            const authState = mapping ? authStateByProfile.get(mapping.profile_id) : null;
            const invitationPending = Boolean(mapping && mapping.status === "active" && authState?.exists && !authState.hasSignedIn);
            const active = Boolean(mapping && mapping.status === "active" && authState?.hasSignedIn);
            const statusLabel = !mapping ? "No Access" : mapping.status === "disabled" ? "Disabled" : invitationPending ? "Invitation Sent" : active ? "Active" : "Access Issue";
            const entityCooldownUntil = cooldownEntityKey === `${entity.entityType}:${entity.id}` ? activeCooldownUntil : 0;
            const statusClass = !mapping
              ? "bg-slate-100 text-slate-600"
              : mapping.status === "disabled"
                ? "bg-amber-50 text-amber-700"
                : invitationPending
                  ? "bg-blue-50 text-blue-700"
                  : active
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700";

            return (
              <div key={`${entity.entityType}:${entity.id}`} className="grid grid-cols-[minmax(240px,1.5fr)_minmax(160px,.75fr)_minmax(220px,1fr)_minmax(320px,1.35fr)] gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">{entity.entityType}</span>
                    <span className="truncate text-sm font-semibold text-slate-900">{entity.name}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{entity.code} · {entity.context}</p>
                </div>
                <div className="self-center">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
                </div>
                <div className="self-center truncate text-sm text-slate-700">{mapping?.login_email ?? "—"}</div>
                <div className="self-center">
                  {!mapping ? (
                    <form action={createGroupBranchPortalLogin} className="grid grid-cols-[minmax(140px,1fr)_minmax(115px,.8fr)_auto] gap-2">
                      <input type="hidden" name="entity_type" value={entity.entityType} />
                      <input type="hidden" name="entity_id" value={entity.id} />
                      <input name="login_email" type="email" required disabled={migrationMissing} placeholder="Login email" autoComplete="email" className="min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-slate-400 disabled:bg-slate-50" />
                      <input name="phone" type="tel" required disabled={migrationMissing} placeholder="Phone" autoComplete="tel" className="min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-slate-400 disabled:bg-slate-50" />
                      <LoginAccessActionButton
                        label="Send Invitation"
                        cooldownLabel="Send"
                        cooldownUntil={entityCooldownUntil}
                        initialRemaining={entityCooldownUntil ? cooldownRemaining : 0}
                        disabled={migrationMissing}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {mapping.status === "active" && invitationPending ? (
                        <form action={resendGroupBranchPortalInvite}>
                          <input type="hidden" name="entity_type" value={entity.entityType} />
                          <input type="hidden" name="entity_id" value={entity.id} />
                          <LoginAccessActionButton
                            label="Resend Invitation"
                            cooldownLabel="Resend"
                            cooldownUntil={entityCooldownUntil}
                            initialRemaining={entityCooldownUntil ? cooldownRemaining : 0}
                            className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </form>
                      ) : null}
                      {mapping.status === "active" && active ? (
                        <form action={sendGroupBranchPortalPasswordReset}>
                          <input type="hidden" name="entity_type" value={entity.entityType} />
                          <input type="hidden" name="entity_id" value={entity.id} />
                          <LoginAccessActionButton
                            label="Reset Password"
                            cooldownLabel="Reset"
                            cooldownUntil={entityCooldownUntil}
                            initialRemaining={entityCooldownUntil ? cooldownRemaining : 0}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </form>
                      ) : null}
                      <form action={setGroupBranchPortalLoginStatus}>
                        <input type="hidden" name="entity_type" value={entity.entityType} />
                        <input type="hidden" name="entity_id" value={entity.id} />
                        <input type="hidden" name="next_status" value={mapping.status === "active" ? "disabled" : "active"} />
                        <button className={`rounded-lg px-3 py-2 text-xs font-semibold ${mapping.status === "active" ? "border border-rose-200 text-rose-700 hover:bg-rose-50" : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>
                          {mapping.status === "active" ? "Disable Login" : "Enable Login"}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            );
          }) : (
            <div className="px-4 py-10 text-center text-sm text-slate-500">No manageable Groups or Branches are available.</div>
          )}
        </div>

        <p className="px-1 text-xs text-slate-500">Invitations and password resets are sent by email so the Group or Branch user chooses their own password; administrators never create or see it. Disabling a login does not modify hierarchy or business records.</p>
      </div>
    </AppShell>
  );
}

function Notice({ tone, children }: { tone: "success" | "error" | "warning"; children: React.ReactNode }) {
  const style = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${style}`}>{children}</div>;
}

function successMessage(event: string) {
  if (event === "portal_invite_sent") return "Portal invitation sent successfully.";
  if (event === "portal_invite_resent") return "Portal invitation sent again.";
  if (event === "portal_password_email_sent") return "Password reset email sent successfully.";
  if (event === "portal_login_enabled") return "Portal login enabled.";
  if (event === "portal_login_disabled") return "Portal login disabled. The business hierarchy was not changed.";
  return "Portal login access updated.";
}


function friendlyErrorMessage(message: string) {
  const match = message.match(/after\s+(\d+)\s+seconds?/i);
  if (match) {
    return `An authentication email was sent recently. Please wait ${match[1]} seconds before trying again.`;
  }
  return message;
}
