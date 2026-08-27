"use client";

import { useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowRightLeft,
  ChevronDown,
  Folder,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  archiveIntermediaryGroup,
  assignIntermediaryGroupMembers,
  createIntermediaryGroup,
  removeIntermediaryGroupMembers,
  renameIntermediaryGroup,
  transferIntermediaryGroup,
} from "./actions";

export type GroupWorkspaceEmployee = {
  id: string;
  employee_code: string;
  full_name: string;
  designation: string | null;
};

export type GroupWorkspaceGroup = {
  id: string;
  group_code: string;
  group_name: string;
  owner_employee_id: string;
  status: string;
  description: string | null;
  created_at: string;
};

export type GroupWorkspaceMembership = {
  id: string;
  group_id: string;
  partner_id: string;
  effective_from: string;
};

export type GroupWorkspacePartner = {
  id: string;
  partner_code: string;
  partner_kind: string;
  display_name: string;
  source_application_id: string | null;
  owner_employee_id: string;
  registration_code: string | null;
};

type AssignmentFilter = "all" | "grouped" | "ungrouped";

const successMessages: Record<string, string> = {
  group_created: "Intermediary Group created.",
  group_updated: "Intermediary Group updated.",
  group_archived: "Intermediary Group archived.",
  group_transferred: "Group and its Partner families were transferred to the new sales employee.",
  members_moved: "Partner family moved to the selected Group.",
  members_ungrouped: "Partner family is now ungrouped under the same sales employee.",
};

