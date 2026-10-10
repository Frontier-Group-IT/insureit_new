import { PolicySourceFilter } from "./policy-source-filter";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Clock3, FileText, Search, ShieldCheck, Wallet } from "lucide-react";
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

  const totalInsured = policies.reduce((sum, policy) => {
    const amount = Number(policy.insured_declared_value);
    return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
  }, 0);
  const summary = [
    { label: "Total policies", value: String(policies.length), Icon: FileText, theme: "bg-[#EDF5FF] text-[#1766D2]" },
    { label: "Active policies", value: String(counts.active), Icon: ShieldCheck, theme: "bg-[#EDFAF3] text-[#008A59]" },
    { label: "Due for renewal", value: String(counts.due), Icon: Clock3, theme: "bg-[#FFF6E9] text-[#D77B13]" },
    { label: "Expired policies", value: String(counts.expired), Icon: AlertCircle, theme: "bg-[#FFF0F1] text-[#D22C3B]" },
    { label: "Total insured value", value: totalInsured ? formatCustomerMoney(totalInsured) : "—", Icon: Wallet, theme: "bg-[#F4F1FF] text-[#7653D6]" },
  ];
  return (
    <div className="space-y-3">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/policies" />
      <section className="relative isolate overflow-hidden rounded-2xl bg-[#061B3B] text-white">
        <div className="absolute inset-y-0 right-0 w-[65%] bg-[url('/customer-insurance-quote-vehicles.svg')] bg-cover bg-center opacity-85" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#06162F] via-[#08254C]/95 via-45% to-transparent" />
        <div className="relative flex min-h-[165px] items-center px-5 py-5 sm:min-h-[200px] sm:px-8">
          <div className="max-w-[55%]">
            <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#8DC8FF]">Insurance portfolio</p>
            <h1 className="mt-2 text-[clamp(22px,2.8vw,36px)] font-black leading-tight">Your <span className="text-[#369BFF]">Policy</span> Portfolio</h1>
            <p className="mt-2 max-w-[360px] text-[11px] leading-5 text-[#E0EEFF]">Track your insurance policies, renewals and coverage across your vehicles and assets.</p>
          </div>
        </div>
      </section>
      <section aria-label="Policy summary" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {summary.map(({label,value,Icon,theme}) => <div key={label} className={`flex min-h-[83px] items-center gap-3 rounded-xl border border-[#DCE5F0] p-3 ${theme.split(" ")[0]}`}>
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80 ${theme.split(" ")[1]}`}><Icon className="h-5 w-5"/></span>
          <span className="min-w-0"><strong className="block text-[clamp(15px,1.6vw,22px)] font-black text-[#10213D]">{value}</strong><span className="block text-[10px] font-semibold text-[#5C6D88]">{label}</span></span>
        </div>)}
      </section>
      <section className="overflow-hidden rounded-2xl border border-[#D9E2EF] bg-white shadow-[0_8px_30px_rgba(24,42,72,.04)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E4EAF2] px-3 py-3 sm:px-4">
          <form className="flex min-w-[210px] flex-1 items-center gap-2 rounded-lg border border-[#D7E0EF] bg-[#FAFCFF] px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-[#8C9BB2]" />
            <input type="hidden" name="account" value={account.id} />
            {statusFilter !== "all" ? <input type="hidden" name="status" value={statusFilter} /> : null}
            {sourceFilter !== "all" ? <input type="hidden" name="source" value={sourceFilter} /> : null}
            <input name="q" defaultValue={currentQuery} aria-label="Search policies" placeholder="Search policy, insurer, vehicle or product..." className="w-full min-w-0 border-0 bg-transparent p-0 text-[11px] text-[#203650] outline-none placeholder:text-[#95A2B7]" />
            <button type="submit" className="sr-only">Search</button>
          </form>
          <div aria-label="Policy status filter" className="flex flex-wrap items-center gap-1 rounded-lg border border-[#D8E2F0] bg-[#F8FAFD] p-1">
            {[
              ["all", "All", policies.length],
              ["active", "Active", counts.active],
              ["due", "Due", counts.due],
              ["expired", "Expired", counts.expired],
            ].map(([value,label,count])=><Link key={String(value)} href={makeHref({status:String(value)})} className={`whitespace-nowrap rounded-md px-2 py-1.5 text-[10px] font-bold ${statusFilter===value?"bg-[#0D756D] text-white":"text-[#60728D] hover:bg-white"}`}>{label} {count}</Link>)}
          </div>
          <PolicySourceFilter accountId={account.id} query={currentQuery} status={statusFilter ?? "all"} source={sourceFilter ?? "all"} />
        </div>
      {sourceFilteredRows.length === 0 ? (
        <div className="p-5"><EmptyCustomerState title="No matching policies" body="Try adjusting your filters." /></div>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1080px] border-collapse text-left text-[11px]">
              <thead className="bg-[#F4F7FA] text-[9px] font-bold uppercase tracking-[.045em] text-[#697D98]">
                <tr>
                  {["Policy / Product", "Vehicle / Asset", "Insurer", "Validity", "Status", "Insured Value", "Gross Premium", "Source", "Details"].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap border-b border-[#DFE7F0] px-3 py-3">{heading}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EDF4]">
                {sourceFilteredRows.map((policy) => {
                  const status = customerPolicyTone(policy.end_date);
                  const logo = getStaticInsurerLogo(policy.insurer_name);
                  return (
                    <tr key={`${policy.source}:${policy.id}`} className="group hover:bg-[#F7FAFE]">
                      <td className="max-w-[220px] px-3 py-3">
                        <Link href={{ pathname: `/customer/policies/${policy.id}`, query: { account: account.id, source: policy.source } }} className="block hover:underline focus-visible:underline" aria-label={`View policy ${policy.policy_no}`}>
                        <p className="whitespace-nowrap text-[12px] font-semibold text-[#182D4B]">{policy.business_line || "Motor"} <span className="font-normal">· {policy.policy_product || policy.policy_type || "Policy"}</span></p>
                        <p className="mt-1 truncate text-[9px] text-[#7588A3]" title={policy.policy_no}>{policy.policy_no}</p>
                        </Link>
                      </td>
                      <td className="px-3 py-3"><p className="font-bold text-[#334762]">{policy.vehicle_no || "—"}</p><p className="mt-1 max-w-[170px] truncate text-[9px] text-[#7A8CA4]">{[policy.vehicle_make,policy.vehicle_model].filter(Boolean).join(" ") || "—"}</p></td>
                      <td className="max-w-[160px] px-3 py-3" title={policy.insurer_name || ""}>
                        <div className="flex items-center gap-2">
                          {logo ? <img src={logo} alt={policy.insurer_name || "Insurer"} className="h-7 w-7 shrink-0 object-contain" /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EDF2F8] text-[#506786]"><FileText className="h-4 w-4" /></span>}
                          <span className="max-w-[150px] truncate text-[10px] font-semibold text-[#304A6A]">{policy.insurer_name || "Insurer unavailable"}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <p className="font-medium text-[#263B59]">{formatCustomerDate(policy.start_date)} – {formatCustomerDate(policy.end_date)}</p>
                        <p className="mt-1 text-[9px] text-[#7A8CA4]">{status.days < 0 ? `${Math.abs(status.days)} days expired` : `${status.days} days left`}</p>
                      </td>
                      <td className="px-3 py-3"><StatusPill tone={status.tone}>{status.tone === "due" ? "Due" : status.tone}</StatusPill></td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-[#263B59]">{formatCustomerMoney(policy.insured_declared_value)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-[#263B59]">{formatCustomerMoney(policy.premium_amount)}</td>
                      <td className="px-3 py-3 text-[9px] font-semibold uppercase text-[#64748B]">{policy.source === "external" ? "External" : "Internal"}</td><td className="px-3 py-3"><Link aria-label={`View policy ${policy.policy_no}`} href={{ pathname: `/customer/policies/${policy.id}`, query: { account: account.id, source: policy.source } }} className="inline-flex rounded-md border border-[#DCE6F2] p-1.5 text-[#1B5794] hover:bg-[#EDF5FF]"><ArrowUpRight className="h-4 w-4"/></Link></td>
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
                  <p className="mt-1 text-[9px] text-[#8A9AB0]">{formatCustomerDate(policy.start_date)} – {formatCustomerDate(policy.end_date)} · {policy.source === "external" ? "External" : "Internal"}</p>
                </Link>
              );
            })}
          </div>
        </>
      )}
      <p className="border-t border-[#E8EDF4] px-4 py-3 text-[10px] font-medium text-[#6A7B93]">Showing {sourceFilteredRows.length} of {policies.length} policies</p>
      </section>
    </div>
  );
}
