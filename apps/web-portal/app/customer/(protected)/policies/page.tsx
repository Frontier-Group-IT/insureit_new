import "../customer-register-motion.css";
import { PolicySourceFilter } from "./policy-source-filter";
import { ManufacturerMark } from "../vehicles/customer-vehicles-register";
import { CustomerPolicyAnimatedSearch } from "./customer-policy-animated-search";
import Link from "next/link";
import { FileText, ShieldCheck, Clock3, Plus } from "lucide-react";
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
    <div className="customer-register-motion space-y-3">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/policies" />
      <section className="customer-register-hero relative isolate overflow-hidden rounded-2xl border border-[#D6E7FA] bg-[#DDEEFF] text-[#102B54] shadow-[0_6px_24px_rgba(20,58,100,.05)]">
        <div className="pointer-events-none absolute inset-0 bg-[url('/assets/policy%20(2).jpeg')] bg-cover bg-center bg-no-repeat opacity-95" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#EEF7FF]/85 via-[#EEF7FF]/45 via-45% to-transparent" />
        <div className="relative flex min-h-[170px] items-center px-5 py-6 sm:px-7">
          <div className="max-w-[520px]">
            <h1 className="text-[clamp(28px,3.2vw,40px)] font-bold tracking-tight">My <span className="text-[#1769DC]">Policies</span></h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[#4B6C94]">All your insurance covers and documents in one place.</p>
          </div>
        </div>
      </section>
      {counts.due>0?<section className="flex items-center justify-between gap-3 rounded-2xl border border-[#F0DFC0] bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFF0CF] text-[#B66A16]"><Clock3 className="h-5 w-5"/></span><div><strong className="block text-[13px] text-[#7A4B10]">{counts.due} polic{counts.due===1?"y is":"ies are"} approaching renewal</strong><span className="text-[12px] text-[#92714A]">Review due policies to avoid a break in cover.</span></div></div>
        <Link href={makeHref({status:"due"})} className="customer-register-action shrink-0 rounded-lg bg-white px-3 py-2 text-[12px] font-semibold text-[#9A5C12] shadow-sm">Review</Link>
      </section>:null}
      <section className="customer-register-panel overflow-hidden rounded-2xl border border-[#D9E2EF] bg-white shadow-[0_8px_30px_rgba(24,42,72,.04)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E4EAF2] px-3 py-3 sm:px-4 xl:flex-nowrap">
          <h2 className="flex shrink-0 items-center gap-2 text-[17px] font-bold text-[#102B54]"><ShieldCheck className="h-5 w-5 text-[#175CA8]" aria-hidden="true" />Policy Register</h2>
          <CustomerPolicyAnimatedSearch accountId={account.id} query={currentQuery} status={statusFilter ?? "all"} source={sourceFilter ?? "all"} />
          <div aria-label="Policy status filter" className="ml-auto flex flex-wrap items-center gap-1 rounded-lg border border-[#D8E2F0] bg-[#F8FAFD] p-1">
            {[
              ["all", "All", policies.length],
              ["active", "Active", counts.active],
              ["due", "Due", counts.due],
              ["expired", "Expired", counts.expired],
            ].map(([value,label,count])=><Link key={String(value)} href={makeHref({status:String(value)})} className={`customer-register-filter whitespace-nowrap rounded-md px-3 py-2 text-[12px] font-semibold ${statusFilter===value?"bg-[#0D756D] text-white":"text-[#60728D] hover:bg-white"}`}>{label} {count}</Link>)}
          </div>
          <PolicySourceFilter accountId={account.id} query={currentQuery} status={statusFilter ?? "all"} source={sourceFilter ?? "all"} />
          <Link href={{ pathname: "/customer/add-policy", query: { account: account.id } }} className="customer-register-action inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#1253A7] px-3 py-2.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-[#0A3E87] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1253A7]"><Plus className="h-4 w-4" />Add Policy</Link>
        </div>
      {sourceFilteredRows.length === 0 ? (
        <div className="p-5"><EmptyCustomerState title="No matching policies" body="Try adjusting your filters." /></div>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[850px] border-collapse text-left text-[13px]">
              <thead className="bg-[#F4F7FA] text-[11px] font-semibold uppercase tracking-[.035em] text-[#697D98]">
                <tr>
                  {["Policy / Product", "Vehicle / Asset", "Insurer", "Validity", "Status", "Net Premium", "Source"].map((heading) => <th key={heading} scope="col" className={`whitespace-nowrap border-b border-[#DFE7F0] px-3 py-3 ${heading === "Net Premium" ? "text-center" : ""}`}>{heading}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EDF4]">
                {sourceFilteredRows.map((policy) => {
                  const status = customerPolicyTone(policy.end_date);
                  const logo = getStaticInsurerLogo(policy.insurer_name);
                  return (
                    <tr key={`${policy.source}:${policy.id}`} className="customer-register-row group relative hover:bg-[#F7FAFE] focus-within:bg-[#F0F7FF]">
                      <td className="max-w-[220px] px-3 py-3">
                        <Link href={{ pathname: `/customer/policies/${policy.id}`, query: { account: account.id, source: policy.source } }} className="block after:absolute after:inset-0 after:cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#267AFF] focus-visible:outline-offset-2" aria-label={`View policy ${policy.policy_no}`}>
                        <p className="whitespace-nowrap text-[14px] font-semibold text-[#182D4B]">{policy.business_line || "Motor"} <span className="font-normal">· {policy.policy_product || policy.policy_type || "Policy"}</span></p>
                        <p className="mt-1 truncate text-[12px] text-[#7588A3]" title={policy.policy_no}>{policy.policy_no}</p>
                        </Link>
                      </td>
                      <td className="px-3 py-3"><div className="flex items-center gap-2"><ManufacturerMark make={policy.vehicle_make || ""}/><span className="font-bold text-[#334762]">{policy.vehicle_no || "—"}</span></div></td>
                      <td className="max-w-[160px] px-3 py-3" title={policy.insurer_name || ""}>
                        <div className="flex items-center gap-2">
                          {logo ? <img src={logo} alt={policy.insurer_name || "Insurer"} className="customer-register-logo h-7 w-7 shrink-0 object-contain" /> : <span role="img" aria-label={policy.insurer_name || "Insurer unavailable"} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EDF2F8] text-[#506786]"><FileText className="h-4 w-4" /></span>}

                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <p className="font-medium text-[#263B59]">{formatCustomerDate(policy.start_date)} – {formatCustomerDate(policy.end_date)}</p>
                        <p className="mt-1 text-[9px] text-[#7A8CA4]">{status.days < 0 ? `${Math.abs(status.days)} days expired` : `${status.days} days left`}</p>
                      </td>
                      <td className="px-3 py-3"><StatusPill tone={status.tone}>{status.tone === "due" ? "Due" : status.tone}</StatusPill></td>
                                            <td className="whitespace-nowrap px-3 py-3 text-center font-semibold text-[#263B59]" title="Verified net premium is not provided by the customer policy API">—</td>
                      <td className="px-3 py-3 text-[11px] font-semibold uppercase text-[#64748B]">{policy.source === "external" ? "External" : "Internal"}</td>
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
                <Link key={`${policy.source}:${policy.id}`} href={{ pathname: `/customer/policies/${policy.id}`, query: { account: account.id, source: policy.source } }} className="customer-register-row block px-4 py-3 hover:bg-[#F7FAFE]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#182D4B]">{policy.business_line || "Motor"} · {policy.policy_product || policy.policy_type || "Policy"}</p>
                      <div className="mt-1 flex items-center gap-2 text-[12px] text-[#60728D]"><ManufacturerMark make={policy.vehicle_make || ""}/><span className="truncate">{policy.vehicle_no || policy.policy_no}</span></div>
                    </div>
                    <StatusPill tone={status.tone}>{status.tone === "due" ? "Due" : status.tone}</StatusPill>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[12px] text-[#526682]">
                    {logo ? <img src={logo} alt="" className="h-6 w-6 object-contain" /> : null}
                    <span className="min-w-0 flex-1" aria-label={policy.insurer_name || "Insurer unavailable"} />
                    <span className="font-semibold" title="Verified net premium is not provided by the customer policy API">—</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#8A9AB0]">{formatCustomerDate(policy.start_date)} – {formatCustomerDate(policy.end_date)} · {policy.source === "external" ? "External" : "Internal"}</p>
                </Link>
              );
            })}
          </div>
        </>
      )}
      <p className="border-t border-[#E8EDF4] px-4 py-3 text-[12px] font-medium text-[#6A7B93]">Showing {sourceFilteredRows.length} of {policies.length} policies</p>
      </section>
    </div>
  );
}
