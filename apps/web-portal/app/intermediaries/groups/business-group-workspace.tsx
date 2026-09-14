"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  Building2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Layers3,
  Pencil,
  Plus,
  Search,
  Store,
  UsersRound,
  X,
} from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  archiveBusinessGroup,
  assignBusinessGroupMembers,
  assignPartnerBranch,
  convertLegacyGroupToBusiness,
  createBusinessGroup,
  removeBusinessGroupMembers,
  removePartnerBranch,
  renameBusinessGroup,
} from "./business-group-actions";

export type BusinessGroup = {
  id: string;
  group_code: string;
  group_name: string;
  group_mode: "legacy_employee" | "business";
  owner_employee_id: string | null;
  status: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
};

export type BusinessGroupPartner = {
  id: string;
  partner_code: string;
  partner_kind: string;
  display_name: string;
  parent_partner_id: string | null;
  owner_employee_id: string | null;
};

export type BusinessGroupMembership = {
  id: string;
  group_id: string;
  partner_id: string;
  effective_from: string;
};

const successMessages: Record<string, string> = {
  business_group_created: "Business Group created.",
  group_converted: "Group converted to the employee-independent business hierarchy.",
  business_members_moved: "Partner moved to the selected Group.",
  business_members_removed: "Partner removed from the Group.",
  business_group_updated: "Group updated.",
  business_group_archived: "Group archived.",
  branch_assigned: "Branch linked to its parent Partner.",
  branch_removed: "Branch detached from its parent Partner.",
};

