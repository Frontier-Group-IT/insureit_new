import Link from "next/link";
import { ArrowLeft, FolderTree, MoveRight, Plus, UsersRound } from "lucide-react";
import { AppShell } from "@/components/shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { compactPrimaryActionClassName, compactSecondaryActionClassName } from "@/components/action-styles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getIntermediaryGroupEmployeeScope,
  getIntermediaryGroupManager,
  getIntermediaryGroupTransferManager,
  requireIntermediaryGroupViewer,
} from "@/lib/intermediary-group-access";
import {
  archiveIntermediaryGroup,
  assignIntermediaryGroupMembers,
  createIntermediaryGroup,
  removeIntermediaryGroupMembers,
  renameIntermediaryGroup,
  transferIntermediaryGroup,
} from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Query = { success?: string; error?: string };
type Employee = { id: string; employee_code: string; full_name: string; designation: string | null };
type Group = { id: string; group_code: string; group_name: string; owner_employee_id: string; status: string; description: string | null; created_at: string };
type Membership = { id: string; group_id: string; partner_id: string; effective_from: string };
type ParentIntermediary = { id: string; application_id: string | null; intermediary_code: string | null; display_name: string; associate_employee_id: string | null };
type OnboardingOwner = { application_id: string; associate_employee_id: string | null };
type Partner = { id: string; partner_code: string; partner_kind: string; display_name: string; source_application_id: string | null };
type PartnerView = Partner & { parentIntermediary: ParentIntermediary | null; ownerEmployeeId: string };

const successMessages: Record<string, string> = {
  group_created: "Intermediary Group created.",
  group_updated: "Intermediary Group updated.",
  group_archived: "Intermediary Group archived.",
  group_transferred: "Group and its Partner families were transferred to the new sales employee.",
  members_moved: "Partner family moved to the selected Group.",
  members_ungrouped: "Partner family is now ungrouped under the same sales employee.",
};

