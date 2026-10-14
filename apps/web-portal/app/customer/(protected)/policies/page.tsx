import { PolicySourceFilter } from "./policy-source-filter";
import Link from "next/link";
import { ArrowRight, Bell, ChevronLeft, ChevronRight, FileCheck2, FileText, Search, ShieldCheck, ShieldX, Building2 } from "lucide-react";
import { getStaticInsurerLogo } from "@/lib/insurer-logo";
import {
  CustomerAccountTabs,
  EmptyCustomerState,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import {
  customerPolicyTone,
  formatCustomerDate,
  loadCustomerWebPolicies,
  resolveCustomerWebScope,
} from "@/lib/customer-web-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerPoliciesPage({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string; q?: string; status?: string; source?: string; page?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const policies = await loadCustomerWebPolicies(account.id);
  const query = params.q?.trim().toLowerCase() ?? "";
  const statusFilter = ["active", "due", "expired"].includes(params.status ?? "") ? params.status : "all";

  const rows = policies.filter((policy) => {
    const tone = customerPolicyTone(policy.end_date).tone;
    const matchesStatus = statusFilter === "all" || tone === statusFilter;
    const matchesQuery = !query || [
      policy.policy_no,
      policy.policy_type,
      policy.business_line,
      policy.policy_product,
      policy.insurer_name,
      policy.vehicle_no,
      policy.vehicle_make,
      policy.vehicle_model,
    ].some((value) => value?.toLowerCase().includes(query));
    return matchesStatus && matchesQuery;
  });

  const counts = policies.reduce(
    (acc, policy) => {
      const tone = customerPolicyTone(policy.end_date).tone;
      acc[tone] += 1;
      return acc;
    },
    { active: 0, due: 0, expired: 0 },
  );

  const currentQuery = params.q ?? "";
  const sourceFilter = ["internal", "external"].includes(params.source ?? "") ? params.source : "all";
  const sourceFilteredRows = rows.filter((policy) =>
    sourceFilter === "all" || (sourceFilter === "external" ? policy.source === "external" : policy.source !== "external"),
  );
  const makeHref = (changes: { status?: string; source?: string; page?: number }) => ({
    pathname: "/customer/policies",
    query: {
      account: account.id,
      ...(currentQuery ? { q: currentQuery } : {}),
      ...((changes.status ?? statusFilter) !== "all" ? { status: changes.status ?? statusFilter } : {}),
      ...((changes.source ?? sourceFilter) !== "all" ? { source: changes.source ?? sourceFilter } : {}),
      ...(changes.page && changes.page > 1 ? { page: String(changes.page) } : {}),
    },
  });

  const PAGE_SIZE = 10;
  const requestedPage = Number(params.page);
  const pageCount = Math.max(1, Math.ceil(sourceFilteredRows.length / PAGE_SIZE));
  const currentPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pageCount) : 1;
  const visibleRows = sourceFilteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-4 customer-policies-reference">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/policies" />
      <section aria-label="My Policies introduction" className="relative isolate overflow-hidden rounded-[20px] border border-[#DDEBFC] bg-[#E5F3FF] shadow-[0_12px_36px_rgba(38,108,180,.06)]">
        <div className="pointer-events-none absolute inset-0 bg-[url('/customer-policies-reference-hero.svg')] bg-cover bg-right" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#EFF8FF]/95 via-[#ECF7FF]/86 via-43% to-transparent" aria-hidden="true" />
        <div className="relative flex min-h-[238px] flex-col justify-between gap-7 px-5 py-7 sm:min-h-[282px] sm:px-8 sm:py-8 xl:px-9">
          <div>
            <h1 className="text-[clamp(30px,4.5vw,56px)] font-black tracking-[-.045em] leading-[1.06] text-[#112345]">My <span className="text-[#267AFF]">Policies</span></h1>
            <p className="mt-2 max-w-[590px] text-[13px] font-medium text-[#35557D] sm:text-[17px]">Track active, due and expired policies in one place.</p>
          </div>
          <div className="grid max-w-[785px] grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {[
              { icon: FileCheck2, title: "Track all policies", text: "View and manage your insurance policies easily" },
              { icon: Building2, title: "Insurer details", text: "See policy and insurer information in one place" },
              { icon: Bell, title: "Renewal reminders", text: "Never miss a renewal date again" },
            ].map((item) => {
              const Icon = item.icon;
              return <div key={item.title} className="flex items-start gap-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#D7E9FF]/90 text-[#267AFF] sm:h-12 sm:w-12"><Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" /></span>
                <div className="min-w-0 pt-0.5"><p className="text-[12px] font-extrabold text-[#15294B]">{item.title}</p><p className="mt-0.5 text-[10px] leading-relaxed text-[#52678A] sm:text-[11px]">{item.text}</p></div>
              </div>;
            })}
          </div>
        </div>
      </section>
      <section aria-label="Policy summary" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { label: "Total Policies", count: policies.length, description: "Policies in your account", status: "all", icon: FileText, tile: "bg-[#EAF2FF] text-[#2477E8]" },
          { label: "Active Policies", count: counts.active, description: "Currently valid policies", status: "active", icon: ShieldCheck, tile: "bg-[#E3F9ED] text-[#07966E]" },
          { label: "Expired Policies", count: counts.expired, description: "Policies that have expired", status: "expired", icon: ShieldX, tile: "bg-[#FFECEF] text-[#EB3051]" },
        ].map((item) => {
          const Icon = item.icon;
          return <Link key={item.status} href={makeHref({ status: item.status })} aria-label={`Filter by ${item.label.toLowerCase()}: ${item.count}`} className="flex min-h-[122px] items-center gap-4 rounded-[18px] border border-[#DDE7F5] bg-white p-5 shadow-[0_8px_28px_rgba(38,60,105,.04)] transition hover:border-[#A9C8F4] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#267AFF]">
            <span className={`grid h-[66px] w-[66px] shrink-0 place-items-center rounded-2xl ${item.tile}`}><Icon className="h-8 w-8" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[13px] font-extrabold text-[#15294B]">{item.label}</span><span className="mt-1 block text-[28px] font-black leading-none tabular-nums text-[#112345]">{item.count}</span><span className="mt-1 block text-[11px] text-[#7C8FAA]">{item.description}</span></span>
            <ChevronRight className="h-8 w-8 shrink-0 rounded-full border border-[#DAE5F5] p-1.5 text-[#2575ED]" aria-hidden="true" />
          </Link>;
        })}
      </section>
      <section className="overflow-hidden rounded-[18px] border border-[#D9E5F6] bg-white shadow-[0_9px_34px_rgba(24,42,72,.05)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E4EAF2] px-4 py-4 sm:px-5 xl:flex-nowrap">
          <h2 className="flex shrink-0 items-center gap-2 text-[19px] font-black text-[#10213D]"><ShieldCheck className="h-5 w-5 text-[#175CA8]" aria-hidden="true" />Policy Register</h2>
          <form className="flex w-full min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#D7E0EF] bg-[#FAFCFF] px-3 py-3 sm:min-w-[220px] sm:max-w-[420px]">
            <Search className="h-4 w-4 shrink-0 text-[#8C9BB2]" />
            <input type="hidden" name="account" value={account.id} />
            {statusFilter !== "all" ? <input type="hidden" name="status" value={statusFilter} /> : null}
            {sourceFilter !== "all" ? <input type="hidden" name="source" value={sourceFilter} /> : null}
            <input name="q" defaultValue={currentQuery} aria-label="Search policies" placeholder="Search policy, insurer, vehicle or product..." className="w-full min-w-0 border-0 bg-transparent p-0 text-[11px] text-[#203650] outline-none placeholder:text-[#95A2B7]" />
            <button type="submit" className="sr-only">Search</button>
          </form>
          <div aria-label="Policy status filter" className="ml-auto flex flex-wrap items-center gap-1 rounded-xl border border-[#D8E2F0] bg-[#F8FAFD] p-1">
            {[
              ["all", "All", policies.length],
              ["active", "Active", counts.active],
              ["due", "Due", counts.due],
              ["expired", "Expired", counts.expired],
            ].map(([value,label,count])=><Link key={String(value)} href={makeHref({status:String(value)})} className={`whitespace-nowrap rounded-lg px-2.5 py-2 text-[11px] font-bold ${statusFilter===value?"bg-[#0D756D] text-white shadow-sm":"text-[#60728D] hover:bg-white"}`}>{label} {count}</Link>)}
          </div>
          <PolicySourceFilter accountId={account.id} query={currentQuery} status={statusFilter ?? "all"} source={sourceFilter ?? "all"} />
        </div>
      {sourceFilteredRows.length === 0 ? (
        <div className="p-5"><EmptyCustomerState title="No matching policies" body="Try adjusting your filters." /></div>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[850px] border-collapse text-left text-[11px]">
              <thead className="bg-[#F4F7FA] text-[9px] font-bold uppercase tracking-[.045em] text-[#697D98]">
                <tr>
                  {["Policy / Product", "Vehicle / Asset", "Insurer", "Validity", "Status", "Net Premium", "Source", "Actions"].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap border-b border-[#DFE7F0] px-3 py-3">{heading}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EDF4]">
                {visibleRows.map((policy) => {
                  const status = customerPolicyTone(policy.end_date);
                  const logo = getStaticInsurerLogo(policy.insurer_name);
                  return (
                    <tr key={`${policy.source}:${policy.id}`} className="group hover:bg-[#F7FAFE] focus-within:bg-[#F0F7FF]">
                      <td className="max-w-[220px] px-3 py-3">
                        <Link href={{ pathname: `/customer/policies/${policy.id}`, query: { account: account.id, source: policy.source } }} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#267AFF] focus-visible:outline-offset-2" aria-label={`View policy ${policy.policy_no}`}>
                        <p className="whitespace-nowrap text-[12px] font-semibold text-[#182D4B]">{policy.business_line || "Motor"} <span className="font-normal">· {policy.policy_product || policy.policy_type || "Policy"}</span></p>
                        <p className="mt-1 truncate text-[9px] text-[#7588A3]" title={policy.policy_no}>{policy.policy_no}</p>
                        </Link>
                      </td>
                      <td className="px-3 py-3"><p className="font-bold text-[#334762]">{policy.vehicle_no || "—"}</p><p className="mt-1 max-w-[170px] truncate text-[9px] text-[#7A8CA4]">{[policy.vehicle_make,policy.vehicle_model].filter(Boolean).join(" ") || "—"}</p></td>
                      <td className="max-w-[160px] px-3 py-3" title={policy.insurer_name || ""}>
                        <div className="flex items-center gap-2">
                          {logo ? <img src={logo} alt={policy.insurer_name || "Insurer"} className="h-7 w-7 shrink-0 object-contain" /> : <span role="img" aria-label={policy.insurer_name || "Insurer unavailable"} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EDF2F8] text-[#506786]"><FileText className="h-4 w-4" /></span>}

                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <p className="font-medium text-[#263B59]">{formatCustomerDate(policy.start_date)} – {formatCustomerDate(policy.end_date)}</p>
                        <p className="mt-1 text-[9px] text-[#7A8CA4]">{status.days < 0 ? `${Math.abs(status.days)} days expired` : `${status.days} days left`}</p>
                      </td>
                      <td className="px-3 py-3"><StatusPill tone={status.tone}>{status.tone === "due" ? "Due" : status.tone}</StatusPill></td>
                                            <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-[#263B59]" title="Net premium unavailable from current customer policy data">—</td>
                      <td className="px-3 py-3 text-[9px] font-semibold uppercase text-[#64748B]">{policy.source === "external" ? "External" : "Internal"}</td>
                      <td className="whitespace-nowrap px-3 py-3"><Link href={{ pathname: `/customer/policies/${policy.id}`, query: { account: account.id, source: policy.source } }} className="inline-flex items-center gap-2 rounded-lg bg-[#EBF3FF] px-3 py-2 text-[11px] font-bold text-[#246FED] transition hover:bg-[#DCEAFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#267AFF]">View details <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-[#E7EDF5] lg:hidden">
            {sourceFilteredRows.map((policy) => {
              const status = customerPolicyTone(policy.end_date);
              const logo = getStaticInsurerLogo(policy.insurer_name);
              return (
                <Link key={`${policy.source}:${policy.id}`} href={{ pathname: `/customer/policies/${policy.id}`, query: { account: account.id, source: policy.source } }} className="block px-4 py-3 hover:bg-[#F7FAFE]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#182D4B]">{policy.business_line || "Motor"} · {policy.policy_product || policy.policy_type || "Policy"}</p>
                      <p className="mt-1 truncate text-[10px] text-[#60728D]">{policy.vehicle_no || policy.policy_no}</p>
                    </div>
                    <StatusPill tone={status.tone}>{status.tone === "due" ? "Due" : status.tone}</StatusPill>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-[#526682]">
                    {logo ? <img src={logo} alt="" className="h-6 w-6 object-contain" /> : null}
                    <span className="min-w-0 flex-1" aria-label={policy.insurer_name || "Insurer unavailable"} />
                    <span className="font-semibold" title="Net premium unavailable from current customer policy data">—</span>
                  </div>
                  <p className="mt-1 text-[9px] text-[#8A9AB0]">{formatCustomerDate(policy.start_date)} – {formatCustomerDate(policy.end_date)} · {policy.source === "external" ? "External" : "Internal"}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#267AFF]">View details <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
                </Link>
              );
            })}
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8EDF4] px-4 py-3 text-[11px] font-medium text-[#6A7B93]">
        <span>Showing {sourceFilteredRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sourceFilteredRows.length)} of {sourceFilteredRows.length} matching policies</span>
        {pageCount > 1 ? <nav aria-label="Policy pages" className="flex items-center gap-2">
          <Link aria-label="Previous page" aria-disabled={currentPage <= 1} tabIndex={currentPage <= 1 ? -1 : undefined} href={makeHref({page: Math.max(1, currentPage - 1)})} className={`grid h-8 w-8 place-items-center rounded-full border border-[#D9E6F6] ${currentPage <= 1 ? "pointer-events-none opacity-40" : "hover:bg-[#F0F6FF]"}`}><ChevronLeft className="h-4 w-4" /></Link>
          {Array.from({length: pageCount}, (_, index) => index + 1).filter((page) => page === 1 || page === pageCount || Math.abs(page - currentPage) <= 1).map((page) => <Link key={page} href={makeHref({page})} aria-current={page === currentPage ? "page" : undefined} className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-[11px] font-bold ${page === currentPage ? "bg-[#267AFF] text-white" : "border border-[#D9E6F6] text-[#406087] hover:bg-[#F0F6FF]"}`}>{page}</Link>)}
          <Link aria-label="Next page" aria-disabled={currentPage >= pageCount} tabIndex={currentPage >= pageCount ? -1 : undefined} href={makeHref({page: Math.min(pageCount, currentPage + 1)})} className={`grid h-8 w-8 place-items-center rounded-full border border-[#D9E6F6] ${currentPage >= pageCount ? "pointer-events-none opacity-40" : "hover:bg-[#F0F6FF]"}`}><ChevronRight className="h-4 w-4" /></Link>
        </nav> : null}
      </div>
      </section>
    </div>
  );
}
