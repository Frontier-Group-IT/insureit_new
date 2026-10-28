"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IntermediaryTabs } from "../intermediary-tabs";
import {
  Archive,
  Building2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  archiveBusinessGroup,
  assignBusinessGroupMembers,
  assignPartnerBranch,
  convertLegacyGroupToBusiness,
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
  is_branch_profile: boolean;
  email?: string | null;
  phone?: string | null;
  contact_name?: string | null;
};

export type BusinessGroupMembership = {
  id: string;
  group_id: string;
  partner_id: string;
  effective_from: string;
};

const successMessages: Record<string, string> = {
  business_group_created: "Business Group created.",
  business_group_created_invited: "Business Group created. Password setup invitation sent to the Group email.",
  group_converted: "Group converted to the employee-independent business hierarchy.",
  business_members_moved: "Partner moved to the selected Group.",
  business_members_removed: "Partner removed from the Group.",
  business_group_updated: "Group updated.",
  business_group_archived: "Group archived.",
  branch_created: "Branch created and tagged to the selected Partner.",
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
  const [branchOpen, setBranchOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(Boolean(success));

  useEffect(() => {
    if (!success) {
      setShowSuccess(false);
      return;
    }

    setShowSuccess(true);
    const timeoutId = window.setTimeout(() => {
      setShowSuccess(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [success]);

  const normalizedQuery = query.trim().toLowerCase();
  const membershipByPartner = useMemo(
    () => new Map(memberships.map((membership) => [membership.partner_id, membership])),
    [memberships],
  );
  const rootPartners = useMemo(
    () => partners.filter((partner) => !partner.parent_partner_id && !partner.is_branch_profile),
    [partners],
  );
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

  const branchCandidates = partners.filter(
    (partner) => partner.is_branch_profile && !partner.parent_partner_id && !membershipByPartner.has(partner.id),
  );

  const visibleGroups = groups.filter((group) => {
    if (!normalizedQuery) return true;
    if (group.group_name.toLowerCase().includes(normalizedQuery) || group.group_code.toLowerCase().includes(normalizedQuery) || group.description?.toLowerCase().includes(normalizedQuery)) return true;
    const memberIds = memberships.filter((membership) => membership.group_id === group.id).map((membership) => membership.partner_id);
    return memberIds.some((partnerId) => {
      const root = partners.find((partner) => partner.id === partnerId);
      if (partnerMatches(root, normalizedQuery)) return true;
      return (branchesByParent.get(partnerId) ?? []).some((branch) => partnerMatches(branch, normalizedQuery));
    });
  });


  return (
    <div className="mx-auto max-w-[1540px] space-y-4 pb-24">
      {!hierarchyReady ? <Notice tone="warning" text="Hierarchy migration is not applied yet. The page remains read-only and compatible with the current live schema until the migration is applied through the protected database workflow." /> : null}
      {showSuccess && success ? <SuccessToast text={successMessages[success] ?? "Action completed."} /> : null}
      {error ? <Notice tone="error" text={decodeURIComponent(error)} /> : null}
      {loadError ? <Notice tone="error" text="Some hierarchy data could not be loaded. No changes were made; refresh before editing." /> : null}

      <section className="overflow-hidden rounded-2xl border border-[#DCE5F1] bg-white shadow-sm">
        <IntermediaryTabs active="group" embedded />
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E7ECF3] bg-[#FAFCFF] px-4 py-3">
          <h2 className="shrink-0 text-[13px] font-bold text-[#17365D]">Group Register</h2>
          <div className="relative min-w-[260px] flex-1 lg:max-w-2xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B9AAF]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search group, branch, contact, mobile, email or code" className="h-10 w-full rounded-xl border border-[#D7E0EA] bg-white pl-10 pr-3 text-[10px] text-[#1E344F] shadow-sm outline-none focus:border-[#7D94E6] focus:ring-2 focus:ring-[#E8EDFF]" />
          </div>
          {canManage ? <Link href="/intermediaries/groups/new" aria-disabled={!hierarchyReady} className={`ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#315FEA] px-3 text-[10px] font-bold text-white ${!hierarchyReady?"pointer-events-none opacity-45":""}`}><Plus className="h-3.5 w-3.5" /> Create Group</Link> : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed text-left text-[11px]">
            <thead className="bg-[#F8FAFC] text-[9px] font-bold uppercase tracking-wide text-[#64748B]"><tr><th className="w-[47%] px-4 py-3">Group Name / Code</th><th className="w-[25%] px-3 py-3">Type</th><th className="w-[14%] px-3 py-3 text-center">Partners</th><th className="w-[14%] px-3 py-3 text-center">Branches</th></tr></thead>
            <tbody className="divide-y divide-[#E7ECF3]">
          {visibleGroups.length ? visibleGroups.map((group) => {
            const memberIds = memberships.filter((membership) => membership.group_id === group.id).map((membership) => membership.partner_id);
            const members = rootPartners.filter((partner) => memberIds.includes(partner.id));
            const branchCount = members.reduce((count, partner) => count + (branchesByParent.get(partner.id)?.length ?? 0), 0);

            return (
              <tr key={group.id} role="link" tabIndex={0} aria-label={`Open ${group.group_name} group details`} onClick={() => window.location.assign(`/intermediaries/groups/${group.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); window.location.assign(`/intermediaries/groups/${group.id}`); } }} className="cursor-pointer bg-white transition-colors hover:bg-[#F1F6FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7D94E6]">
                <td className="px-4 py-2.5"><p className="truncate font-semibold text-[#17365D]">{group.group_name}</p><p className="text-[9px] text-[#8190A4]">{group.group_code}</p></td>
                <td className="px-3 py-2.5"><span className={`rounded-md px-2 py-1 text-[9px] font-semibold ${group.group_mode === "legacy_employee" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{group.group_mode === "legacy_employee" ? "Legacy employee-linked" : "Business hierarchy"}</span></td>
                <td className="px-3 py-2.5 text-center font-semibold">{members.length}</td>
                <td className="px-3 py-2.5 text-center font-semibold">{branchCount}</td>
              </tr>
            );
          }) : <tr><td colSpan={4} className="px-4 py-10 text-center text-[11px] text-[#7C8A9C]">No Groups match the current search.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {branchOpen ? (
        <Modal title="Assign Branch" onClose={() => setBranchOpen(false)}>
          <form action={assignPartnerBranch} className="space-y-3">
            <Field label="Parent Partner"><select name="parent_partner_id" required defaultValue="" className={inputClass}><option value="">Select parent Partner</option>{rootPartners.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name} · {partner.partner_code}</option>)}</select></Field>
            <Field label="Branch"><select name="branch_partner_id" required defaultValue="" className={inputClass}><option value="">{branchCandidates.length ? "Select unassigned Branch" : "No unassigned Branches available"}</option>{branchCandidates.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name} · {partner.partner_code}</option>)}</select></Field>
            <p className="rounded-xl bg-[#FFF9EB] px-3 py-2 text-[7.8px] leading-4 text-[#84652D]">Only Branch profiles created through Branch Onboarding are shown here. POSP, MISP and ordinary Partner profiles are excluded.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setBranchOpen(false)} className="h-9 rounded-lg border border-[#D7E0EA] bg-white px-4 text-[8.5px] font-bold text-[#5D6F82]">Cancel</button>
              <FormSubmitButton disabled={!branchCandidates.length} label="Assign Branch" pendingLabel="Assigning…" className="inline-flex h-9 items-center rounded-lg bg-[#315FEA] px-4 text-[8.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45" />
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function PartnerTreeRow({ partner, branches, group, canManage }: { partner: BusinessGroupPartner; branches: BusinessGroupPartner[]; group: BusinessGroup; canManage: boolean }) {
  return (
    <div className="rounded-xl border border-[#E1E8F1] bg-[#FCFDFF]">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#EDF3FF] text-[#315FEA]"><Building2 className="h-3.5 w-3.5" /></span>
        <div className="min-w-0 flex-1"><p className="truncate text-[9.5px] font-bold text-[#29425E]">{partner.display_name}</p><p className="mt-0.5 text-[7.5px] text-[#8794A3]">{partner.partner_code} · {branches.length} Branch{branches.length === 1 ? "" : "es"}</p></div>
        {canManage ? <form action={removeBusinessGroupMembers}><input type="hidden" name="group_id" value={group.id} /><input type="hidden" name="partner_id" value={partner.id} /><FormSubmitButton label="Remove" pendingLabel="Removing…" className="inline-flex h-8 items-center rounded-lg border border-[#E1E7EE] bg-white px-3 text-[7.8px] font-bold text-[#6A7B8E] hover:bg-[#F5F7FA]" /></form> : null}
      </div>
      {branches.length ? (
        <div className="border-t border-[#EDF1F6] bg-white px-3 py-2"><div className="ml-4 space-y-1.5 border-l border-[#D9E4F0] pl-4">{branches.map((branch) => (
          <div key={branch.id} className="flex items-center gap-2 rounded-lg bg-[#F8FAFD] px-2.5 py-2">
            <GitBranch className="h-3.5 w-3.5 text-[#7A8CA1]" />
            <div className="min-w-0 flex-1"><p className="truncate text-[8.5px] font-semibold text-[#40566F]">{branch.display_name}</p><p className="text-[7px] text-[#93A0AF]">{branch.partner_code}</p></div>
            {canManage ? <form action={removePartnerBranch}><input type="hidden" name="branch_partner_id" value={branch.id} /><FormSubmitButton label="Detach" pendingLabel="Detaching…" className="inline-flex h-7 items-center rounded-md border border-[#E1E7EE] bg-white px-2.5 text-[7px] font-bold text-[#6A7B8E] hover:bg-[#F5F7FA]" /></form> : null}
          </div>
        ))}</div></div>
      ) : null}
    </div>
  );
}

function SuccessToast({ text }: { text: string }) {
  return <div role="status" aria-live="polite" className="fixed right-5 top-24 z-[90] max-w-[360px] rounded-xl border border-emerald-200 bg-white px-4 py-3 text-[9px] font-semibold text-emerald-800 shadow-[0_14px_38px_rgba(16,91,64,.18)]">{text}</div>;
}

function Notice({ tone, text }: { tone: "success" | "error" | "warning"; text: string }) {
  const toneClass = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800";
  return <div className={`rounded-xl border px-4 py-3 text-[9px] font-semibold ${toneClass}`}>{text}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0 flex-1"><span className="mb-1 block text-[7.5px] font-bold uppercase tracking-[0.04em] text-[#718198]">{label}</span>{children}</label>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-[#10243A]/35 p-4 backdrop-blur-[2px]"><div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#DCE5F1] bg-white shadow-[0_24px_70px_rgba(12,33,58,.24)]"><div className="flex items-center justify-between border-b border-[#E7ECF3] px-4 py-3"><h3 className="text-[11px] font-bold text-[#203A59]">{title}</h3><button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-[#718198] hover:bg-[#F4F6F9]"><X className="h-4 w-4" /></button></div><div className="p-4">{children}</div></div></div>;
}

function partnerMatches(partner: BusinessGroupPartner | undefined, query: string) {
  if (!partner) return false;
  return [partner.display_name, partner.partner_code, partner.contact_name, partner.email, partner.phone].some((value) => value?.toLowerCase().includes(query) || value?.replace(/\\D/g, "").includes(query.replace(/\\D/g, "")) && /\\d/.test(query));
}

const inputClass = "h-9 w-full rounded-lg border border-[#D7E0EA] bg-white px-3 text-[8.5px] text-[#30465F] outline-none focus:border-[#7892E8] focus:ring-2 focus:ring-[#E9EEFF]";
