import Link from "next/link";
import { FileText, Search, RotateCcw } from "lucide-react";
import { getStaticInsurerLogo } from "@/lib/insurer-logo";
import {
  CustomerAccountTabs,
  EmptyCustomerState,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import {
  customerPolicyTone,
  formatCustomerDate,
  formatCustomerMoney,
  loadCustomerWebPolicies,
  resolveCustomerWebScope,
} from "@/lib/customer-web-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerPoliciesPage({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string; q?: string; status?: string; source?: string }>;
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

  function filterHref(status: string) {
    return {
      pathname: "/customer/policies",
      query: {
        account: account.id,
        ...(params.q ? { q: params.q } : {}),
        ...(status !== "all" ? { status } : {}),
      },
    };
  }

  const currentQuery = params.q ?? "";
  const sourceFilter = ["internal", "external"].includes(params.source ?? "") ? params.source : "all";
  const sourceFilteredRows = rows.filter((policy) =>
    sourceFilter === "all" || (sourceFilter === "external" ? policy.source === "external" : policy.source !== "external"),
  );
  const makeHref = (changes: { status?: string; source?: string }) => ({
    pathname: "/customer/policies",
    query: {
      account: account.id,
      ...(currentQuery ? { q: currentQuery } : {}),
      ...((changes.status ?? statusFilter) !== "all" ? { status: changes.status ?? statusFilter } : {}),
      ...((changes.source ?? sourceFilter) !== "all" ? { source: changes.source ?? sourceFilter } : {}),
    },
  });

  return (
    <div className="overflow-hidden rounded-[20px] border border-[#D9E2EF] bg-white shadow-[0_8px_30px_rgba(24,42,72,.04)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#E4EAF2] bg-[#F8FAFE] px-4 py-3 sm:px-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#17345B] text-white">
          <FileText className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold tracking-tight text-[#172844]">Policy Portfolio</h1>
          <p className="text-[10px] text-[#77869B]">My insurance policies</p>
        </div>
        <form className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-[#D7E0EF] bg-white px-3 py-2.5 lg:ml-2">
          <Search className="h-4 w-4 shrink-0 text-[#8C9BB2]" />
          <input type="hidden" name="account" value={account.id} />
          {statusFilter !== "all" ? <input type="hidden" name="status" value={statusFilter} /> : null}
          {sourceFilter !== "all" ? <input type="hidden" name="source" value={sourceFilter} /> : null}
          <input name="q" defaultValue={currentQuery} aria-label="Search policies" placeholder="Search policy, insurer, vehicle or product" className="w-full min-w-0 bg-transparent text-[12px] text-[#203650] outline-none placeholder:text-[#95A2B7]" />
          <button type="submit" className="sr-only">Search</button>
        </form>
        <Link href={{ pathname: "/customer/policies", query: { account: account.id } }} aria-label="Reset policy filters" title="Reset filters" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D7E0EF] bg-white text-[#506786] hover:bg-[#EFF4FA]">
          <RotateCcw className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[#E4EAF2] px-4 py-2.5 sm:px-5">
        <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/policies" />
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <div className="flex items-center gap-1 rounded-xl border border-[#D8E2F0] bg-[#F8FAFD] p-1">
            {[
              ["all", "All", policies.length],
              ["active", "Active", counts.active],
              ["due", "Due", counts.due],
              ["expired", "Expired", counts.expired],
            ].map(([value, label, count]) => (
              <Link key={String(value)} href={makeHref({ status: String(value) })} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-semibold transition ${statusFilter === value ? "bg-[#0D756D] text-white" : "text-[#60728D] hover:bg-white"}`}>
                {label} {count}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-[#D8E2F0] bg-[#F8FAFD] p-1">
            {[
              ["all", "All Sources"],
              ["internal", "INSUREIT"],
              ["external", "External"],
            ].map(([value, label]) => (
              <Link key={value} href={makeHref({ source: value })} className={`whitespace-nowrap rounded-lg px-2.5 py-2 text-[10px] font-semibold transition ${sourceFilter === value ? "bg-[#17345B] text-white" : "text-[#60728D] hover:bg-white"}`}>{label}</Link>
            ))}
          </div>
        </div>
      </div>

      {sourceFilteredRows.length === 0 ? (
        <div className="p-5"><EmptyCustomerState title="No matching policies" body="Try adjusting your filters." /></div>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1080px] border-collapse text-left text-[11px]">
              <thead className="bg-[#F4F7FA] text-[9px] font-bold uppercase tracking-[.045em] text-[#697D98]">
                <tr>
                  {["Policy / Product", "Risk / Asset", "Insurer", "Validity", "Status", "Insured Value", "Gross Premium", "Source", ""].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap border-b border-[#DFE7F0] px-3 py-3">{heading}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EDF4]">
                {sourceFilteredRows.map((policy) => {
                  const status = customerPolicyTone(policy.end_date);
                  const logo = getStaticInsurerLogo(policy.insurer_name);
                  return (
                    <tr key={`${policy.source}:${policy.id}`} className="hover:bg-[#F7FAFE]">
                      <td className="max-w-[220px] px-3 py-3">
                        <p className="whitespace-nowrap text-[12px] font-semibold text-[#182D4B]">{policy.business_line || "Motor"} <span className="font-normal">· {policy.policy_product || policy.policy_type || "Policy"}</span></p>
                        <p className="mt-1 truncate text-[9px] text-[#7588A3]" title={policy.policy_no}>{policy.policy_no}</p>
                      </td>
                      <td className="px-3 py-3 font-semibold text-[#334762]">{policy.vehicle_no || "—"}</td>
                      <td className="max-w-[160px] px-3 py-3" title={policy.insurer_name || ""}>
                        <div className="flex items-center gap-2">
                          {logo ? <img src={logo} alt="" className="h-7 w-7 shrink-0 object-contain" /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EDF2F8] text-[#506786]"><FileText className="h-4 w-4" /></span>}
                          <span className="truncate text-[10px] text-[#445775]">{policy.insurer_name || "—"}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <p className="font-medium text-[#263B59]">{formatCustomerDate(policy.start_date)} – {formatCustomerDate(policy.end_date)}</p>
                        <p className="mt-1 text-[9px] text-[#7A8CA4]">{status.days < 0 ? `${Math.abs(status.days)} days expired` : `${status.days} days left`}</p>
                      </td>
                      <td className="px-3 py-3"><StatusPill tone={status.tone}>{status.tone === "due" ? "Due" : status.tone}</StatusPill></td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-[#263B59]">{formatCustomerMoney(policy.insured_declared_value)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-[#263B59]">{formatCustomerMoney(policy.premium_amount)}</td>
                      <td className="px-3 py-3 text-[9px] font-semibold uppercase text-[#64748B]">{policy.source === "external" ? "External" : "INSUREIT"}</td>
                      <td className="px-3 py-3"><Link href={{ pathname: `/customer/policies/${policy.id}`, query: { account: account.id, source: policy.source } }} className="whitespace-nowrap font-bold text-[#1754A5] hover:underline">View →</Link></td>
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
                    <span className="min-w-0 flex-1 truncate">{policy.insurer_name || "Insurer unavailable"}</span>
                    <span className="font-semibold">{formatCustomerMoney(policy.premium_amount)}</span>
                  </div>
                  <p className="mt-1 text-[9px] text-[#8A9AB0]">{formatCustomerDate(policy.start_date)} – {formatCustomerDate(policy.end_date)} · {policy.source === "external" ? "External" : "INSUREIT"}</p>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
