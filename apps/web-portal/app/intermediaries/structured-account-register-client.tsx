"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";
import { FreshAccountReviewLink } from "./applications/account-review-back-link";

type AccountType = "posp" | "misp";

export type StructuredAccountStatus = "all" | "active" | "onboarding";

export type StructuredAccountRegisterRow = {
  id: string;
  applicationId: string | null;
  displayName: string;
  mobile: string;
  email: string;
  city: string;
  accountId: string | null;
  partnerId: string | null;
  partnerApplicationId: string | null;
  rm: string;
  stage: string;
  accountStatus: string;
  searchText: string;
};

const ACCOUNT_PAGE_SIZE = 10;
const SELECTED_FILTER_CLASS = "bg-[#E7E7E7] text-[#17203A]";

export function StructuredAccountRegisterClient({
  type,
  title,
  rows,
  initialSearch,
  initialStatus,
  loadError,
}: {
  type: AccountType;
  title: string;
  rows: StructuredAccountRegisterRow[];
  initialSearch: string;
  initialStatus: StructuredAccountStatus;
  loadError: boolean;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState<StructuredAccountStatus>(initialStatus);
  const [currentPage, setCurrentPage] = useState(1);
  const normalizedSearch = search.trim().toLowerCase();

  const searchedRows = useMemo(
    () => normalizedSearch ? rows.filter((row) => row.searchText.includes(normalizedSearch)) : rows,
    [normalizedSearch, rows],
  );

  const counts = useMemo(
    () => searchedRows.reduce((acc, row) => {
      if (row.stage === "Active") acc.active += 1;
      else acc.onboarding += 1;
      return acc;
    }, { active: 0, onboarding: 0 }),
    [searchedRows],
  );

  const visibleRows = useMemo(
    () => searchedRows.filter((row) => status === "all" || (status === "active" ? row.stage === "Active" : row.stage !== "Active")),
    [searchedRows, status],
  );
  const totalRecords = visibleRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / ACCOUNT_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safePage - 1) * ACCOUNT_PAGE_SIZE;
  const pageRows = visibleRows.slice(pageStartIndex, pageStartIndex + ACCOUNT_PAGE_SIZE);
  const showingStart = totalRecords === 0 ? 0 : pageStartIndex + 1;
  const showingEnd = totalRecords === 0 ? 0 : Math.min(pageStartIndex + ACCOUNT_PAGE_SIZE, totalRecords);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (status !== "all") params.set("status", status);
    const query = params.toString();
    const nextUrl = `/intermediaries/${type}${query ? `?${query}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [search, status, type]);

  function selectStatus(next: StructuredAccountStatus) {
    setStatus(next);
    setCurrentPage(1);
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-4 pb-6">
      <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <div className="grid items-center gap-5 border-b border-[#E7ECF3] bg-[#FAFBFD] px-5 py-3.5 lg:grid-cols-[auto_minmax(280px,460px)_1fr]">
          <h2 className="whitespace-nowrap text-[12.5px] font-semibold text-[#17203A]">{title} Register</h2>
          <form onSubmit={(event) => event.preventDefault()} className="relative min-w-0 max-w-[460px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }}
              placeholder={`Search ${title} name, ID, Partner ID, mobile or email`}
              className="h-9 w-full rounded-lg border border-[#D8E1EC] bg-white pl-9 pr-3 text-[10.5px] text-[#17203A] outline-none placeholder:text-[#94A3B8] focus:border-[#315FEA] focus:ring-2 focus:ring-[#E6ECFF]"
            />
          </form>
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap text-[9.5px] font-semibold">
            <StatusFilter label="All" value={searchedRows.length} active={status === "all"} onClick={() => selectStatus("all")} activeClassName={SELECTED_FILTER_CLASS} idleClassName="text-[#526178] hover:bg-white hover:text-[#0F2A55]" />
            <StatusFilter label="Active" value={counts.active} active={status === "active"} onClick={() => selectStatus("active")} activeClassName={SELECTED_FILTER_CLASS} idleClassName="text-[#526178] hover:bg-emerald-50 hover:text-emerald-700" />
            <StatusFilter label="Onboarding" value={counts.onboarding} active={status === "onboarding"} onClick={() => selectStatus("onboarding")} activeClassName={SELECTED_FILTER_CLASS} idleClassName="text-[#526178] hover:bg-amber-50 hover:text-amber-700" />
          </div>
        </div>
        {loadError ? (
          <div className="px-5 py-14 text-center text-[11px] text-red-700">The register could not be loaded.</div>
        ) : pageRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] table-fixed text-left text-[10.5px]">
              <thead className="border-b bg-[#FAFBFD] text-[8.5px] uppercase tracking-[0.03em] text-[#64748B]">
                <tr>
                  <th className="px-5 py-3.5">{title} Name</th>
                  <th className="px-3 py-3.5">Mobile Number</th>
                  <th className="px-3 py-3.5">{title} ID</th>
                  <th className="px-3 py-3.5">Parent Partner</th>
                  <th className="px-3 py-3.5">Assigned RM</th>
                  <th className="px-3 py-3.5">Account status</th>
                  <th className="px-3 py-3.5 pr-8 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7ECF3]">
                {pageRows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-[#F8FAFF]">
                    <td className="truncate px-5 py-3.5 font-semibold text-[#0F2A55]" title={row.displayName}>{row.displayName}</td>
                    <td className="truncate px-3 py-3.5 font-medium text-[#17203A]" title={row.mobile}>{row.mobile}</td>
                    <td className="truncate px-3 py-3.5 font-semibold text-[#0F2A55]" title={row.accountId ?? `${title} ID pending`}>{row.accountId ?? `${title} ID pending`}</td>
                    <td className="truncate px-3 py-3.5 font-medium text-[#17203A]" title={row.partnerId ?? "Partner ID pending"}>{row.partnerId && row.partnerApplicationId ? <FreshAccountReviewLink href={`/intermediaries/applications/${row.partnerApplicationId}`} className="font-semibold text-[#0F2A55] transition hover:text-[#315FEA] hover:underline hover:underline-offset-2">{row.partnerId}</FreshAccountReviewLink> : row.partnerId ?? "Partner ID pending"}</td>
                    <td className={`truncate px-3 py-3.5 font-medium ${row.rm === "Not assigned" ? "text-amber-700" : "text-[#17203A]"}`} title={row.rm}>{row.rm}</td>
                    <td className="px-3 py-3.5"><StatusBadge value={row.accountStatus} /></td>
                    <td className="px-3 py-3.5 pr-8 text-right">{row.applicationId ? <FreshAccountReviewLink href={`/intermediaries/applications/${row.applicationId}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#C9D5E5] bg-white text-[#0F2A55] transition hover:border-[#9AA9FF] hover:bg-[#F7F9FF] hover:text-[#315FEA]"><Eye className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">View application</span></FreshAccountReviewLink> : <span className="text-[#94A3B8]">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-16 text-center">
            <p className="text-[12px] font-semibold">No {title} accounts found</p>
            <p className="mt-1 text-[9.5px] text-[#64748B]">Create the first {title} account or change the search term.</p>
          </div>
        )}
        {!loadError ? (
          <div className="flex flex-col gap-3 border-t border-[#E7ECF3] bg-white px-4 py-3.5 text-[10px] text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
            <span>Showing {showingStart}–{showingEnd} of {totalRecords}</span>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safePage <= 1}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-[#DCE5EF] bg-white px-3 font-medium text-[#526178] transition-colors enabled:hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#B6C0CF]"
              >
                Previous
              </button>
              <span className="min-w-[42px] text-center font-medium text-[#526178]">{safePage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safePage >= totalPages}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-[#DCE5EF] bg-white px-3 font-medium text-[#526178] transition-colors enabled:hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#B6C0CF]"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function StatusFilter({
  label,
  value,
  active,
  onClick,
  activeClassName,
  idleClassName,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  activeClassName: string;
  idleClassName: string;
}) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg px-2.5 py-1.5 transition ${active ? activeClassName : idleClassName}`}>
      {label} <span className="ml-1">{value}</span>
    </button>
  );
}

function StatusBadge({ value }: { value: string }) {
  const cls = value === "Active"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : value === "Suspended"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-md border px-2 py-1 text-[8.5px] font-semibold ${cls}`}>{value}</span>;
}
