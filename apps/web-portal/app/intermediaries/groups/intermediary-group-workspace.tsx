"use client";

import { useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Folder,
  GripVertical,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
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
type WorkspaceView = "board" | "list";

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
  const [viewMode, setViewMode] = useState<WorkspaceView>("board");
  const [openEmployees, setOpenEmployees] = useState<Set<string>>(() => new Set(employees.map((employee) => employee.id)));
  const [createOpen, setCreateOpen] = useState(false);
  const [createSelectionOwnerId, setCreateSelectionOwnerId] = useState<string | null>(null);
  const [drawerGroupId, setDrawerGroupId] = useState<string | null>(null);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<Set<string>>(new Set());
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
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
  const selectedOwner = selectedOwnerId ? employeeById.get(selectedOwnerId) ?? null : null;

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
      return next;
    });
  }

  function clearSelection() {
    setSelectedPartnerIds(new Set());
    setSelectedOwnerId(null);
  }

  function beginDrop(partnerId: string, groupId: string) {
    setPendingDrop({ partnerId, groupId });
    requestAnimationFrame(() => dropFormRef.current?.requestSubmit());
  }

  return (
    <div className="mx-auto max-w-[1540px] space-y-4 pb-24">
      <section className="overflow-hidden rounded-[22px] border border-[#DCE5F1] bg-white shadow-[0_18px_50px_rgba(24,59,102,.08)]">
        <div className="grid gap-3 p-4 xl:grid-cols-[1.05fr_2.2fr]">
          <div className="relative overflow-hidden rounded-2xl border border-[#DCE6F5] bg-[linear-gradient(135deg,#FFFFFF_0%,#F5F8FF_62%,#EEF3FF_100%)] px-5 py-4">
            <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#315FEA]/10 blur-2xl" />
            <div className="relative flex items-start gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(145deg,#F1F5FF,#FFFFFF)] text-[#315FEA] shadow-[0_8px_20px_rgba(49,95,234,.14)] ring-1 ring-[#D9E4FF]">
                <UsersRound className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-[19px] font-bold tracking-[-0.025em] text-[#142B4A]">Intermediary Groups</h1>
                <p className="mt-1 max-w-xl text-[10px] leading-5 text-[#61738A]">
                  Organize permanent Partner families under their Sales Employees. Linked POSP/MISP relationships inherit the Partner&apos;s Group.
                </p>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => { setCreateSelectionOwnerId(null); setCreateOpen(true); }}
                    className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl bg-[#315FEA] px-4 text-[9.5px] font-bold text-white shadow-[0_8px_20px_rgba(49,95,234,.22)] transition hover:-translate-y-0.5 hover:bg-[#254DD0]"
                  >
                    <Plus className="h-4 w-4" />
                    Create Group
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total Partners" value={partners.length} tone="blue" icon={<UsersRound className="h-5 w-5" />} />
            <Metric label="Total Groups" value={groups.length} tone="violet" icon={<Folder className="h-5 w-5" />} />
            <Metric label="Grouped Partners" value={groupedCount} tone="green" icon={<CheckCircle2 className="h-5 w-5" />} />
            <Metric label="Ungrouped Partners" value={ungroupedCount} tone="amber" icon={<CircleUserRound className="h-5 w-5" />} />
          </div>
        </div>
      </section>

      {success ? <Notice tone="success" text={successMessages[success] ?? "Action completed."} /> : null}
      {error ? <Notice tone="error" text={decodeURIComponent(error)} /> : null}
      {loadError ? <Notice tone="error" text="The hierarchy could not be fully loaded. Refresh the page and try again." /> : null}

      <section className="overflow-hidden rounded-[22px] border border-[#DCE5F1] bg-white shadow-[0_14px_40px_rgba(24,59,102,.06)]">
        <div className="border-b border-[#E7ECF3] bg-[linear-gradient(180deg,#FBFDFF,#F8FAFD)] px-4 py-3">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B9AAF]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search partner, partner ID, group or employee"
                className="h-10 w-full rounded-xl border border-[#D7E0EA] bg-white pl-10 pr-3 text-[10px] text-[#1E344F] shadow-sm outline-none transition focus:border-[#7D94E6] focus:ring-2 focus:ring-[#E8EDFF]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={employeeFilter}
                onChange={(event) => setEmployeeFilter(event.target.value)}
                className="h-10 min-w-[190px] rounded-xl border border-[#D7E0EA] bg-white px-3 text-[9px] font-medium text-[#42566E] shadow-sm outline-none"
              >
                <option value="all">All Sales Employees</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} · {employee.employee_code}</option>)}
              </select>
              <select
                value={assignmentFilter}
                onChange={(event) => setAssignmentFilter(event.target.value as AssignmentFilter)}
                className="h-10 min-w-[150px] rounded-xl border border-[#D7E0EA] bg-white px-3 text-[9px] font-medium text-[#42566E] shadow-sm outline-none"
              >
                <option value="all">All Assignments</option>
                <option value="grouped">Grouped</option>
                <option value="ungrouped">Ungrouped</option>
              </select>
              <span className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#D8E1ED] bg-white px-3 text-[8.5px] font-bold text-[#50657D] shadow-sm">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[#315FEA]" />
                Filters
              </span>
              <div className="flex h-10 items-center rounded-xl border border-[#D8E1ED] bg-white p-1 shadow-sm">
                <button type="button" onClick={() => setViewMode("board")} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[8.5px] font-bold transition ${viewMode === "board" ? "bg-[#315FEA] text-white shadow-sm" : "text-[#718198] hover:bg-[#F5F7FA]"}`}>
                  <LayoutGrid className="h-3.5 w-3.5" /> Board
                </button>
                <button type="button" onClick={() => setViewMode("list")} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[8.5px] font-bold transition ${viewMode === "list" ? "bg-[#315FEA] text-white shadow-sm" : "text-[#718198] hover:bg-[#F5F7FA]"}`}>
                  <List className="h-3.5 w-3.5" /> List
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setQuery(""); setEmployeeFilter("all"); setAssignmentFilter("all"); }}
                className="grid h-10 w-10 place-items-center rounded-xl border border-[#D8E1ED] bg-white text-[#718198] shadow-sm transition hover:bg-[#F5F7FA] hover:text-[#315FEA]"
                title="Reset filters"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[13px] font-bold tracking-[-0.01em] text-[#1B3555]">Relationship Board</h2>
              <p className="mt-0.5 text-[8.5px] font-medium text-[#7B899B]">Employee → Groups → Partners</p>
            </div>
            <div className="flex items-center gap-3 text-[8.5px]">
              <span className="font-medium text-[#8A98A9]">{openEmployees.size} of {visibleEmployees.length} employees expanded</span>
              <button type="button" onClick={() => setOpenEmployees(new Set(visibleEmployees.map((employee) => employee.id)))} className="font-bold text-[#315FEA] hover:text-[#244ED0]">Expand all</button>
              <button type="button" onClick={() => setOpenEmployees(new Set())} className="font-bold text-[#7A8797] hover:text-[#334A64]">Collapse all</button>
            </div>
          </div>

          <div className="space-y-2.5">
            {visibleEmployees.length ? visibleEmployees.map((employee) => (
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
                viewMode={viewMode}
              />
            )) : (
              <div className="rounded-2xl border border-dashed border-[#D6E0EA] bg-[#FAFCFE] px-6 py-16 text-center">
                <UserRound className="mx-auto h-7 w-7 text-[#A0ADBC]" />
                <p className="mt-3 text-[11px] font-semibold text-[#334A64]">No hierarchy results</p>
                <p className="mt-1 text-[9px] text-[#8794A5]">Try changing the search or assignment filters.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {canManage && selectedPartnerIds.size > 0 && selectedOwner ? (
        <div className="fixed bottom-5 left-1/2 z-40 w-[min(760px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-[#D7E1EC] bg-white/95 p-2.5 shadow-[0_20px_60px_rgba(15,35,65,.22)] backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-2.5 px-2 sm:flex-1">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#FFF4DF] text-[#EA8B00]">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[9.5px] font-bold text-[#203C5B]">{selectedPartnerIds.size} partner {selectedPartnerIds.size === 1 ? "family" : "families"} selected</p>
                <p className="truncate text-[7.5px] text-[#7B8A9C]">{selectedOwner.full_name} · {selectedOwner.employee_code}</p>
              </div>
              <button type="button" onClick={clearSelection} className="ml-1 text-[8px] font-bold text-[#315FEA]">Clear</button>
            </div>
            <button type="button" onClick={() => { setCreateSelectionOwnerId(selectedOwner.id); setCreateOpen(true); }} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#F39800] px-4 text-[8.5px] font-bold text-white shadow-sm hover:bg-[#DD8600]">
              <Plus className="h-3.5 w-3.5" /> Create group from selected
            </button>
            {selectedOwnerGroups.length ? (
              <form action={assignIntermediaryGroupMembers} className="flex items-center gap-1.5">
                {Array.from(selectedPartnerIds).map((partnerId) => <input key={partnerId} type="hidden" name="partner_id" value={partnerId} />)}
                <select name="group_id" required defaultValue="" className="h-9 min-w-[170px] rounded-xl border border-[#CCD7E4] bg-white px-3 text-[8.5px] font-semibold text-[#56697F] outline-none">
                  <option value="">Move to existing group</option>
                  {selectedOwnerGroups.map((group) => <option key={group.id} value={group.id}>{group.group_name}</option>)}
                </select>
                <FormSubmitButton label="Move" pendingLabel="Moving…" className="inline-flex h-9 items-center rounded-xl border border-[#CCD7E4] bg-white px-3 text-[8.5px] font-bold text-[#3156B8] hover:bg-[#F5F8FC]" />
              </form>
            ) : null}
          </div>
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
                <h3 className="text-[14px] font-semibold text-[#17324F]">{createSelectionOwnerId ? "Create Group from selected" : "Create Intermediary Group"}</h3>
                <p className="mt-1 text-[9px] text-[#738196]">{createSelectionOwnerId ? `${selectedPartnerIds.size} selected Partner ${selectedPartnerIds.size === 1 ? "family will" : "families will"} be added immediately.` : "Create the Group first, then assign Partner families from the hierarchy."}</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-[#77869A] hover:bg-[#F1F4F8]"><X className="h-4 w-4" /></button>
            </div>
            <form action={createIntermediaryGroup} className="space-y-4 p-5">
              {createSelectionOwnerId ? Array.from(selectedPartnerIds).map((partnerId) => <input key={partnerId} type="hidden" name="partner_id" value={partnerId} />) : null}
              <Field label="Group name"><input name="group_name" required maxLength={80} placeholder="e.g. Central Fleet Partners" className={inputClass} autoFocus /></Field>
              <Field label="Sales employee">
                {createSelectionOwnerId ? (
                  <>
                    <input type="hidden" name="owner_employee_id" value={createSelectionOwnerId} />
                    <div className="flex h-10 items-center rounded-xl border border-[#D5DFEA] bg-[#F7F9FC] px-3 text-[10px] font-medium text-[#314A66]">
                      {employeeById.get(createSelectionOwnerId)?.full_name ?? "Selected employee"} · {employeeById.get(createSelectionOwnerId)?.employee_code ?? ""}
                    </div>
                  </>
                ) : (
                  <select name="owner_employee_id" required defaultValue={defaultOwnerEmployeeId} className={inputClass}>
                    <option value="">Select employee</option>
                    {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} · {employee.employee_code}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Description"><textarea name="description" maxLength={500} rows={3} placeholder="Optional internal description" className="w-full resize-none rounded-xl border border-[#D5DFEA] bg-white px-3 py-2.5 text-[10px] text-[#243B55] outline-none focus:border-[#7F92C9] focus:ring-2 focus:ring-[#E8EDFF]" /></Field>
              <div className="flex justify-end gap-2 border-t border-[#EEF2F6] pt-4">
                <button type="button" onClick={() => setCreateOpen(false)} className="h-9 rounded-lg border border-[#D6DFE9] bg-white px-3.5 text-[9px] font-semibold text-[#53657A] hover:bg-[#F8FAFC]">Cancel</button>
                <FormSubmitButton label={createSelectionOwnerId ? `Create & add ${selectedPartnerIds.size}` : "Create Group"} pendingLabel="Creating…" className="inline-flex h-9 items-center justify-center rounded-lg bg-[#315FEA] px-4 text-[9px] font-semibold text-white hover:bg-[#254DD0]" />
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
  viewMode,
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
  viewMode: WorkspaceView;
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
  const showGroups = assignmentFilter !== "ungrouped";
  const showUngrouped = assignmentFilter !== "grouped";

  return (
    <article className="overflow-hidden rounded-2xl border border-[#D7E2F0] bg-white shadow-[0_6px_18px_rgba(23,54,93,.045)]">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 bg-[linear-gradient(90deg,#F8FBFF,#F2F6FF_55%,#FBFCFF)] px-4 py-3 text-left transition hover:brightness-[.99]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(145deg,#1D4D80,#15365E)] text-[9px] font-bold text-white shadow-sm">{initials(employee.full_name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-bold text-[#1D3858]">{employee.full_name}</span>
          <span className="mt-0.5 block text-[8px] font-medium text-[#7D8B9D]">{employee.designation ?? "Sales employee"} · {employee.employee_code}</span>
        </span>
        <span className="hidden items-center gap-2 sm:flex">
          <Stat label="Partners" value={partners.length} tone="blue" />
          <Stat label="Groups" value={groups.length} tone="violet" />
          <Stat label="Ungrouped" value={ungrouped.length} tone={ungrouped.length ? "amber" : "green"} />
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#60748B] shadow-sm ring-1 ring-[#E3E9F1]">
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      {isOpen ? (
        <div className="p-3">
          <div className={viewMode === "board" ? "grid gap-3 lg:grid-cols-[minmax(255px,.85fr)_minmax(0,2fr)]" : "grid gap-3"}>
            {showUngrouped ? (
              <section className="overflow-hidden rounded-2xl border border-[#FFDCA5] bg-[linear-gradient(180deg,#FFF9EF,#FFFDF9)]">
                <div className="flex items-center gap-2 border-b border-[#FFE6BE] bg-[#FFF8EA] px-3 py-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#FFF0D5] text-[#E98A00]"><CircleUserRound className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[9.5px] font-bold text-[#C96F00]">Ungrouped Partners</p>
                      {ungrouped.length ? <span className="rounded-full bg-[#FFE8C1] px-2 py-0.5 text-[7px] font-bold text-[#C96F00]">Pending assignment</span> : null}
                    </div>
                    <p className="mt-0.5 text-[7.5px] text-[#A78352]">{ungrouped.length} Partner {ungrouped.length === 1 ? "family" : "families"}</p>
                  </div>
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#FFE8C1] px-1.5 text-[8px] font-bold text-[#D77E00]">{ungrouped.length}</span>
                </div>
                {visibleUngrouped.length ? (
                  <div className="space-y-1.5 p-2">
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
                        compact
                      />
                    ))}
                  </div>
                ) : ungrouped.length ? (
                  <div className="px-3 py-8 text-center text-[8.5px] text-[#A18B70]">No ungrouped Partners match the current search.</div>
                ) : (
                  <div className="flex min-h-[112px] flex-col items-center justify-center px-4 py-6 text-center">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#EAF8EF] text-[#2E9B59]"><Sparkles className="h-4 w-4" /></span>
                    <p className="mt-2 text-[9px] font-bold text-[#2E7E4B]">Great! All partners are organized.</p>
                    <p className="mt-1 text-[7.5px] text-[#789180]">There is nothing pending for this employee.</p>
                  </div>
                )}
              </section>
            ) : null}

            {showGroups ? (
              <section className="overflow-hidden rounded-2xl border border-[#E5DDFC] bg-[linear-gradient(180deg,#FBF9FF,#FEFDFF)]">
                <div className="flex items-center gap-2 border-b border-[#EEE8FA] bg-[#FAF7FF] px-3 py-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#EEE7FF] text-[#7753D5]"><Folder className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9.5px] font-bold text-[#6346B7]">Partner Groups</p>
                    <p className="mt-0.5 text-[7.5px] text-[#9686B8]">{groups.length} active {groups.length === 1 ? "group" : "groups"}</p>
                  </div>
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#EEE7FF] px-1.5 text-[8px] font-bold text-[#7753D5]">{groups.length}</span>
                </div>

                {visibleGroups.length ? (
                  <div className={`grid gap-2.5 p-2.5 ${viewMode === "board" ? "md:grid-cols-2" : "grid-cols-1"}`}>
                    {visibleGroups.map((group) => {
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
                          className={`overflow-hidden rounded-xl border bg-white shadow-[0_4px_14px_rgba(83,57,145,.06)] transition ${isDropTarget ? "border-[#7753D5] ring-2 ring-[#E6DEFA]" : "border-[#E4DDF3]"}`}
                        >
                          <div className="flex items-start gap-2 border-b border-[#F0ECF7] px-3 py-2.5">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#F1ECFF] text-[#7753D5]"><UsersRound className="h-3.5 w-3.5" /></span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate text-[9.5px] font-bold text-[#563A9A]">{group.group_name}</p>
                                <span className="rounded-md bg-[#EEF8F0] px-1.5 py-0.5 text-[6.5px] font-bold uppercase text-[#3C8D58]">Active</span>
                              </div>
                              <p className="mt-0.5 text-[7.5px] text-[#8C7FA7]">{members.length} Partner {members.length === 1 ? "family" : "families"} · {group.group_code}</p>
                            </div>
                            {canManage ? (
                              <button type="button" onClick={() => onManageGroup(group.id)} className="grid h-7 w-7 place-items-center rounded-lg text-[#7E7395] hover:bg-[#F6F2FF] hover:text-[#6847C7]" title="Manage Group">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>

                          {members.length ? (
                            <div className="grid gap-1.5 p-2 sm:grid-cols-2">
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
                                  compact
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="px-3 py-7 text-center text-[8.5px] text-[#9D91B3]">{isDropTarget ? "Release to move Partner into this Group" : "No Partner families in this Group."}</div>
                          )}

                          <div className="flex items-center justify-between border-t border-[#F0ECF7] px-3 py-2 text-[7.5px] font-bold">
                            <span className="text-[#7753D5]">{isDropTarget ? "Drop partner here" : "Permanent Partner family group"}</span>
                            {canManage ? <button type="button" onClick={() => onManageGroup(group.id)} className="text-[#7753D5] hover:text-[#563A9A]">Manage</button> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-10 text-center">
                    <Folder className="mx-auto h-5 w-5 text-[#B2A6C8]" />
                    <p className="mt-2 text-[9px] font-semibold text-[#766A8B]">{groups.length ? "No groups match the current search." : "No groups created yet."}</p>
                  </div>
                )}
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
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
  compact = false,
}: {
  partner: GroupWorkspacePartner;
  currentGroup: GroupWorkspaceGroup | null;
  groups: GroupWorkspaceGroup[];
  canManage: boolean;
  selected: boolean;
  onToggle: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  compact?: boolean;
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
      className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition ${selected ? "border-[#9EB4FF] bg-[#F2F6FF]" : currentGroup ? "border-[#E8E2F1] bg-[#FCFBFE] hover:border-[#D8CDEA]" : "border-[#F3D7AC] bg-white hover:border-[#EFC27F]"} ${compact ? "min-h-[48px]" : ""}`}
    >
      {canManage ? (
        <input type="checkbox" checked={selected} onChange={onToggle} className="h-3.5 w-3.5 shrink-0 rounded border-[#B9C6D5] accent-[#315FEA]" aria-label={`Select ${partner.display_name}`} />
      ) : null}
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${currentGroup ? "bg-[#F0ECFA] text-[#7356C5]" : "bg-[#FFF3DF] text-[#DA8100]"}`}>
        <UserRound className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[8.5px] font-bold text-[#2A405B]">{partner.display_name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[7px] font-medium text-[#8593A4]">{partner.partner_code}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[6px] font-bold uppercase ${currentGroup ? "bg-[#F1ECFA] text-[#6E58A8]" : "bg-[#FFF1D9] text-[#C87900]"}`}>{partner.partner_kind === "business" ? "Business" : "Individual"}</span>
        </div>
      </div>
      {canManage ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <GripVertical className="h-3.5 w-3.5 cursor-grab text-[#B2BDCA] opacity-0 transition group-hover:opacity-100" />
          {alternatives.length ? (
            <form action={assignIntermediaryGroupMembers} className="flex items-center">
              <input type="hidden" name="partner_id" value={partner.id} />
              <select name="group_id" defaultValue="" required className="h-7 max-w-[105px] rounded-md border border-transparent bg-transparent px-1 text-[7px] text-[#718197] opacity-0 outline-none transition hover:border-[#D7E0EA] hover:bg-white group-hover:opacity-100 focus:opacity-100">
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

function Metric({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "blue" | "violet" | "green" | "amber";
  icon: React.ReactNode;
}) {
  const styles = {
    blue: "border-[#DCE9FF] bg-[linear-gradient(135deg,#F4F8FF,#EDF5FF)] text-[#2E77D0]",
    violet: "border-[#E8DDFC] bg-[linear-gradient(135deg,#FAF6FF,#F4EEFF)] text-[#7753D5]",
    green: "border-[#DDF1E4] bg-[linear-gradient(135deg,#F5FBF7,#EDF9F1)] text-[#3E9A5E]",
    amber: "border-[#F8E8C8] bg-[linear-gradient(135deg,#FFF9EF,#FFF3DE)] text-[#E59800]",
  } as const;
  return (
    <div className={`flex min-h-[112px] items-center gap-3 rounded-2xl border px-4 py-3 ${styles[tone]}`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/75 shadow-sm ring-1 ring-black/5">{icon}</span>
      <div>
        <p className="text-[8px] font-bold uppercase tracking-[0.055em] opacity-80">{label}</p>
        <p className="mt-1 text-[20px] font-extrabold tracking-[-0.03em] text-[#17365D]">{value}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "blue" | "violet" | "amber" | "green" }) {
  const styles = {
    blue: "border-[#DDE8FF] bg-[#F3F7FF] text-[#315FEA]",
    violet: "border-[#E9E0FA] bg-[#F7F3FF] text-[#7753D5]",
    amber: "border-[#F6E2BE] bg-[#FFF7E9] text-[#D98100]",
    green: "border-[#DDEFE3] bg-[#F1FAF4] text-[#398C57]",
  } as const;
  return <span className={`rounded-lg border px-2.5 py-1.5 text-[7.5px] font-semibold ${styles[tone]}`}><b>{value}</b> {label}</span>;
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
