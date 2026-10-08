import Link from "next/link";
import { Search } from "lucide-react";
import {
  CustomerAccountTabs,
  CustomerPageHeading,
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
  searchParams?: Promise<{ account?: string; q?: string; status?: string }>;
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

  return (
    <div className="space-y-3">
      <CustomerPageHeading
        eyebrow="My insurance"
        title="Policies"
        description="Internal and external policies available to your selected Customer account."
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/policies" />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <form className="flex max-w-xl flex-1 items-center gap-2 rounded-xl border border-[#D8E1EC] bg-white px-3 py-2.5">
          <Search className="h-4 w-4 text-[#73829A]" />
          <input type="hidden" name="account" value={account.id} />
          {statusFilter !== "all" ? <input type="hidden" name="status" value={statusFilter} /> : null}
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search policy, insurer, vehicle or product"
            className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-[#10213D] outline-none placeholder:text-[#9AA6B7]"
          />
          <button className="rounded-lg bg-[#142746] px-3 py-1.5 text-[10px] font-black text-white">Search</button>
        </form>

        <div className="flex flex-wrap gap-2">
          {[
            ["all", "All", policies.length],
            ["active", "Active", counts.active],
            ["due", "Renewal Due", counts.due],
            ["expired", "Expired", counts.expired],
          ].map(([value, label, count]) => {
            const active = statusFilter === value;
            return (
              <Link
                key={String(value)}
                href={filterHref(String(value))}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-black transition ${
                  active ? "border-[#142746] bg-[#142746] text-white" : "border-[#D8E1EC] bg-white text-[#64748B] hover:border-[#AEBED1]"
                }`}
              >
                {label} · {count}
              </Link>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? <EmptyCustomerState title="No matching policies" body="Try adjusting your filters." /> : (
        <div className="overflow-x-auto rounded-xl border border-[#D8E1EC] bg-white">
          <table className="w-full min-w-[920px] border-collapse text-left text-[11px]">
            <thead className="bg-[#F1F5FA] text-[10px] font-extrabold uppercase text-[#687991]"><tr>
              {["Policy no.","Insurer","Vehicle","Product","Source","Valid from","Valid until","Premium","Status",""].map(h=><th key={h} scope="col" className="border-b border-[#DCE5EF] px-3 py-3">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#E7EDF5]">
              {rows.map(policy=>{const status=customerPolicyTone(policy.end_date);return <tr key={`${policy.source}:${policy.id}`} className="hover:bg-[#F6F9FE]">
                <td className="px-3 py-2.5 font-extrabold text-[#133C73]">{policy.policy_no}</td>
                <td className="max-w-52 truncate px-3 py-2.5 font-semibold text-[#354967]" title={policy.insurer_name||""}>{policy.insurer_name||"—"}</td>
                <td className="px-3 py-2.5 font-bold">{policy.vehicle_no||"—"}</td>
                <td className="px-3 py-2.5">{policy.policy_product||policy.policy_type||"—"}</td>
                <td className="px-3 py-2.5 uppercase">{policy.source==="external"?"External":"INSUREIT"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{formatCustomerDate(policy.start_date)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{formatCustomerDate(policy.end_date)}</td>
                <td className="px-3 py-2.5 font-semibold">{formatCustomerMoney(policy.premium_amount)}</td>
                <td className="px-3 py-2.5"><StatusPill tone={status.tone}>{status.tone==="due"?`Due in ${status.days}d`:status.tone}</StatusPill></td>
                <td className="px-3 py-2.5"><Link href={{pathname:`/customer/policies/${policy.id}`,query:{account:account.id,source:policy.source}}} className="font-extrabold text-[#1754A5] hover:underline">View →</Link></td>
              </tr>})}
            </tbody>
          </table>
        </div>
      )}
 );
}