export default async function IntermediaryGroupsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const profile = await requireIntermediaryGroupViewer();
  const [manager, transferManager, scope] = await Promise.all([
    getIntermediaryGroupManager(),
    getIntermediaryGroupTransferManager(),
    getIntermediaryGroupEmployeeScope(profile),
  ]);
  const canManage = Boolean(manager);
  const canTransfer = Boolean(transferManager);
  const admin = createSupabaseAdminClient();

  let employeeRequest = admin
    .from("employees")
    .select("id,employee_code,full_name,designation")
    .eq("employment_status", "active")
    .order("full_name");
  if (scope.mode !== "organization") {
    employeeRequest = scope.employeeIds.length
      ? employeeRequest.in("id", scope.employeeIds)
      : employeeRequest.in("id", ["00000000-0000-0000-0000-000000000000"]);
  }

  let groupRequest = admin
    .from("intermediary_groups")
    .select("id,group_code,group_name,owner_employee_id,status,description,created_at")
    .eq("status", "active")
    .order("group_name");
  if (scope.mode !== "organization") {
    groupRequest = scope.employeeIds.length
      ? groupRequest.in("owner_employee_id", scope.employeeIds)
      : groupRequest.in("owner_employee_id", ["00000000-0000-0000-0000-000000000000"]);
  }

  const [
    { data: employees },
    { data: parentIntermediaries },
    { data: onboardingOwners },
    { data: partnerRows, error: partnerLoadError },
    { data: groups, error: groupLoadError },
  ] = await Promise.all([
    employeeRequest.returns<Employee[]>(),
    admin
      .from("intermediaries")
      .select("id,application_id,intermediary_code,display_name,associate_employee_id")
      .eq("intermediary_type", "partner")
      .order("display_name")
      .returns<ParentIntermediary[]>(),
    admin
      .from("posp_misp_onboarding_profiles")
      .select("application_id,associate_employee_id")
      .returns<OnboardingOwner[]>(),
    admin
      .from("partners")
      .select("id,partner_code,partner_kind,display_name,source_application_id")
      .order("display_name")
      .returns<Partner[]>(),
    groupRequest.returns<Group[]>(),
  ]);

  const parentByApplication = new Map(
    (parentIntermediaries ?? [])
      .filter((row): row is ParentIntermediary & { application_id: string } => Boolean(row.application_id))
      .map((row) => [row.application_id, row]),
  );
  const onboardingOwnerByApplication = new Map(
    (onboardingOwners ?? []).map((row) => [row.application_id, row.associate_employee_id]),
  );
  const scopedEmployeeIds = new Set(scope.employeeIds);
  const partnerViews: PartnerView[] = (partnerRows ?? []).flatMap((partner) => {
    const sourceApplicationId = partner.source_application_id;
    if (!sourceApplicationId) return [];

    const parentIntermediary = parentByApplication.get(sourceApplicationId) ?? null;
    const ownerEmployeeId = parentIntermediary?.associate_employee_id
      ?? onboardingOwnerByApplication.get(sourceApplicationId)
      ?? null;
    if (!ownerEmployeeId) return [];
    if (scope.mode !== "organization" && !scopedEmployeeIds.has(ownerEmployeeId)) return [];

    return [{ ...partner, parentIntermediary, ownerEmployeeId }];
  });

  const groupIds = (groups ?? []).map((group) => group.id);
  const partnerIds = partnerViews.map((partner) => partner.id);
  const { data: memberships } = groupIds.length && partnerIds.length
    ? await admin
        .from("intermediary_group_memberships")
        .select("id,group_id,partner_id,effective_from")
        .in("group_id", groupIds)
        .in("partner_id", partnerIds)
        .is("effective_to", null)
        .returns<Membership[]>()
    : { data: [] as Membership[] };

  const groupById = new Map((groups ?? []).map((group) => [group.id, group]));
  const membershipByPartner = new Map((memberships ?? []).map((membership) => [membership.partner_id, membership]));
  const partnersByEmployee = new Map<string, PartnerView[]>();
  for (const partner of partnerViews) {
    const list = partnersByEmployee.get(partner.ownerEmployeeId) ?? [];
    list.push(partner);
    partnersByEmployee.set(partner.ownerEmployeeId, list);
  }
  const groupsByEmployee = new Map<string, Group[]>();
  for (const group of groups ?? []) {
    const list = groupsByEmployee.get(group.owner_employee_id) ?? [];
    list.push(group);
    groupsByEmployee.set(group.owner_employee_id, list);
  }

  const visibleEmployees = (employees ?? []).filter((employee) => (partnersByEmployee.get(employee.id)?.length ?? 0) > 0 || (groupsByEmployee.get(employee.id)?.length ?? 0) > 0);
  const groupedCount = (memberships ?? []).length;
  const ungroupedCount = Math.max(partnerViews.length - groupedCount, 0);

  return (
    <AppShell title="Intermediary Groups" backHref="/intermediaries">
      <div className="mx-auto max-w-[1480px] space-y-4 pb-8">
        <section className="overflow-hidden rounded-[24px] border border-[#C9D7E8] bg-[linear-gradient(118deg,#0D2852_0%,#173E7B_56%,#2466AA_100%)] px-5 py-5 text-white shadow-[0_20px_55px_rgba(15,42,85,.18)] sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link href="/intermediaries" className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-white/75 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Intermediaries</Link>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/15"><FolderTree className="h-5 w-5" /></span>
                <div>
                  <h1 className="text-xl font-semibold tracking-[-0.02em]">Intermediary Groups</h1>
                  <p className="mt-1 max-w-3xl text-[10.5px] leading-5 text-white/75">Organize each sales employee&apos;s permanent Partner families into optional Groups. Standalone Partners remain first-class business relationships, and linked POSP/MISP accounts inherit their Partner&apos;s Group automatically.</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-white/15 bg-white/8 backdrop-blur-sm">
              <Metric label="Active Groups" value={(groups ?? []).length} />
              <Metric label="Grouped" value={groupedCount} />
              <Metric label="Ungrouped" value={ungroupedCount} />
            </div>
          </div>
        </section>

        {query.success ? <Notice tone="success" text={successMessages[query.success] ?? "Action completed."} /> : null}
        {query.error ? <Notice tone="error" text={decodeURIComponent(query.error)} /> : null}
        {groupLoadError ? <Notice tone="error" text="The Intermediary Group register could not be loaded. The database migration may not be applied in this environment yet." /> : null}
        {partnerLoadError ? <Notice tone="error" text="The permanent Partner register could not be loaded. Please refresh the page and try again." /> : null}

        {canManage ? (
          <section className="rounded-2xl border border-[#D9E3EF] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-[12px] font-semibold text-[#17365D]">Create Intermediary Group</h2><p className="mt-1 text-[9.5px] text-[#64748B]">A Group sits below one sales employee. Partners can be moved into it after creation.</p></div>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EAF2FF] text-[#3156B8]"><Plus className="h-4 w-4" /></span>
            </div>
            <form action={createIntermediaryGroup} className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_1fr_1.5fr_auto] lg:items-end">
              <Field label="Group name"><input name="group_name" required maxLength={80} placeholder="e.g. Central Fleet Partners" className={inputClass} /></Field>
              <Field label="Sales employee"><select name="owner_employee_id" required defaultValue={profile.employee_id ?? ""} className={inputClass}><option value="">Select employee</option>{(employees ?? []).map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} · {employee.employee_code}</option>)}</select></Field>
              <Field label="Description"><input name="description" maxLength={500} placeholder="Optional internal description" className={inputClass} /></Field>
              <FormSubmitButton label="Create Group" pendingLabel="Creating…" className={compactPrimaryActionClassName} />
            </form>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-end justify-between px-1"><div><h2 className="text-[13px] font-semibold text-[#172B44]">Sales hierarchy</h2><p className="mt-1 text-[9.5px] text-[#64748B]">Employee → Intermediary Group → permanent Partner family. Every permanent Partner appears whether or not it currently has a linked POSP/MISP. “Ungrouped” is virtual and does not create a database Group.</p></div></div>

          {visibleEmployees.length ? visibleEmployees.map((employee) => {
            const employeePartners = partnersByEmployee.get(employee.id) ?? [];
            const employeeGroups = groupsByEmployee.get(employee.id) ?? [];
            const ungrouped = employeePartners.filter((partner) => !membershipByPartner.has(partner.id));
            return (
              <EmployeeTree
                key={employee.id}
                employee={employee}
                partners={employeePartners}
                groups={employeeGroups}
                memberships={memberships ?? []}
                membershipByPartner={membershipByPartner}
                groupById={groupById}
                allEmployees={employees ?? []}
                canManage={canManage}
                canTransfer={canTransfer}
                ungrouped={ungrouped}
              />
            );
          }) : (
            <div className="rounded-2xl border border-dashed border-[#CBD7E6] bg-white/70 px-6 py-16 text-center"><UsersRound className="mx-auto h-7 w-7 text-[#8A9AAF]" /><p className="mt-3 text-[12px] font-semibold text-[#334155]">No assigned Partner families in your scope</p><p className="mt-1 text-[9.5px] text-[#718096]">Groups become available when permanent Partners have a sales employee assignment.</p></div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function EmployeeTree({ employee, partners, groups, memberships, membershipByPartner, groupById, allEmployees, canManage, canTransfer, ungrouped }: {
  employee: Employee;
  partners: PartnerView[];
  groups: Group[];
  memberships: Membership[];
  membershipByPartner: Map<string, Membership>;
  groupById: Map<string, Group>;
  allEmployees: Employee[];
  canManage: boolean;
  canTransfer: boolean;
  ungrouped: PartnerView[];
}) {
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
  return (
    <article className="overflow-hidden rounded-2xl border border-[#D9E3EF] bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-[#E5ECF4] bg-[#F8FAFD] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#17365D] text-[10px] font-bold text-white">{initials(employee.full_name)}</span><div><h3 className="text-[11.5px] font-semibold text-[#17365D]">{employee.full_name}</h3><p className="text-[8.5px] text-[#718096]">{employee.designation ?? "Sales employee"} · {employee.employee_code}</p></div></div></div>
        <div className="flex gap-2 text-[9px]"><Stat label="Partners" value={partners.length} /><Stat label="Groups" value={groups.length} /><Stat label="Ungrouped" value={ungrouped.length} /></div>
      </header>

      <div className="grid gap-3 p-3 xl:grid-cols-2">
        {groups.map((group) => {
          const groupMemberships = memberships.filter((membership) => membership.group_id === group.id);
          const members = groupMemberships.map((membership) => partnerById.get(membership.partner_id)).filter((partner): partner is PartnerView => Boolean(partner));
          const alternatives = groups.filter((candidate) => candidate.id !== group.id);
          return (
            <section key={group.id} className="overflow-hidden rounded-xl border border-[#DCE5EF] bg-white">
              <div className="border-b border-[#E8EEF5] bg-[linear-gradient(90deg,#F5F8FD,#FBFCFE)] px-3.5 py-3">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#55708F]">{group.group_code}</p><h4 className="mt-1 text-[11.5px] font-semibold text-[#17365D]">{group.group_name}</h4>{group.description ? <p className="mt-1 text-[8.5px] text-[#718096]">{group.description}</p> : null}</div><span className="rounded-full bg-[#EAF2FF] px-2 py-1 text-[8px] font-bold text-[#3156B8]">{members.length} members</span></div>
                {canManage ? <details className="mt-3"><summary className="cursor-pointer text-[8.5px] font-semibold text-[#52677F]">Manage Group</summary><div className="mt-2 space-y-2 rounded-xl border border-[#E2E8F0] bg-white p-2.5"><form action={renameIntermediaryGroup} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input type="hidden" name="group_id" value={group.id} /><input name="group_name" defaultValue={group.group_name} required maxLength={80} className={smallInputClass} /><input name="description" defaultValue={group.description ?? ""} placeholder="Description" className={smallInputClass} /><FormSubmitButton label="Save" pendingLabel="Saving…" className={compactSecondaryActionClassName} /></form>{canTransfer ? <form action={transferIntermediaryGroup} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input type="hidden" name="group_id" value={group.id} /><select name="new_owner_employee_id" defaultValue="" required className={smallInputClass}><option value="">Transfer to employee…</option>{allEmployees.filter((candidate) => candidate.id !== employee.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.full_name} · {candidate.employee_code}</option>)}</select><input name="reason" placeholder="Transfer reason" className={smallInputClass} /><FormSubmitButton label="Transfer Group" pendingLabel="Transferring…" className={compactSecondaryActionClassName} /></form> : null}{members.length === 0 ? <form action={archiveIntermediaryGroup}><input type="hidden" name="group_id" value={group.id} /><FormSubmitButton label="Archive empty Group" pendingLabel="Archiving…" className="inline-flex h-8 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-[8.5px] font-semibold text-red-700 hover:bg-red-100" /></form> : null}</div></details> : null}
              </div>

              <div className="divide-y divide-[#EDF1F5]">
                {members.length ? members.map((partner) => <PartnerRow key={partner.id} partner={partner} currentGroup={group} alternatives={alternatives} canManage={canManage} />) : <p className="px-3.5 py-6 text-center text-[9px] text-[#8795A6]">No Partner families in this Group yet.</p>}
              </div>
            </section>
          );
        })}

        <section className="overflow-hidden rounded-xl border border-dashed border-[#BCCBDB] bg-[#FBFCFE]">
          <div className="flex items-center justify-between border-b border-dashed border-[#D7E0EA] px-3.5 py-3"><div><p className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#77889B]">Virtual bucket</p><h4 className="mt-1 text-[11.5px] font-semibold text-[#475569]">Ungrouped</h4></div><span className="rounded-full bg-[#EEF2F6] px-2 py-1 text-[8px] font-bold text-[#5F7082]">{ungrouped.length}</span></div>
          <div className="divide-y divide-[#EDF1F5]">{ungrouped.length ? ungrouped.map((partner) => <PartnerRow key={partner.id} partner={partner} currentGroup={null} alternatives={groups} canManage={canManage} />) : <p className="px-3.5 py-6 text-center text-[9px] text-[#8795A6]">Every Partner family is assigned to a Group.</p>}</div>
        </section>
      </div>
    </article>
  );
}

function PartnerRow({ partner, currentGroup, alternatives, canManage }: { partner: PartnerView; currentGroup: Group | null; alternatives: Group[]; canManage: boolean }) {
  const registrationCode = partner.parentIntermediary?.intermediary_code;
  return (
    <div className="px-3.5 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[10.5px] font-semibold text-[#263F5D]">{partner.display_name}</p><span className="rounded-full bg-[#F0F4F8] px-2 py-0.5 text-[7.5px] font-bold uppercase text-[#617286]">{partner.partner_kind === "business" ? "Business Partner" : "Individual Partner"}</span></div><p className="mt-1 text-[8.5px] text-[#718096]">{partner.partner_code}{registrationCode && registrationCode !== partner.partner_code ? ` · ${registrationCode}` : ""}</p></div>
        {canManage ? <div className="flex flex-wrap items-center gap-1.5">{alternatives.length ? <form action={assignIntermediaryGroupMembers} className="flex items-center gap-1.5"><input type="hidden" name="partner_id" value={partner.id} /><select name="group_id" defaultValue="" required className="h-8 min-w-[130px] rounded-lg border border-[#D5DFEA] bg-white px-2 text-[8.5px] text-[#44576D]"><option value="">Move to Group…</option>{alternatives.map((group) => <option key={group.id} value={group.id}>{group.group_name}</option>)}</select><button type="submit" className="grid h-8 w-8 place-items-center rounded-lg border border-[#D5DFEA] bg-white text-[#3156B8] hover:bg-[#F4F7FB]" title="Move Partner"><MoveRight className="h-3.5 w-3.5" /></button></form> : null}{currentGroup ? <form action={removeIntermediaryGroupMembers}><input type="hidden" name="partner_id" value={partner.id} /><button type="submit" className="h-8 rounded-lg border border-[#D5DFEA] bg-white px-2.5 text-[8px] font-semibold text-[#5F7082] hover:bg-[#F4F7FB]">Ungroup</button></form> : null}</div> : null}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="min-w-[92px] border-r border-white/12 px-3 py-2.5 text-center last:border-r-0"><p className="text-lg font-semibold">{value}</p><p className="mt-0.5 text-[7.5px] font-semibold uppercase tracking-[0.06em] text-white/65">{label}</p></div>; }
function Stat({ label, value }: { label: string; value: number }) { return <span className="rounded-lg border border-[#DCE5EF] bg-white px-2.5 py-1.5"><b className="text-[#17365D]">{value}</b> <span className="text-[#77889A]">{label}</span></span>; }
function Notice({ tone, text }: { tone: "success" | "error"; text: string }) { return <div className={`rounded-xl border px-4 py-3 text-[10px] font-medium ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{text}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[8.5px] font-bold uppercase tracking-[0.05em] text-[#64748B]">{label}</span>{children}</label>; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SE"; }

const inputClass = "h-10 w-full rounded-xl border border-[#D5DFEA] bg-white px-3 text-[10px] text-[#243B55] outline-none focus:border-[#7F92C9] focus:ring-2 focus:ring-[#E8EDFF]";
const smallInputClass = "h-8 w-full rounded-lg border border-[#D5DFEA] bg-white px-2.5 text-[8.5px] text-[#44576D] outline-none focus:border-[#7F92C9]";
