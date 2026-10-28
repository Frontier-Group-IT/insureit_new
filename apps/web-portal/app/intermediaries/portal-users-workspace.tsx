"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { IntermediaryTabs } from "./intermediary-tabs";
import { createIntermediaryPortalLogin } from "./portal-account-actions";
import { resendIntermediaryPortalInvite } from "./resend-portal-invite-action";
import { createGroupBranchPortalLogin, resendGroupBranchPortalInvite } from "./groups/group-branch-login-actions";
import type { AdditionalPortalAccount, PortalUserRow } from "./portal-users/page";

type StatusFilter = "all" | "active" | "inactive";

const PORTAL_USERS_PAGE_SIZE = 10;

export function IntermediaryPortalUsersWorkspace({ rows, extraRows, initialQuery, initialType, initialStatus, success, error, loadError }: { rows: PortalUserRow[]; extraRows: AdditionalPortalAccount[]; initialQuery: string; initialType: string; initialStatus: StatusFilter; success?: string; error?: string; loadError: boolean }) {
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [currentPage, setCurrentPage] = useState(1);
  const [accountType, setAccountType] = useState(initialType);
  const normalizedQuery=query.trim().toLowerCase();
  const allItems = useMemo(() => [
    ...rows.map(row=>({kind:"partner" as const,key:`partner:${row.intermediary.id}`,row,type:"Partner",status:resolvedStatus(row),
      search:[row.intermediary.display_name,row.intermediary.email,row.account?.email,row.intermediary.intermediary_code,row.intermediary.application_id].filter(Boolean).join(" ").toLowerCase()})),
    ...extraRows.map(row=>({kind:"extra" as const,key:row.id,row,type:row.type,status:row.status,
      search:[row.name,row.code,row.email,row.loginEmail,row.phone,row.context].filter(Boolean).join(" ").toLowerCase()})),
  ],[rows,extraRows]);
  const searchedRows=allItems.filter(item=>item.search.includes(normalizedQuery)&&(accountType==="all"||item.type===accountType));
  const activeCount=searchedRows.filter(item=>item.status==="active").length;
  const inactiveCount=searchedRows.length-activeCount;
  const visibleRows=searchedRows.filter(item=>statusFilter==="all"||(statusFilter==="active"?item.status==="active":item.status!=="active"));
  const totalRecords=visibleRows.length;
  const totalPages=Math.max(1,Math.ceil(totalRecords/PORTAL_USERS_PAGE_SIZE));
  const safePage=Math.min(currentPage,totalPages);
  const pageStartIndex=(safePage-1)*PORTAL_USERS_PAGE_SIZE;
  const pageRows=visibleRows.slice(pageStartIndex,pageStartIndex+PORTAL_USERS_PAGE_SIZE);
  const showingStart=totalRecords===0?0:pageStartIndex+1;
  const showingEnd=totalRecords===0?0:Math.min(pageStartIndex+PORTAL_USERS_PAGE_SIZE,totalRecords);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (accountType !== "all") params.set("type", accountType);
    const nextUrl = `/intermediaries/portal-users${params.size ? `?${params.toString()}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState(null, "", nextUrl);
  }, [query, statusFilter, accountType]);

  function selectStatus(next: StatusFilter) {
    setStatusFilter(next);
    setCurrentPage(1);
  }

  const successMessage = success === "portal_login_invited" ? "Portal account created and password setup invitation sent." : success === "portal_invite_resent" ? "A fresh password setup invitation has been sent." : null;
  const errorMessage = portalErrorMessage(error);

  return <div className="mx-auto max-w-[1480px] space-y-3 pb-8">
    {successMessage ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[10.5px] font-semibold text-emerald-700">{successMessage}</div> : null}
    {errorMessage ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10.5px] font-medium text-red-700">{errorMessage}</div> : null}
    <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
      <IntermediaryTabs active="users" embedded />
      <div className="flex flex-col gap-3 border-b bg-[#F8FAFC] px-4 py-3 lg:flex-row lg:items-center">
        <div className="shrink-0"><h2 className="text-[12px] font-semibold text-[#0F172A]">Portal Users</h2></div>
        <form onSubmit={(event) => event.preventDefault()} className="w-full lg:max-w-[460px]">
          <input value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); }} aria-label="Search intermediary user accounts" placeholder="Search name, group, branch, mobile, email or code" className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-[11.5px] outline-none transition focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#DBEAFE]" />
        </form>
        <select aria-label="Account type" value={accountType} onChange={e=>{setAccountType(e.target.value);setCurrentPage(1);}} className="h-9 rounded-lg border border-[#CBD5E1] bg-white px-2 text-[10px]"><option value="all">All account types</option>{["Partner","Group","Branch","Group Associate","Partner Associate"].map(type=><option key={type} value={type}>{type}</option>)}</select>
        <div className="flex-1" />
        <nav className="flex w-fit shrink-0 items-center rounded-xl border border-[#DCE5EF] bg-white p-1" aria-label="Filter intermediary user accounts">
          {([
            ["all", "All", searchedRows.length],
            ["active", "Active", activeCount],
            ["inactive", "Needs attention", inactiveCount],
          ] as const).map(([value, label, count]) => {
            const selected = statusFilter === value;
            return <button key={value} type="button" onClick={() => selectStatus(value)} aria-current={selected ? "page" : undefined} className={`rounded-lg px-3 py-2 text-[10px] font-semibold transition ${selected ? "bg-[#E7E7E7] text-[#17203A]" : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"}`}>{label} <span className="ml-1 opacity-80">{count}</span></button>;
          })}
        </nav>
      </div>
      {loadError ? <div className="px-4 py-12 text-center"><p className="text-[11px] font-semibold text-red-700">Portal users are temporarily unavailable.</p><p className="mt-1 text-[9.5px] text-[#64748B]">Please refresh the page or try again shortly.</p></div> : pageRows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[10.5px]">
            <thead className="border-b text-[8.5px] uppercase text-[#64748B]"><tr><th className="px-4 py-3">Account</th><th className="px-3 py-3">Account type</th><th className="px-3 py-3">Account</th><th className="px-3 py-3">Portal status</th><th className="px-3 py-3">Invitation sent</th><th className="px-3 py-3">Application</th><th className="px-3 py-3 text-right">Portal action</th></tr></thead>
            <tbody className="divide-y">{pageRows.map(item=>{
              if(item.kind==="extra"){
                const row=item.row;
                return <tr key={item.key} className="hover:bg-[#FAFCFF]">
                  <td className="px-4 py-3"><p className="font-semibold text-[#0F2A55]">{row.name}</p><p className="text-[9px] text-[#64748B]">{row.code} · {row.context}</p></td>
                  <td className="px-3 py-3"><span className="rounded-lg bg-[#EEF4FA] px-2 py-1 text-[9px] font-semibold text-[#17365D]">{row.type}</span></td>
                  <td className="px-3 py-3">{row.email??"Email not recorded"}</td><td className="px-3 py-3"><Status value={row.status}/></td>
                  <td className="px-3 py-3">{row.invitationStatus??"—"}</td><td className="px-3 py-3">{row.reviewHref ? <Link prefetch={false} href={row.reviewHref} className="font-semibold text-[#4F46E5] hover:underline">Open account</Link> : row.context}</td>
                  <td className="px-3 py-3 text-right">{row.type==="Branch" ? <BranchPortalAction row={row}/> : <Link prefetch={false} href={row.manageHref} className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-[9px] font-semibold text-[#17365D] hover:bg-[#F1F5F9]">Manage</Link>}</td>
                </tr>;
              }
              const { intermediary, account }=item.row;
              return <tr key={item.key} className="hover:bg-[#FAFCFF]">
                <td className="px-4 py-3"><p className="font-semibold text-[#0F2A55]">{intermediary.display_name}</p><p className="text-[9px] text-[#64748B]">{intermediary.intermediary_code??"Partner ID pending"}</p></td>
                <td className="px-3 py-3"><span className="rounded-lg bg-[#EEF4FA] px-2 py-1 text-[9px] font-semibold text-[#17365D]">Partner</span></td>
                <td className="px-3 py-3">{account?.email??intermediary.email??"Email not recorded"}</td>
                <td className="px-3 py-3"><Status value={resolvedStatus(item.row)}/></td>
                <td className="px-3 py-3">{formatDateTime(account?.invited_at)}</td>
                <td className="px-3 py-3">{intermediary.application_id?<Link prefetch={false} href={`/intermediaries/applications/${intermediary.application_id}`} className="font-semibold text-[#4F46E5] hover:underline">Open account</Link>:"Direct partner"}</td>
                <td className="px-3 py-3 text-right"><PortalAction row={item.row}/></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      ) : <div className="px-4 py-16 text-center"><p className="text-[11px] font-semibold text-[#334155]">No portal users match the current filters.</p><p className="mt-1 text-[9.5px] text-[#64748B]">Change the search or status filter to view other accounts.</p></div>}
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
  </div>;
}

function resolvedStatus({ intermediary, account }: PortalUserRow) {
  return account ? intermediary.portal_access_status || account.status : "not_created";
}

function isActive(row: PortalUserRow) {
  return resolvedStatus(row) === "active";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not sent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(date);
}

function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const label = normalized === "not_created" ? "Not created" : normalized === "invited" ? "Invitation sent" : normalized.replaceAll("_", " ");
  const style = normalized === "active"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : normalized === "invited"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : normalized === "disabled" || normalized === "suspended"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[8.5px] font-semibold capitalize ${style}`}>{label}</span>;
}


function BranchPortalAction({ row }: { row: AdditionalPortalAccount }) {
  if (!row.branchId) return null;
  if (row.status === "not_created") {
    if (!row.loginEmail || !row.phone) return <span className="text-[9px] font-semibold text-amber-700" title="A Branch email and phone are required for portal access.">Email / phone required</span>;
    return <form action={createGroupBranchPortalLogin} className="inline-flex">
      <input type="hidden" name="entity_type" value="branch" />
      <input type="hidden" name="entity_id" value={row.branchId} />
      <input type="hidden" name="login_email" value={row.loginEmail} />
      <input type="hidden" name="phone" value={row.phone} />
      <FormSubmitButton label="Create Portal User" pendingLabel="Creating..." className="inline-flex h-8 items-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-[9px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60" />
    </form>;
  }
  if (row.status === "active") {
    return <form action={resendGroupBranchPortalInvite} className="inline-flex">
      <input type="hidden" name="entity_type" value="branch" />
      <input type="hidden" name="entity_id" value={row.branchId} />
      <FormSubmitButton label="Resend Invite" pendingLabel="Sending..." className="inline-flex h-8 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-[9px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60" />
    </form>;
  }
  return <Link prefetch={false} href={row.manageHref} className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-[9px] font-semibold text-[#17365D]">Manage</Link>;
}

function PortalAction({ row }: { row: PortalUserRow }) {
  const { intermediary, account } = row;
  const status = resolvedStatus(row);
  const email = account?.email ?? intermediary.email;

  if (status === "not_created") {
    if (!email) return <span className="text-[9px] font-semibold text-amber-700" title="Add an email address to the intermediary before creating portal access.">Email required</span>;
    return <form action={createIntermediaryPortalLogin} className="inline-flex">
      <input type="hidden" name="intermediary_id" value={intermediary.id} />
      <input type="hidden" name="return_path" value="/intermediaries/portal-users" />
      <FormSubmitButton label="Create Portal Account" pendingLabel="Creating..." className="inline-flex h-8 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-[9px] font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60" />
    </form>;
  }

  if (status === "invited") {
    return <form action={resendIntermediaryPortalInvite} className="inline-flex">
      <input type="hidden" name="intermediary_id" value={intermediary.id} />
      <input type="hidden" name="return_path" value="/intermediaries/portal-users" />
      <FormSubmitButton label="Resend Invite" pendingLabel="Sending..." className="inline-flex h-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-[9px] font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60" />
    </form>;
  }

  if (status === "active") return <span className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[9px] font-bold text-emerald-700">Active</span>;
  if (status === "disabled" || status === "suspended") return <span className="text-[9px] font-semibold text-[#94A3B8]">Managed from account review</span>;
  return <span className="text-[9px] text-[#94A3B8]">—</span>;
}

function portalErrorMessage(error?: string) {
  if (!error) return null;
  if (error === "portal_login_email_required") return "Portal account cannot be created until an email address is recorded for this partner.";
  if (error === "portal_login_exists") return "A portal account already exists for this partner.";
  if (error === "portal_login_partner_family_unresolved") return "This partner does not currently resolve to one valid Partner family, so portal access was not created.";
  if (error === "portal_login_not_authorized") return "You do not have permission to manage this partner portal account.";
  if (error === "portal_resend_not_available") return "A portal invitation can only be resent while the account is awaiting activation.";
  return "The portal account action could not be completed. Please try again or review the partner account details.";
}
