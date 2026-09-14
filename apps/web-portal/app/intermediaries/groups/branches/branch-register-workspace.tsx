"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, GitBranch, Plus, Store } from "lucide-react";
import {
  BrokerRegisterShell,
  BrokerRegisterToolbar,
  RegisterEmpty,
  RegisterPagination,
  RegisterSelect,
  RegisterViewTabs,
} from "@/components/broker-register";

export type BranchRegisterRow = {
  id: string;
  branch_code: string;
  branch_name: string;
  branch_kind: string;
  branch_status: string;
  parent_partner_id: string | null;
  parent_partner_code: string | null;
  parent_partner_name: string | null;
  group_code: string | null;
  group_name: string | null;
  employee_code: string | null;
  employee_name: string | null;
};

type ViewKey = "all" | "assigned" | "unassigned";

const PAGE_SIZE = 10;

export function BranchRegisterWorkspace({
  rows,
  canManage,
  loadError,
}: {
  rows: BranchRegisterRow[];
  canManage: boolean;
  loadError: boolean;
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewKey>("all");
  const [group, setGroup] = useState("all");
  const [page, setPage] = useState(1);

  const assignedCount = useMemo(() => rows.filter((row) => Boolean(row.parent_partner_id)).length, [rows]);
  const unassignedCount = rows.length - assignedCount;
  const groupOptions = useMemo(() => {
    const unique = new Map<string, string>();
    rows.forEach((row) => {
      if (row.group_code && row.group_name) unique.set(row.group_code, row.group_name);
    });
    return Array.from(unique.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesView =
        view === "all"
        || (view === "assigned" && Boolean(row.parent_partner_id))
        || (view === "unassigned" && !row.parent_partner_id);
      const matchesGroup = group === "all" || row.group_code === group;
      const haystack = [
        row.branch_name,
        row.branch_code,
        row.branch_kind,
        row.parent_partner_name,
        row.parent_partner_code,
        row.group_name,
        row.group_code,
        row.employee_name,
        row.employee_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesView && matchesGroup && (!normalized || haystack.includes(normalized));
    });
  }, [group, query, rows, view]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <BrokerRegisterShell
      eyebrow="Intermediary hierarchy"
      title="Branch Register"
      description="View every accessible Branch together with its parent Partner, inherited Business Group and assigned employee."
      icon={<Store className="h-5 w-5" />}
      metrics={[
        { label: "Branches", value: rows.length, hint: "Accessible records", tone: "navy" },
        { label: "Assigned", value: assignedCount, hint: "Linked to a Partner", tone: "green" },
        { label: "Unassigned", value: unassignedCount, hint: "Need parent Partner", tone: unassignedCount ? "amber" : "slate" },
        { label: "Groups", value: groupOptions.length, hint: "Inherited groups", tone: "slate" },
      ]}
    >
      <BrokerRegisterToolbar
        query={query}
        onQueryChange={(value) => { setQuery(value); setPage(1); }}
        searchPlaceholder="Search branch, code, parent Partner, Group or employee"
        activeViewLabel={`${filteredRows.length} in current view`}
        action={canManage ? (
          <Link
            prefetch={false}
            href="/intermediaries/groups/branches/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#17365D] px-3 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.22)]"
          >
            <Plus className="h-4 w-4" /> Add Branch
          </Link>
        ) : undefined}
      >
        <RegisterViewTabs
          value={view}
          onChange={(value) => { setView(value as ViewKey); setPage(1); }}
          options={[
            { value: "all", label: "All", count: rows.length },
            { value: "assigned", label: "Assigned", count: assignedCount },
            { value: "unassigned", label: "Unassigned", count: unassignedCount },
          ]}
        />
        <RegisterSelect value={group} onChange={(value) => { setGroup(value); setPage(1); }} label="Business Group">
          <option value="all">All groups</option>
          {groupOptions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </RegisterSelect>
        <Link
          prefetch={false}
          href="/intermediaries/groups"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10.5px] font-semibold text-[#334155]"
        >
          <GitBranch className="h-4 w-4" /> Business Groups
        </Link>
      </BrokerRegisterToolbar>

      {loadError ? (
        <div className="border-b border-[#F4D6D6] bg-[#FFF7F7] px-4 py-3 text-[11px] font-semibold text-[#9B2C2C]">
          Some Branch hierarchy data could not be loaded. Refresh before relying on the register.
        </div>
      ) : null}

      <div className="mobile-card-list p-3 md:hidden">
        {pageRows.map((branch) => <BranchMobileCard key={branch.id} branch={branch} />)}
        {!pageRows.length ? <RegisterEmpty title="No matching branches" description="Adjust the search, assignment view or Business Group filter." /> : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1040px] table-fixed text-left text-[11px] text-[#1E293B]">
          <thead className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
            <tr>
              <th className="w-[220px] px-3 py-2.5">Branch</th>
              <th className="w-[220px] px-3 py-2.5">Parent Partner</th>
              <th className="w-[190px] px-3 py-2.5">Business Group</th>
              <th className="w-[190px] px-3 py-2.5">Assigned Employee</th>
              <th className="w-[130px] px-3 py-2.5">Type</th>
              <th className="w-[110px] px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F6]">
            {pageRows.map((branch) => (
              <tr key={branch.id} className="h-12 hover:bg-[#FAFCFF]">
                <td className="px-3">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-bold text-[#0F172A]">{branch.branch_name}</p>
                    <p className="mt-0.5 truncate text-[9px] font-medium text-[#64748B]">{branch.branch_code}</p>
                  </div>
                </td>
                <td className="px-3">
                  {branch.parent_partner_name ? (
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#334155]">{branch.parent_partner_name}</p>
                      <p className="mt-0.5 truncate text-[9px] text-[#64748B]">{branch.parent_partner_code ?? "—"}</p>
                    </div>
                  ) : <UnassignedLabel />}
                </td>
                <td className="px-3">
                  {branch.group_name ? (
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#334155]">{branch.group_name}</p>
                      <p className="mt-0.5 truncate text-[9px] text-[#64748B]">{branch.group_code ?? "—"}</p>
                    </div>
                  ) : <span className="text-[#94A3B8]">—</span>}
                </td>
                <td className="px-3">
                  {branch.employee_name ? (
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#334155]">{branch.employee_name}</p>
                      <p className="mt-0.5 truncate text-[9px] text-[#64748B]">{branch.employee_code ?? "—"}</p>
                    </div>
                  ) : <span className="text-[#94A3B8]">—</span>}
                </td>
                <td className="px-3"><span className="capitalize text-[#475569]">{humanize(branch.branch_kind)}</span></td>
                <td className="px-3"><StatusPill status={branch.branch_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pageRows.length ? <RegisterEmpty title="No matching branches" description="Adjust the search, assignment view or Business Group filter." /> : null}
      </div>

      <RegisterPagination
        pageRows={pageRows.length}
        filteredRows={filteredRows.length}
        safePage={safePage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        onPrevious={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
      />
    </BrokerRegisterShell>
  );
}

function BranchMobileCard({ branch }: { branch: BranchRegisterRow }) {
  return (
    <article className="mobile-record-card">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF3FF] text-[#315FEA]">
          <Store className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-extrabold text-[#12203B]">{branch.branch_name}</p>
              <p className="mt-0.5 truncate text-[11px] text-[#66748A]">{branch.branch_code}</p>
            </div>
            <StatusPill status={branch.branch_status} />
          </div>
          <div className="mt-3 grid gap-2 text-[12px] text-[#53627A]">
            <div className="flex min-h-10 items-center gap-2 rounded-xl bg-[#F8FAFC] px-3">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{branch.parent_partner_name ?? "Unassigned parent Partner"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <Info label="Group" value={branch.group_name ?? "—"} />
              <Info label="Employee" value={branch.employee_name ?? "—"} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E5EAF1] bg-white px-3 py-2">
      <p className="text-[8px] font-bold uppercase tracking-[0.06em] text-[#94A3B8]">{label}</p>
      <p className="mt-0.5 truncate font-semibold text-[#334155]">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active_partner";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.05em] ${active ? "bg-[#EAF8EF] text-[#267A49]" : "bg-[#F1F5F9] text-[#64748B]"}`}>
      {active ? "Active" : humanize(status)}
    </span>
  );
}

function UnassignedLabel() {
  return <span className="inline-flex rounded-full bg-[#FFF4D9] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.05em] text-[#A76600]">Unassigned</span>;
}

function humanize(value: string) {
  return value.replace(/_/g, " ");
}