export function BusinessGroupWorkspace({
  groups,
  partners,
  memberships,
  canManage,
  hierarchyReady,
  success,
  error,
  loadError,
}: {
  groups: BusinessGroup[];
  partners: BusinessGroupPartner[];
  memberships: BusinessGroupMembership[];
  canManage: boolean;
  hierarchyReady: boolean;
  success?: string;
  error?: string;
  loadError: boolean;
}) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(groups.map((group) => group.id)));
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const membershipByPartner = useMemo(
    () => new Map(memberships.map((membership) => [membership.partner_id, membership])),
    [memberships],
  );
  const rootPartners = useMemo(() => partners.filter((partner) => !partner.parent_partner_id), [partners]);
  const branchesByParent = useMemo(() => {
    const map = new Map<string, BusinessGroupPartner[]>();
    partners.forEach((partner) => {
      if (!partner.parent_partner_id) return;
      const list = map.get(partner.parent_partner_id) ?? [];
      list.push(partner);
      map.set(partner.parent_partner_id, list);
    });
    return map;
  }, [partners]);

  const ungroupedRoots = rootPartners.filter((partner) => !membershipByPartner.has(partner.id));
  const branchCandidates = ungroupedRoots.filter((partner) => !(branchesByParent.get(partner.id)?.length));

  const visibleGroups = groups.filter((group) => {
    if (!normalizedQuery) return true;
    if (group.group_name.toLowerCase().includes(normalizedQuery) || group.group_code.toLowerCase().includes(normalizedQuery)) return true;
    const memberIds = memberships.filter((membership) => membership.group_id === group.id).map((membership) => membership.partner_id);
    return memberIds.some((partnerId) => {
      const root = partners.find((partner) => partner.id === partnerId);
      if (partnerMatches(root, normalizedQuery)) return true;
      return (branchesByParent.get(partnerId) ?? []).some((branch) => partnerMatches(branch, normalizedQuery));
    });
  });

  function toggleGroup(groupId: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-[1540px] space-y-4 pb-24">
      <section className="rounded-[22px] border border-[#DCE5F1] bg-white p-4 shadow-[0_18px_50px_rgba(24,59,102,.08)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#EEF3FF] text-[#315FEA] ring-1 ring-[#D9E4FF]">
              <Layers3 className="h-6 w-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[19px] font-bold tracking-[-0.025em] text-[#142B4A]">Business Groups</h1>
                <span className="rounded-full bg-[#EAF0FF] px-2.5 py-1 text-[7px] font-bold uppercase tracking-[0.06em] text-[#315FEA]">Group → Partner → Branch</span>
              </div>
              <p className="mt-1 max-w-3xl text-[10px] leading-5 text-[#61738A]">
                Groups describe the business hierarchy only. Employee assignment remains on each intermediary independently and is not part of Group ownership.
              </p>
            </div>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBranchOpen(true)}
                disabled={!hierarchyReady}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#D7E0EA] bg-white px-4 text-[9px] font-bold text-[#3156B8] shadow-sm transition hover:bg-[#F5F8FF] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <GitBranch className="h-4 w-4" /> Assign Branch
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                disabled={!hierarchyReady}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#315FEA] px-4 text-[9px] font-bold text-white shadow-[0_8px_20px_rgba(49,95,234,.22)] transition hover:bg-[#254DD0] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Plus className="h-4 w-4" /> Create Group
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Groups" value={groups.length} icon={<Layers3 className="h-4 w-4" />} />
          <Metric label="Root Partners" value={rootPartners.length} icon={<Building2 className="h-4 w-4" />} />
          <Metric label="Branches" value={partners.length - rootPartners.length} icon={<Store className="h-4 w-4" />} />
          <Metric label="Ungrouped Partners" value={ungroupedRoots.length} icon={<UsersRound className="h-4 w-4" />} />
        </div>
      </section>

      {!hierarchyReady ? (
        <Notice tone="warning" text="Hierarchy migration is not applied yet. The page remains read-only and compatible with the current live schema until the migration is applied through the protected database workflow." />
      ) : null}
      {success ? <Notice tone="success" text={successMessages[success] ?? "Action completed."} /> : null}
      {error ? <Notice tone="error" text={decodeURIComponent(error)} /> : null}
      {loadError ? <Notice tone="error" text="Some hierarchy data could not be loaded. No changes were made; refresh before editing." /> : null}

      <section className="overflow-hidden rounded-[22px] border border-[#DCE5F1] bg-white shadow-[0_14px_40px_rgba(24,59,102,.06)]">
        <div className="border-b border-[#E7ECF3] bg-[#FAFCFF] p-4">
          <div className="relative max-w-2xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B9AAF]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Group, Partner or Branch"
              className="h-10 w-full rounded-xl border border-[#D7E0EA] bg-white pl-10 pr-3 text-[10px] text-[#1E344F] shadow-sm outline-none focus:border-[#7D94E6] focus:ring-2 focus:ring-[#E8EDFF]"
            />
          </div>
        </div>

        <div className="space-y-3 p-4">
          {visibleGroups.length ? visibleGroups.map((group) => {
            const memberIds = memberships.filter((membership) => membership.group_id === group.id).map((membership) => membership.partner_id);
            const members = rootPartners.filter((partner) => memberIds.includes(partner.id));
            const branchCount = members.reduce((count, partner) => count + (branchesByParent.get(partner.id)?.length ?? 0), 0);
            const expanded = expandedGroups.has(group.id);
            const editing = editingGroupId === group.id;

            return (
              <article key={group.id} className="overflow-hidden rounded-2xl border border-[#DCE5F1] bg-white">
                <div className="flex flex-wrap items-center gap-3 bg-[linear-gradient(90deg,#F8FBFF,#F3F7FF_60%,#FCFDFF)] px-4 py-3">
                  <button type="button" onClick={() => toggleGroup(group.id)} className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#516A85] ring-1 ring-[#E1E7EF]">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF0FF] text-[#315FEA]"><Layers3 className="h-4.5 w-4.5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-[11px] font-bold text-[#1C3858]">{group.group_name}</h2>
                      {group.group_mode === "legacy_employee" ? (
                        <span className="rounded-full bg-[#FFF4D9] px-2 py-0.5 text-[6.5px] font-bold uppercase tracking-[0.05em] text-[#A76600]">Legacy employee-linked</span>
                      ) : (
                        <span className="rounded-full bg-[#EAF8EF] px-2 py-0.5 text-[6.5px] font-bold uppercase tracking-[0.05em] text-[#267A49]">Business hierarchy</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[8px] text-[#7A899A]">{group.group_code} · {members.length} Partner{members.length === 1 ? "" : "s"} · {branchCount} Branch{branchCount === 1 ? "" : "es"}</p>
                  </div>
                  {canManage && hierarchyReady ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {group.group_mode === "legacy_employee" ? (
                        <form action={convertLegacyGroupToBusiness}>
                          <input type="hidden" name="group_id" value={group.id} />
                          <FormSubmitButton label="Convert safely" pendingLabel="Converting…" className="inline-flex h-8 items-center rounded-lg border border-[#F0D79B] bg-[#FFF9EB] px-3 text-[8px] font-bold text-[#A76600] hover:bg-[#FFF3D5]" />
                        </form>
                      ) : null}
                      <button type="button" onClick={() => setEditingGroupId(editing ? null : group.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#D7E0EA] bg-white text-[#5A6F86] hover:bg-[#F5F8FC]" title="Edit Group">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>

                {editing ? (
                  <div className="border-t border-[#EDF1F6] bg-[#FBFCFE] p-3">
                    <form action={renameBusinessGroup} className="flex flex-col gap-2 lg:flex-row lg:items-end">
                      <input type="hidden" name="group_id" value={group.id} />
                      <Field label="Group name"><input name="group_name" defaultValue={group.group_name} required maxLength={80} className={inputClass} /></Field>
                      <Field label="Description"><input name="description" defaultValue={group.description ?? ""} className={inputClass} /></Field>
                      <FormSubmitButton label="Save" pendingLabel="Saving…" className="inline-flex h-9 items-center justify-center rounded-lg bg-[#315FEA] px-4 text-[8.5px] font-bold text-white" />
                    </form>
                  </div>
                ) : null}

                {expanded ? (
                  <div className="space-y-2 border-t border-[#EDF1F6] p-3">
                    {members.length ? members.map((partner) => (
                      <PartnerTreeRow
                        key={partner.id}
                        partner={partner}
                        branches={branchesByParent.get(partner.id) ?? []}
                        group={group}
                        canManage={canManage && hierarchyReady && group.group_mode === "business"}
                      />
                    )) : (
                      <div className="rounded-xl border border-dashed border-[#D9E2EC] bg-[#FBFCFE] px-4 py-6 text-center text-[8.5px] text-[#7C8A9C]">No Partners are assigned to this Group yet.</div>
                    )}

                    {canManage && hierarchyReady && group.group_mode === "business" && ungroupedRoots.length ? (
                      <form action={assignBusinessGroupMembers} className="mt-2 flex flex-col gap-2 rounded-xl border border-[#E2E8F1] bg-[#FBFCFE] p-3 sm:flex-row sm:items-end">
                        <input type="hidden" name="group_id" value={group.id} />
                        <Field label="Add / move Partner">
                          <select name="partner_id" required defaultValue="" className={inputClass}>
                            <option value="">Select ungrouped Partner</option>
                            {ungroupedRoots.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name} · {partner.partner_code}</option>)}
                          </select>
                        </Field>
                        <FormSubmitButton label="Add to Group" pendingLabel="Adding…" className="inline-flex h-9 items-center justify-center rounded-lg border border-[#CCD7E4] bg-white px-4 text-[8.5px] font-bold text-[#3156B8] hover:bg-[#F5F8FF]" />
                      </form>
                    ) : null}

                    {canManage && hierarchyReady && members.length === 0 ? (
                      <form action={archiveBusinessGroup} className="pt-1">
                        <input type="hidden" name="group_id" value={group.id} />
                        <FormSubmitButton label="Archive empty Group" pendingLabel="Archiving…" className="inline-flex h-8 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-[8px] font-bold text-red-700 hover:bg-red-50" />
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          }) : (
            <div className="rounded-2xl border border-dashed border-[#D9E2EC] bg-[#FBFCFE] px-4 py-10 text-center text-[9px] text-[#7C8A9C]">No Groups match the current search.</div>
          )}
        </div>
      </section>

      {ungroupedRoots.length ? (
        <section className="rounded-[22px] border border-[#F0DFC0] bg-[#FFFCF6] p-4">
          <h2 className="text-[11px] font-bold text-[#76541E]">Ungrouped root Partners</h2>
          <p className="mt-1 text-[8px] text-[#9A7B4B]">These are available for Group assignment or, where appropriate, can be linked as a Branch under another Partner.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {ungroupedRoots.map((partner) => (
              <div key={partner.id} className="rounded-xl border border-[#F0E3CC] bg-white px-3 py-2.5">
                <p className="truncate text-[9px] font-bold text-[#3A4E65]">{partner.display_name}</p>
                <p className="mt-0.5 text-[7.5px] text-[#8794A3]">{partner.partner_code}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {createOpen ? (
        <Modal title="Create Business Group" onClose={() => setCreateOpen(false)}>
          <form action={createBusinessGroup} className="space-y-3">
            <Field label="Group name"><input name="group_name" required maxLength={80} className={inputClass} /></Field>
            <Field label="Description"><input name="description" className={inputClass} /></Field>
            <Field label="Initial Partner (optional)">
              <select name="partner_id" defaultValue="" className={inputClass}>
                <option value="">Create empty Group</option>
                {ungroupedRoots.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name} · {partner.partner_code}</option>)}
              </select>
            </Field>
            <p className="rounded-xl bg-[#F5F8FF] px-3 py-2 text-[7.8px] leading-4 text-[#61738A]">No Employee owner will be created. Existing Employee assignments on the selected Partner remain unchanged.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="h-9 rounded-lg border border-[#D7E0EA] bg-white px-4 text-[8.5px] font-bold text-[#5D6F82]">Cancel</button>
              <FormSubmitButton label="Create Group" pendingLabel="Creating…" className="inline-flex h-9 items-center rounded-lg bg-[#315FEA] px-4 text-[8.5px] font-bold text-white" />
            </div>
          </form>
        </Modal>
      ) : null}

      {branchOpen ? (
        <Modal title="Assign Partner as Branch" onClose={() => setBranchOpen(false)}>
          <form action={assignPartnerBranch} className="space-y-3">
            <Field label="Parent Partner">
              <select name="parent_partner_id" required defaultValue="" className={inputClass}>
                <option value="">Select parent Partner</option>
                {rootPartners.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name} · {partner.partner_code}</option>)}
              </select>
            </Field>
            <Field label="Branch profile">
              <select name="branch_partner_id" required defaultValue="" className={inputClass}>
                <option value="">Select ungrouped Partner profile</option>
                {branchCandidates.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name} · {partner.partner_code}</option>)}
              </select>
            </Field>
            <p className="rounded-xl bg-[#FFF9EB] px-3 py-2 text-[7.8px] leading-4 text-[#84652D]">This does not delete or recreate the Branch profile. It only adds a reversible parent relationship. A directly grouped Partner must be removed from its Group before it can become a Branch.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setBranchOpen(false)} className="h-9 rounded-lg border border-[#D7E0EA] bg-white px-4 text-[8.5px] font-bold text-[#5D6F82]">Cancel</button>
              <FormSubmitButton label="Assign Branch" pendingLabel="Assigning…" className="inline-flex h-9 items-center rounded-lg bg-[#315FEA] px-4 text-[8.5px] font-bold text-white" />
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function PartnerTreeRow({
  partner,
  branches,
  group,
  canManage,
}: {
  partner: BusinessGroupPartner;
  branches: BusinessGroupPartner[];
  group: BusinessGroup;
  canManage: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#E1E8F1] bg-[#FCFDFF]">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#EDF3FF] text-[#315FEA]"><Building2 className="h-3.5 w-3.5" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[9.5px] font-bold text-[#29425E]">{partner.display_name}</p>
          <p className="mt-0.5 text-[7.5px] text-[#8794A3]">{partner.partner_code} · {branches.length} Branch{branches.length === 1 ? "" : "es"}</p>
        </div>
        {canManage ? (
          <form action={removeBusinessGroupMembers}>
            <input type="hidden" name="group_id" value={group.id} />
            <input type="hidden" name="partner_id" value={partner.id} />
            <FormSubmitButton label="Remove" pendingLabel="Removing…" className="inline-flex h-8 items-center rounded-lg border border-[#E1E7EE] bg-white px-3 text-[7.8px] font-bold text-[#6A7B8E] hover:bg-[#F5F7FA]" />
          </form>
        ) : null}
      </div>
      {branches.length ? (
        <div className="border-t border-[#EDF1F6] bg-white px-3 py-2">
          <div className="ml-4 space-y-1.5 border-l border-[#D9E4F0] pl-4">
            {branches.map((branch) => (
              <div key={branch.id} className="flex items-center gap-2 rounded-lg bg-[#F8FAFD] px-2.5 py-2">
                <GitBranch className="h-3.5 w-3.5 text-[#7A8CA1]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[8.5px] font-semibold text-[#40566F]">{branch.display_name}</p>
                  <p className="text-[7px] text-[#93A0AF]">{branch.partner_code}</p>
                </div>
                {canManage ? (
                  <form action={removePartnerBranch}>
                    <input type="hidden" name="branch_partner_id" value={branch.id} />
                    <FormSubmitButton label="Detach" pendingLabel="Detaching…" className="inline-flex h-7 items-center rounded-md border border-[#E1E7EE] bg-white px-2.5 text-[7px] font-bold text-[#6A7B8E] hover:bg-[#F5F7FA]" />
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#E1E8F1] bg-[#FBFCFE] px-3.5 py-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-[#315FEA] shadow-sm ring-1 ring-[#E3E9F1]">{icon}</span>
      <div>
        <p className="text-[15px] font-bold text-[#203A59]">{value}</p>
        <p className="text-[7.5px] font-semibold text-[#8794A4]">{label}</p>
      </div>
    </div>
  );
}

function Notice({ tone, text }: { tone: "success" | "error" | "warning"; text: string }) {
  const toneClass = tone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-red-200 bg-red-50 text-red-800";
  return <div className={`rounded-xl border px-4 py-3 text-[9px] font-semibold ${toneClass}`}>{text}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0 flex-1"><span className="mb-1 block text-[7.5px] font-bold uppercase tracking-[0.04em] text-[#718198]">{label}</span>{children}</label>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[#10243A]/35 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#DCE5F1] bg-white shadow-[0_24px_70px_rgba(12,33,58,.24)]">
        <div className="flex items-center justify-between border-b border-[#E7ECF3] px-4 py-3">
          <h3 className="text-[11px] font-bold text-[#203A59]">{title}</h3>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-[#718198] hover:bg-[#F4F6F9]"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function partnerMatches(partner: BusinessGroupPartner | undefined, query: string) {
  if (!partner) return false;
  return partner.display_name.toLowerCase().includes(query) || partner.partner_code.toLowerCase().includes(query);
}

const inputClass = "h-9 w-full rounded-lg border border-[#D7E0EA] bg-white px-3 text-[8.5px] text-[#30465F] outline-none focus:border-[#7892E8] focus:ring-2 focus:ring-[#E9EEFF]";
