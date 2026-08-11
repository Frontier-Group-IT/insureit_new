"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { compactPrimaryActionClassName } from "@/components/action-styles";
import { FormSubmitButton } from "@/components/form-submit-button";
import { FreshAccountReviewLink } from "./applications/account-review-back-link";
import { createLinkedIntermediaryAccount } from "./applications/[id]/account-review-actions";
import { WorkflowSuccessToast } from "./applications/workflow-success-toast";

export type PartnerRegisterRow = {
  id: string;
  applicationId: string;
  displayName: string;
  mobile: string;
  partnerId: string;
  accountType: string;
  assignedRm: string;
  linkedLabel: string;
  linkedHref: string | null;
  portalAccess: string;
  partnerStatus: string;
  active: boolean;
  createType: "posp" | "misp";
  canCreateLinked: boolean;
  searchText: string;
};

type PartnerFilter = "" | "all" | "active" | "onboarding";

const partnerOpenActionClassName = "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-[#315FEA] bg-transparent px-3 text-[9px] font-semibold text-[#315FEA] transition-colors duration-150 hover:bg-[#E7E7E7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8] focus-visible:ring-offset-2 active:translate-y-px";

export function PartnerRegisterClient({
  rows,
  initialSearch,
  initialStatus,
  success,
  error,
  loadError,
}: {
  rows: PartnerRegisterRow[];
  initialSearch: string;
  initialStatus: string;
  success?: string;
  error?: string;
  loadError: boolean;
}) {
  const [search, setSearch] = useState(initialSearch);
  const initialFilter = initialStatus === "active" || initialStatus === "onboarding" ? initialStatus : "";
  const [status, setStatus] = useState(initialFilter);
  const [selectedFilter, setSelectedFilter] = useState<PartnerFilter>(initialFilter || "all");
  const normalized = search.trim().toLowerCase();
  const searchedRows = useMemo(() => normalized ? rows.filter((row) => row.searchText.includes(normalized)) : rows, [normalized, rows]);
  const counts = useMemo(() => searchedRows.reduce((acc, row) => {
    if (row.active) acc.active += 1;
    else acc.onboarding += 1;
    return acc;
  }, { active: 0, onboarding: 0 }), [searchedRows]);
  const visibleRows = status === "active" ? searchedRows.filter((row) => row.active) : status === "onboarding" ? searchedRows.filter((row) => !row.active) : searchedRows;

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (status) params.set("account_status", status);
    const nextUrl = `/intermediaries/partner${params.size ? `?${params.toString()}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState(null, "", nextUrl);
  }, [search, status]);

  const successMessage = success === "portal_login_invited"
    ? "Password creation link sent."
    : success === "portal_invite_resent"
      ? "A fresh password creation link has been sent."
      : success === "documents_completed"
        ? "Documents saved and Partner activated."
        : "Action completed.";

  function selectFilter(next: Exclude<PartnerFilter, "">) {
    setSelectedFilter(next);
    setStatus(next === "all" ? "" : next);
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-4 pb-6">
      {success ? <WorkflowSuccessToast message={successMessage} durationMs={4000} /> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10.5px] font-medium text-red-700">The requested action could not be completed. Please try again. If the problem continues, contact the system administrator.</div> : null}
      <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <div className="grid items-center gap-5 border-b border-[#E7ECF3] bg-[#FAFBFD] px-5 py-3.5 lg:grid-cols-[auto_minmax(280px,460px)_1fr]">
          <h2 className="whitespace-nowrap text-[12.5px] font-semibold text-[#17203A]">Partner Register</h2>
          <form onSubmit={(event) => event.preventDefault()} className="relative min-w-0 max-w-[460px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search partner name, mobile, email or ID" className="h-9 w-full rounded-lg border border-[#D8E1EC] bg-white pl-9 pr-3 text-[10.5px] text-[#17203A] outline-none placeholder:text-[#94A3B8] focus:border-[#315FEA] focus:ring-2 focus:ring-[#E6ECFF]" />
          </form>
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap text-[9.5px] font-semibold">
            <FilterButton label="All" count={searchedRows.length} active={selectedFilter === "all"} onClick={() => selectFilter("all")} />
            <FilterButton label="Active" count={counts.active} active={selectedFilter === "active"} onClick={() => selectFilter("active")} />
            <FilterButton label="Onboarding" count={counts.onboarding} active={selectedFilter === "onboarding"} onClick={() => selectFilter("onboarding")} />
          </div>
        </div>
        {loadError ? <div className="px-4 py-12 text-center text-[11px] text-red-700">The register could not be loaded. Please refresh the page and try again.</div> : visibleRows.length ? <PartnerTable rows={visibleRows} /> : <div className="px-4 py-16 text-center"><p className="text-[12px] font-semibold">No records found</p><p className="mt-1 text-[10px] text-[#64748B]">Try changing the search or status filter.</p></div>}
      </section>
    </div>
  );
}

function FilterButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-1.5 transition-colors duration-150 ${active ? "bg-[#E7E7E7] text-[#17203A]" : "text-[#526178] hover:bg-[#E7E7E7] hover:text-[#17203A]"}`}
    >
      {label} <span className="ml-1">{count}</span>
    </button>
  );
}

function PartnerTable({ rows }: { rows: PartnerRegisterRow[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[1120px] table-fixed text-left text-[10.5px]"><thead className="border-b text-[8.5px] uppercase text-[#64748B]"><tr><th className="px-4 py-3">Partner Name</th><th className="px-3 py-3">Mobile Number</th><th className="px-3 py-3">Partner ID</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Assigned RM</th><th className="px-3 py-3">Linked account</th><th className="px-3 py-3">Portal access</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-center">Action</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.id} className="h-[52px] transition hover:bg-[#F8FAFF]"><td className="truncate px-4 py-3"><FreshAccountReviewLink href={`/intermediaries/applications/${row.applicationId}`} className="font-semibold text-[#0F2A55] hover:text-[#315FEA] hover:underline">{row.displayName}</FreshAccountReviewLink></td><td className="truncate px-3 py-3 font-medium text-[#17203A]" title={row.mobile}>{row.mobile}</td><td className="truncate px-3 py-3 font-semibold text-[#0F2A55]" title={row.partnerId}>{row.partnerId}</td><td className="px-3 py-3">{row.accountType}</td><td className={`truncate px-3 py-3 ${row.assignedRm === "Not assigned" ? "font-medium text-amber-700" : "text-[#17203A]"}`} title={row.assignedRm}>{row.assignedRm}</td><td className="px-3 py-3"><Status value={row.linkedLabel} tone="linked" /></td><td className="px-3 py-3"><Status value={row.portalAccess} tone="portal" /></td><td className="px-3 py-3"><Status value={row.partnerStatus} tone="account" /></td><td className="px-3 py-3 text-center">{renderAction(row)}</td></tr>)}</tbody></table></div>;
}

function renderAction(row: PartnerRegisterRow) {
  if (!row.active) return <FreshAccountReviewLink href={`/intermediaries/applications/${row.applicationId}`} className={partnerOpenActionClassName}>Open</FreshAccountReviewLink>;
  if (row.linkedHref) return <FreshAccountReviewLink href={row.linkedHref} className={partnerOpenActionClassName}>Open {row.createType.toUpperCase()}</FreshAccountReviewLink>;
  if (!row.canCreateLinked) return <span className="text-[#94A3B8]">-</span>;
  return <form action={createLinkedIntermediaryAccount}><input type="hidden" name="application_id" value={row.applicationId} /><input type="hidden" name="registration_type" value={row.createType} /><FormSubmitButton label={`Create ${row.createType.toUpperCase()}`} pendingLabel={`Creating ${row.createType.toUpperCase()}...`} className={compactPrimaryActionClassName} /></form>;
}

function Status({ value, tone = "default" }: { value: string; tone?: "default" | "linked" | "portal" | "account" }) {
  const normalized = value.toLowerCase();
  const cls = tone === "linked"
    ? "border-violet-200 bg-violet-50 text-violet-700"
    : tone === "portal"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : tone === "account"
        ? normalized.includes("active") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`inline-flex rounded-md border px-2 py-1 text-[8.5px] font-semibold ${cls}`}>{value}</span>;
}
