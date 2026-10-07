import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
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
    <div className="space-y-5">
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

      {rows.length === 0 ? (
        <EmptyCustomerState
          title={policies.length ? "No matching policies" : "No policies found"}
          body={policies.length ? "Change your search or status filter." : "Policies linked to this Customer account will appear here."}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((policy) => {
            const status = customerPolicyTone(policy.end_date);
            const statusLabel = status.tone === "due" ? `Due in ${status.days}d` : status.tone;
            return (
              <Link
                key={`${policy.source}:${policy.id}`}
                href={{ pathname: `/customer/policies/${policy.id}`, query: { account: account.id, source: policy.source } }}
                className="group overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white shadow-[0_8px_24px_rgba(28,50,82,0.04)] transition hover:-translate-y-0.5 hover:border-[#B9C9DB]"
              >
                <div className="h-1 bg-[#174EA6]" />
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#174EA6]"><ShieldCheck className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-[13.5px] font-black text-[#10213D]">{policy.policy_no}</h2>
                        <StatusPill tone={status.tone}>{statusLabel}</StatusPill>
                      </div>
                      <p className="mt-1 truncate text-[10.5px] font-bold text-[#6E7D93]">{policy.insurer_name || "Insurance company"}</p>
                      <p className="mt-0.5 truncate text-[10px] font-semibold text-[#8B97A8]">{policy.policy_product || policy.policy_type || "Policy"}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#F7F9FC] p-3 text-[10px]">
                    <div><p className="font-bold text-[#8995A8]">Vehicle</p><p className="truncate font-black text-[#35445B]">{policy.vehicle_no || "Non-motor / not linked"}</p></div>
                    <div><p className="font-bold text-[#8995A8]">Source</p><p className="font-black uppercase text-[#35445B]">{policy.source === "external" ? "External" : "INSUREIT"}</p></div>
                    <div><p className="font-bold text-[#8995A8]">Valid until</p><p className="font-black text-[#35445B]">{formatCustomerDate(policy.end_date)}</p></div>
                    <div><p className="font-bold text-[#8995A8]">Premium</p><p className="font-black text-[#35445B]">{formatCustomerMoney(policy.premium_amount)}</p></div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}