export function IntermediaryGroupWorkspace({
  employees,
  groups,
  partners,
  memberships,
  canManage,
  canTransfer,
  defaultOwnerEmployeeId,
  success,
  error,
  loadError,
}: {
  employees: GroupWorkspaceEmployee[];
  groups: GroupWorkspaceGroup[];
  partners: GroupWorkspacePartner[];
  memberships: GroupWorkspaceMembership[];
  canManage: boolean;
  canTransfer: boolean;
  defaultOwnerEmployeeId: string;
  success?: string;
  error?: string;
  loadError: boolean;
}) {
  const [query, setQuery] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
  const [openEmployees, setOpenEmployees] = useState<Set<string>>(() => new Set(employees.map((employee) => employee.id)));
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerGroupId, setDrawerGroupId] = useState<string | null>(null);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<Set<string>>(new Set());
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [bulkGroupId, setBulkGroupId] = useState("");
  const [dragPartnerId, setDragPartnerId] = useState<string | null>(null);
  const [dropGroupId, setDropGroupId] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ partnerId: string; groupId: string } | null>(null);
  const dropFormRef = useRef<HTMLFormElement>(null);

  const membershipByPartner = useMemo(
    () => new Map(memberships.map((membership) => [membership.partner_id, membership])),
    [memberships],
  );
  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const normalizedQuery = query.trim().toLowerCase();

  const visibleEmployees = useMemo(() => {
    return employees.filter((employee) => {
      if (employeeFilter !== "all" && employee.id !== employeeFilter) return false;
      const employeePartners = partners.filter((partner) => partner.owner_employee_id === employee.id);
      const employeeGroups = groups.filter((group) => group.owner_employee_id === employee.id);
      if (!employeePartners.length && !employeeGroups.length) return false;

      if (!normalizedQuery) {
        if (assignmentFilter === "all") return true;
        return employeePartners.some((partner) =>
          assignmentFilter === "grouped" ? membershipByPartner.has(partner.id) : !membershipByPartner.has(partner.id),
        );
      }

      if (
        employee.full_name.toLowerCase().includes(normalizedQuery) ||
        employee.employee_code.toLowerCase().includes(normalizedQuery) ||
        employeeGroups.some((group) =>
          group.group_name.toLowerCase().includes(normalizedQuery) ||
          group.group_code.toLowerCase().includes(normalizedQuery),
        )
      ) return true;

      return employeePartners.some((partner) =>
        partner.display_name.toLowerCase().includes(normalizedQuery) ||
        partner.partner_code.toLowerCase().includes(normalizedQuery) ||
        (partner.registration_code ?? "").toLowerCase().includes(normalizedQuery),
      );
    });
  }, [assignmentFilter, employeeFilter, employees, groups, membershipByPartner, normalizedQuery, partners]);

  const groupedCount = memberships.length;
  const ungroupedCount = Math.max(partners.length - groupedCount, 0);
  const drawerGroup = drawerGroupId ? groupById.get(drawerGroupId) ?? null : null;
  const drawerMembers = drawerGroup
    ? memberships.filter((membership) => membership.group_id === drawerGroup.id).length
    : 0;
  const selectedOwnerGroups = selectedOwnerId
    ? groups.filter((group) => group.owner_employee_id === selectedOwnerId)
    : [];

  function toggleEmployee(employeeId: string) {
    setOpenEmployees((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  function togglePartner(partner: GroupWorkspacePartner) {
    setSelectedPartnerIds((current) => {
      const sameOwner = !selectedOwnerId || selectedOwnerId === partner.owner_employee_id;
      const next = sameOwner ? new Set(current) : new Set<string>();
      if (next.has(partner.id)) next.delete(partner.id);
      else next.add(partner.id);

      const hasAny = next.size > 0;
      setSelectedOwnerId(hasAny ? partner.owner_employee_id : null);
      if (!sameOwner) setBulkGroupId("");
      return next;
    });
  }

  function clearSelection() {
    setSelectedPartnerIds(new Set());
    setSelectedOwnerId(null);
    setBulkGroupId("");
  }

  function beginDrop(partnerId: string, groupId: string) {
    setPendingDrop({ partnerId, groupId });
    requestAnimationFrame(() => dropFormRef.current?.requestSubmit());
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-4 pb-10">
      <section className="rounded-2xl border border-[#DCE4EE] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(15,35,65,.05)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF3FF] text-[#315FEA]">
                <UsersRound className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#142B4A]">Intermediary Groups</h1>
                <p className="mt-0.5 max-w-3xl text-[10px] leading-5 text-[#6B7A90]">
                  Organize permanent Partner families under their Sales Employee. Linked POSP/MISP relationships inherit the Partner&apos;s Group.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Metric label="Partners" value={partners.length} />
            <Metric label="Groups" value={groups.length} />
            <Metric label="Grouped" value={groupedCount} />
            <Metric label="Ungrouped" value={ungroupedCount} />
            {canManage ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#315FEA] px-3.5 text-[9.5px] font-semibold text-white shadow-sm transition hover:bg-[#254DD0]"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Group
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {success ? <Notice tone="success" text={successMessages[success] ?? "Action completed."} /> : null}
      {error ? <Notice tone="error" text={decodeURIComponent(error)} /> : null}
      {loadError ? <Notice tone="error" text="The hierarchy could not be fully loaded. Refresh the page and try again." /> : null}

      <section className="overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white shadow-[0_8px_24px_rgba(15,35,65,.05)]">
        <div className="border-b border-[#E7ECF3] bg-[#FBFCFE] px-4 py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8B9AAF]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Partner, Partner ID, Group or Employee"
                className="h-9 w-full rounded-lg border border-[#D7E0EA] bg-white pl-9 pr-3 text-[10px] text-[#1E344F] outline-none transition focus:border-[#7D94E6] focus:ring-2 focus:ring-[#E8EDFF]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[8.5px] font-semibold uppercase tracking-[0.06em] text-[#78879B]">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
              </span>
              <select
                value={employeeFilter}
                onChange={(event) => setEmployeeFilter(event.target.value)}
                className="h-9 min-w-[170px] rounded-lg border border-[#D7E0EA] bg-white px-2.5 text-[9px] text-[#42566E] outline-none"
              >
                <option value="all">All employees</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} · {employee.employee_code}</option>)}
              </select>
              <select
                value={assignmentFilter}
                onChange={(event) => setAssignmentFilter(event.target.value as AssignmentFilter)}
                className="h-9 min-w-[130px] rounded-lg border border-[#D7E0EA] bg-white px-2.5 text-[9px] text-[#42566E] outline-none"
              >
                <option value="all">All assignments</option>
                <option value="grouped">Grouped</option>
                <option value="ungrouped">Ungrouped</option>
              </select>
            </div>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-[11.5px] font-semibold text-[#1B3555]">Sales hierarchy</h2>
              <p className="mt-0.5 text-[8.5px] text-[#7B899B]">Employee → optional Group → permanent Partner family</p>
            </div>
            <span className="text-[8.5px] font-medium text-[#8A98A9]">{visibleEmployees.length} employees shown</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E0E7EF]">
            {visibleEmployees.length ? visibleEmployees.map((employee, index) => (
              <EmployeeSection
                key={employee.id}
                employee={employee}
                partners={partners.filter((partner) => partner.owner_employee_id === employee.id)}
                groups={groups.filter((group) => group.owner_employee_id === employee.id)}
                memberships={memberships}
                membershipByPartner={membershipByPartner}
                groupById={groupById}
                normalizedQuery={normalizedQuery}
                assignmentFilter={assignmentFilter}
                isOpen={openEmployees.has(employee.id) || Boolean(normalizedQuery)}
                onToggle={() => toggleEmployee(employee.id)}
                canManage={canManage}
                selectedPartnerIds={selectedPartnerIds}
                onTogglePartner={togglePartner}
                dragPartnerId={dragPartnerId}
                onDragStart={setDragPartnerId}
                onDragEnd={() => { setDragPartnerId(null); setDropGroupId(null); }}
                dropGroupId={dropGroupId}
                onDropGroup={beginDrop}
                onDropTarget={setDropGroupId}
                onManageGroup={setDrawerGroupId}
                last={index === visibleEmployees.length - 1}
              />
            )) : (
              <div className="px-6 py-16 text-center">
                <UserRound className="mx-auto h-6 w-6 text-[#A0ADBC]" />
                <p className="mt-3 text-[11px] font-semibold text-[#334A64]">No hierarchy results</p>
                <p className="mt-1 text-[9px] text-[#8794A5]">Try changing the search or filters.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {selectedPartnerIds.size > 0 && canManage ? (
        <div className="fixed bottom-5 left-1/2 z-40 w-[min(720px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-[#CAD5E3] bg-[#152C4B] p-2.5 text-white shadow-[0_20px_60px_rgba(12,27,50,.28)]">
          <form action={assignIntermediaryGroupMembers} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {Array.from(selectedPartnerIds).map((partnerId) => <input key={partnerId} type="hidden" name="partner_id" value={partnerId} />)}
            <div className="flex min-w-0 flex-1 items-center gap-2 px-1.5">
              <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-white/10 text-[10px] font-bold">{selectedPartnerIds.size}</span>
              <div className="min-w-0">
                <p className="text-[9.5px] font-semibold">Partner families selected</p>
                <p className="truncate text-[8px] text-white/60">{selectedOwnerId ? employeeById.get(selectedOwnerId)?.full_name : ""}</p>
              </div>
            </div>
            <select
              name="group_id"
              required
              value={bulkGroupId}
              onChange={(event) => setBulkGroupId(event.target.value)}
              className="h-9 min-w-[190px] rounded-lg border border-white/15 bg-white/10 px-2.5 text-[9px] text-white outline-none [&>option]:text-[#263A52]"
            >
              <option value="">Move selected to Group…</option>
              {selectedOwnerGroups.map((group) => <option key={group.id} value={group.id}>{group.group_name}</option>)}
            </select>
            <FormSubmitButton
              label="Move"
              pendingLabel="Moving…"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-3.5 text-[9px] font-semibold text-[#17365D] hover:bg-[#F4F7FB]"
            />
            <button type="button" onClick={clearSelection} className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-white/75 hover:bg-white/10" title="Clear selection">
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      ) : null}

      <form ref={dropFormRef} action={assignIntermediaryGroupMembers} className="hidden">
        <input name="partner_id" value={pendingDrop?.partnerId ?? ""} readOnly />
        <input name="group_id" value={pendingDrop?.groupId ?? ""} readOnly />
      </form>

      {createOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#10233D]/35 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-label="Create Intermediary Group" className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-[#D9E2ED] bg-white shadow-[0_28px_80px_rgba(13,31,55,.24)]">
            <div className="flex items-start justify-between border-b border-[#E8EDF3] px-5 py-4">
              <div>
                <h3 className="text-[14px] font-semibold text-[#17324F]">Create Intermediary Group</h3>
                <p className="mt-1 text-[9px] text-[#738196]">Create the Group first, then assign Partner families from the hierarchy.</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-[#77869A] hover:bg-[#F1F4F8]"><X className="h-4 w-4" /></button>
            </div>
            <form action={createIntermediaryGroup} className="space-y-4 p-5">
              <Field label="Group name"><input name="group_name" required maxLength={80} placeholder="e.g. Central Fleet Partners" className={inputClass} autoFocus /></Field>
              <Field label="Sales employee">
                <select name="owner_employee_id" required defaultValue={defaultOwnerEmployeeId} className={inputClass}>
                  <option value="">Select employee</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} · {employee.employee_code}</option>)}
                </select>
              </Field>
              <Field label="Description"><textarea name="description" maxLength={500} rows={3} placeholder="Optional internal description" className="w-full resize-none rounded-xl border border-[#D5DFEA] bg-white px-3 py-2.5 text-[10px] text-[#243B55] outline-none focus:border-[#7F92C9] focus:ring-2 focus:ring-[#E8EDFF]" /></Field>
              <div className="flex justify-end gap-2 border-t border-[#EEF2F6] pt-4">
                <button type="button" onClick={() => setCreateOpen(false)} className="h-9 rounded-lg border border-[#D6DFE9] bg-white px-3.5 text-[9px] font-semibold text-[#53657A] hover:bg-[#F8FAFC]">Cancel</button>
                <FormSubmitButton label="Create Group" pendingLabel="Creating…" className="inline-flex h-9 items-center justify-center rounded-lg bg-[#315FEA] px-4 text-[9px] font-semibold text-white hover:bg-[#254DD0]" />
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {drawerGroup ? (
        <div className="fixed inset-0 z-50 bg-[#10233D]/20" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawerGroupId(null); }}>
          <aside className="absolute inset-y-0 right-0 w-full max-w-[430px] overflow-y-auto border-l border-[#D7E1EC] bg-white shadow-[-20px_0_60px_rgba(15,34,58,.15)]">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#E8EDF3] bg-white/95 px-5 py-4 backdrop-blur">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#7A8AA0]">{drawerGroup.group_code}</p>
                <h3 className="mt-1 text-[15px] font-semibold text-[#17324F]">{drawerGroup.group_name}</h3>
              </div>
              <button type="button" onClick={() => setDrawerGroupId(null)} className="grid h-8 w-8 place-items-center rounded-lg text-[#77869A] hover:bg-[#F1F4F8]"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-2">
                <InfoCard label="Sales owner" value={employeeById.get(drawerGroup.owner_employee_id)?.full_name ?? "Unknown"} />
                <InfoCard label="Partner families" value={String(drawerMembers)} />
              </div>

              {drawerGroup.description ? <div className="rounded-xl bg-[#F7F9FC] p-3"><p className="text-[8px] font-bold uppercase tracking-[0.06em] text-[#8290A3]">Description</p><p className="mt-1 text-[9.5px] leading-5 text-[#53667D]">{drawerGroup.description}</p></div> : null}

              {canManage ? (
                <section className="space-y-3">
                  <div className="flex items-center gap-2"><Pencil className="h-3.5 w-3.5 text-[#315FEA]" /><h4 className="text-[10px] font-semibold text-[#253F5C]">Edit group</h4></div>
                  <form action={renameIntermediaryGroup} className="space-y-2">
                    <input type="hidden" name="group_id" value={drawerGroup.id} />
                    <Field label="Group name"><input name="group_name" defaultValue={drawerGroup.group_name} required maxLength={80} className={inputClass} /></Field>
                    <Field label="Description"><input name="description" defaultValue={drawerGroup.description ?? ""} className={inputClass} /></Field>
                    <FormSubmitButton label="Save changes" pendingLabel="Saving…" className="inline-flex h-9 items-center rounded-lg border border-[#CAD7E7] bg-white px-3.5 text-[9px] font-semibold text-[#3156B8] hover:bg-[#F5F8FC]" />
                  </form>
                </section>
              ) : null}

              {canTransfer ? (
                <section className="space-y-3 border-t border-[#EDF1F5] pt-5">
                  <div className="flex items-center gap-2"><ArrowRightLeft className="h-3.5 w-3.5 text-[#7B5BE7]" /><h4 className="text-[10px] font-semibold text-[#253F5C]">Transfer group</h4></div>
                  <form action={transferIntermediaryGroup} className="space-y-2">
                    <input type="hidden" name="group_id" value={drawerGroup.id} />
                    <select name="new_owner_employee_id" defaultValue="" required className={inputClass}>
                      <option value="">Select new sales employee</option>
                      {employees.filter((employee) => employee.id !== drawerGroup.owner_employee_id).map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} · {employee.employee_code}</option>)}
                    </select>
                    <input name="reason" placeholder="Transfer reason" className={inputClass} />
                    <FormSubmitButton label="Transfer Group" pendingLabel="Transferring…" className="inline-flex h-9 items-center rounded-lg border border-[#D9D0FB] bg-[#F8F6FF] px-3.5 text-[9px] font-semibold text-[#6847C7] hover:bg-[#F2EEFF]" />
                  </form>
                </section>
              ) : null}

              {canManage ? (
                <section className="border-t border-[#EDF1F5] pt-5">
                  <div className="flex items-center gap-2"><Archive className="h-3.5 w-3.5 text-[#C04C4C]" /><h4 className="text-[10px] font-semibold text-[#253F5C]">Archive</h4></div>
                  {drawerMembers === 0 ? (
                    <form action={archiveIntermediaryGroup} className="mt-3">
                      <input type="hidden" name="group_id" value={drawerGroup.id} />
                      <FormSubmitButton label="Archive empty Group" pendingLabel="Archiving…" className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-red-50 px-3.5 text-[9px] font-semibold text-red-700 hover:bg-red-100" />
                    </form>
                  ) : (
                    <p className="mt-2 text-[9px] leading-5 text-[#7C8999]">Move or ungroup all Partner families before archiving this Group.</p>
                  )}
                </section>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function EmployeeSection({
  employee,
  partners,
  groups,
  memberships,
  membershipByPartner,
  groupById,
  normalizedQuery,
  assignmentFilter,
  isOpen,
  onToggle,
  canManage,
  selectedPartnerIds,
  onTogglePartner,
  dragPartnerId,
  onDragStart,
  onDragEnd,
  dropGroupId,
  onDropGroup,
  onDropTarget,
  onManageGroup,
  last,
}: {
  employee: GroupWorkspaceEmployee;
  partners: GroupWorkspacePartner[];
  groups: GroupWorkspaceGroup[];
  memberships: GroupWorkspaceMembership[];
  membershipByPartner: Map<string, GroupWorkspaceMembership>;
  groupById: Map<string, GroupWorkspaceGroup>;
  normalizedQuery: string;
  assignmentFilter: AssignmentFilter;
  isOpen: boolean;
  onToggle: () => void;
  canManage: boolean;
  selectedPartnerIds: Set<string>;
  onTogglePartner: (partner: GroupWorkspacePartner) => void;
  dragPartnerId: string | null;
  onDragStart: (partnerId: string) => void;
  onDragEnd: () => void;
  dropGroupId: string | null;
  onDropGroup: (partnerId: string, groupId: string) => void;
  onDropTarget: (groupId: string | null) => void;
  onManageGroup: (groupId: string) => void;
  last: boolean;
}) {
  const ungrouped = partners.filter((partner) => !membershipByPartner.has(partner.id));
  const visibleGroups = groups.filter((group) => {
    if (!normalizedQuery) return true;
    if (group.group_name.toLowerCase().includes(normalizedQuery) || group.group_code.toLowerCase().includes(normalizedQuery)) return true;
    return memberships
      .filter((membership) => membership.group_id === group.id)
      .some((membership) => partnerMatches(partners.find((partner) => partner.id === membership.partner_id), normalizedQuery));
  });
  const visibleUngrouped = ungrouped.filter((partner) => !normalizedQuery || partnerMatches(partner, normalizedQuery));

  const groupedPartnerCount = partners.length - ungrouped.length;
  const showGroups = assignmentFilter !== "ungrouped";
  const showUngrouped = assignmentFilter !== "grouped";

  return (
    <div className={last ? "" : "border-b border-[#E5EBF2]"}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 bg-[#FAFBFD] px-3.5 py-3 text-left transition hover:bg-[#F5F8FC]">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#183B66] text-[9px] font-bold text-white">{initials(employee.full_name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[10.5px] font-semibold text-[#1D3858]">{employee.full_name}</span>
          <span className="mt-0.5 block text-[8px] text-[#7D8B9D]">{employee.designation ?? "Sales employee"} · {employee.employee_code}</span>
        </span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <Stat label="Partners" value={partners.length} />
          <Stat label="Groups" value={groups.length} />
          <Stat label="Ungrouped" value={ungrouped.length} />
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#7A8A9D] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="bg-white px-3.5 py-3">
          <div className="space-y-2">
            {showGroups ? visibleGroups.map((group) => {
              const members = memberships
                .filter((membership) => membership.group_id === group.id)
                .map((membership) => partners.find((partner) => partner.id === membership.partner_id))
                .filter((partner): partner is GroupWorkspacePartner => Boolean(partner))
                .filter((partner) => !normalizedQuery || partnerMatches(partner, normalizedQuery) || group.group_name.toLowerCase().includes(normalizedQuery) || group.group_code.toLowerCase().includes(normalizedQuery));
              const isDropTarget = dropGroupId === group.id && Boolean(dragPartnerId);
              return (
                <div
                  key={group.id}
                  onDragOver={(event) => { if (!canManage || !dragPartnerId) return; event.preventDefault(); onDropTarget(group.id); }}
                  onDragLeave={() => onDropTarget(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (canManage && dragPartnerId) onDropGroup(dragPartnerId, group.id);
                    onDropTarget(null);
                  }}
                  className={`overflow-hidden rounded-lg border transition ${isDropTarget ? "border-[#315FEA] bg-[#F1F5FF] ring-2 ring-[#DDE5FF]" : "border-[#DFE6EE] bg-white"}`}
                >
                  <div className="flex items-center gap-2 border-b border-[#EDF1F5] bg-[#F8FAFC] px-3 py-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#EEF3FF] text-[#315FEA]"><Folder className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[9.5px] font-semibold text-[#24405F]">{group.group_name}</p>
                        <span className="text-[7.5px] font-semibold uppercase tracking-[0.06em] text-[#8A98A9]">{group.group_code}</span>
                      </div>
                      <p className="mt-0.5 text-[7.5px] text-[#8996A6]">{members.length} Partner {members.length === 1 ? "family" : "families"}{isDropTarget ? " · Drop to move here" : ""}</p>
                    </div>
                    {canManage ? <button type="button" onClick={() => onManageGroup(group.id)} className="grid h-7 w-7 place-items-center rounded-lg text-[#718198] hover:bg-white hover:text-[#315FEA]" title="Manage Group"><MoreHorizontal className="h-4 w-4" /></button> : null}
                  </div>
                  {members.length ? (
                    <div className="divide-y divide-[#EEF2F6]">
                      {members.map((partner) => (
                        <PartnerRow
                          key={partner.id}
                          partner={partner}
                          currentGroup={groupById.get(membershipByPartner.get(partner.id)?.group_id ?? "") ?? null}
                          groups={groups}
                          canManage={canManage}
                          selected={selectedPartnerIds.has(partner.id)}
                          onToggle={() => onTogglePartner(partner)}
                          onDragStart={() => onDragStart(partner.id)}
                          onDragEnd={onDragEnd}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-4 text-center text-[8.5px] text-[#93A0AF]">{isDropTarget ? "Release to move Partner into this Group" : "No Partner families in this Group."}</div>
                  )}
                </div>
              );
            }) : null}

            {showUngrouped ? (
              <div className="overflow-hidden rounded-lg border border-dashed border-[#C8D3E0] bg-[#FCFDFE]">
                <div className="flex items-center gap-2 border-b border-dashed border-[#D9E1E9] px-3 py-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F1F4F7] text-[#68798C]"><UsersRound className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9.5px] font-semibold text-[#52657B]">Ungrouped</p>
                    <p className="mt-0.5 text-[7.5px] text-[#8B98A7]">Virtual bucket · {ungrouped.length} Partner {ungrouped.length === 1 ? "family" : "families"}</p>
                  </div>
                </div>
                {visibleUngrouped.length ? (
                  <div className="divide-y divide-[#EEF2F6]">
                    {visibleUngrouped.map((partner) => (
                      <PartnerRow
                        key={partner.id}
                        partner={partner}
                        currentGroup={null}
                        groups={groups}
                        canManage={canManage}
                        selected={selectedPartnerIds.has(partner.id)}
                        onToggle={() => onTogglePartner(partner)}
                        onDragStart={() => onDragStart(partner.id)}
                        onDragEnd={onDragEnd}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-4 text-center text-[8.5px] text-[#93A0AF]">
                    {ungrouped.length ? "No ungrouped Partners match the current search." : "Every Partner family is assigned to a Group."}
                  </div>
                )}
              </div>
            ) : null}

            {!groups.length && !ungrouped.length ? (
              <div className="rounded-lg border border-dashed border-[#D4DDE7] px-4 py-8 text-center">
                <p className="text-[9.5px] font-semibold text-[#53677C]">No Partner families under this employee</p>
              </div>
            ) : null}
          </div>

          <div className="mt-2 flex items-center justify-end gap-3 px-1 text-[7.5px] text-[#99A5B3]">
            <span>{groupedPartnerCount} grouped</span>
            <span>{ungrouped.length} ungrouped</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PartnerRow({
  partner,
  currentGroup,
  groups,
  canManage,
  selected,
  onToggle,
  onDragStart,
  onDragEnd,
}: {
  partner: GroupWorkspacePartner;
  currentGroup: GroupWorkspaceGroup | null;
  groups: GroupWorkspaceGroup[];
  canManage: boolean;
  selected: boolean;
  onToggle: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const alternatives = groups.filter((group) => group.id !== currentGroup?.id);
  return (
    <div
      draggable={canManage}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", partner.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-2.5 px-3 py-2.5 transition ${selected ? "bg-[#F4F7FF]" : "hover:bg-[#FAFBFD]"}`}
    >
      {canManage ? (
        <>
          <input type="checkbox" checked={selected} onChange={onToggle} className="h-3.5 w-3.5 rounded border-[#B9C6D5] accent-[#315FEA]" aria-label={`Select ${partner.display_name}`} />
          <GripVertical className="h-3.5 w-3.5 cursor-grab text-[#B2BDCA] opacity-0 transition group-hover:opacity-100" />
        </>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-[9.5px] font-semibold text-[#2A405B]">{partner.display_name}</p>
          <span className="rounded-md bg-[#F1F4F7] px-1.5 py-0.5 text-[7px] font-semibold uppercase text-[#6B7B8C]">{partner.partner_kind === "business" ? "Business Partner" : "Individual Partner"}</span>
        </div>
        <p className="mt-0.5 text-[7.5px] text-[#8593A4]">{partner.partner_code}{partner.registration_code && partner.registration_code !== partner.partner_code ? ` · ${partner.registration_code}` : ""}</p>
      </div>
      <div className="hidden min-w-[110px] text-right text-[8px] font-medium text-[#718197] md:block">{currentGroup?.group_name ?? "Ungrouped"}</div>
      {canManage ? (
        <div className="flex items-center gap-1">
          {alternatives.length ? (
            <form action={assignIntermediaryGroupMembers} className="flex items-center gap-1">
              <input type="hidden" name="partner_id" value={partner.id} />
              <select name="group_id" defaultValue="" required className="h-7 max-w-[150px] rounded-md border border-transparent bg-transparent px-1.5 text-[7.5px] text-[#718197] opacity-0 outline-none transition hover:border-[#D7E0EA] hover:bg-white group-hover:opacity-100 focus:opacity-100">
                <option value="">Move to…</option>
                {alternatives.map((group) => <option key={group.id} value={group.id}>{group.group_name}</option>)}
              </select>
              <button type="submit" className="sr-only">Move Partner</button>
            </form>
          ) : null}
          {currentGroup ? (
            <form action={removeIntermediaryGroupMembers}>
              <input type="hidden" name="partner_id" value={partner.id} />
              <button type="submit" className="grid h-7 w-7 place-items-center rounded-md text-[#8B98A8] opacity-0 transition hover:bg-[#F1F4F8] hover:text-[#52677F] group-hover:opacity-100" title="Move to Ungrouped">
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[76px] rounded-lg border border-[#DEE6EF] bg-[#FAFBFD] px-2.5 py-2 text-center">
      <p className="text-[13px] font-semibold text-[#17365D]">{value}</p>
      <p className="mt-0.5 text-[7px] font-semibold uppercase tracking-[0.06em] text-[#8390A1]">{label}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <span className="rounded-md border border-[#DFE6EE] bg-white px-2 py-1 text-[7.5px] text-[#748499]"><b className="text-[#294766]">{value}</b> {label}</span>;
}

function Notice({ tone, text }: { tone: "success" | "error"; text: string }) {
  return <div className={`rounded-xl border px-4 py-3 text-[9.5px] font-medium ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{text}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[8px] font-bold uppercase tracking-[0.06em] text-[#728197]">{label}</span>{children}</label>;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#E1E7EF] bg-[#FAFBFD] p-3"><p className="text-[7.5px] font-bold uppercase tracking-[0.06em] text-[#8694A5]">{label}</p><p className="mt-1 text-[10px] font-semibold text-[#2B4665]">{value}</p></div>;
}

function partnerMatches(partner: GroupWorkspacePartner | undefined, query: string) {
  if (!partner) return false;
  return (
    partner.display_name.toLowerCase().includes(query) ||
    partner.partner_code.toLowerCase().includes(query) ||
    (partner.registration_code ?? "").toLowerCase().includes(query)
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SE";
}

const inputClass = "h-10 w-full rounded-xl border border-[#D5DFEA] bg-white px-3 text-[10px] text-[#243B55] outline-none focus:border-[#7F92C9] focus:ring-2 focus:ring-[#E8EDFF]";
