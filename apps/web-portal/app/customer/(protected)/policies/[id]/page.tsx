import Link from "next/link";
import { ArrowLeft, CalendarDays, CarFront, IndianRupee, ShieldCheck } from "lucide-react";
import {
  CustomerAccountTabs,
  CustomerPageHeading,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import {
  customerPolicyTone,
  formatCustomerDate,
  formatCustomerMoney,
  loadCustomerPolicyDetail,
  resolveCustomerWebScope,
} from "@/lib/customer-web-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerPolicyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ account?: string; source?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams ?? Promise.resolve({})]);
  const { account, accounts } = await resolveCustomerWebScope(query.account);
  const policy = await loadCustomerPolicyDetail(account.id, id, query.source);
  const status = customerPolicyTone(policy.end_date);
  const statusLabel = status.tone === "due" ? `Due in ${status.days}d` : status.tone;

  const details = [
    ["Policy type", policy.policy_type || "—"],
    ["Business line", policy.business_line || "—"],
    ["Product", policy.policy_product || "—"],
    ["Insurer", policy.insurer_name || "—"],
    ["Start date", formatCustomerDate(policy.start_date)],
    ["End date", formatCustomerDate(policy.end_date)],
    ["Premium", formatCustomerMoney(policy.premium_amount)],
    ["IDV / Sum insured", formatCustomerMoney(policy.insured_declared_value)],
    ["Source", policy.source === "external" ? "External policy" : "INSUREIT policy"],
  ];

  return (
    <div className="space-y-5">
      <Link href={{ pathname: "/customer/policies", query: { account: account.id } }} className="inline-flex items-center gap-1 text-[11px] font-black text-[#53627A] hover:text-[#142746]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to policies
      </Link>

      <CustomerPageHeading
        eyebrow={policy.source === "external" ? "External policy" : "Policy detail"}
        title={policy.policy_no}
        description={policy.insurer_name || policy.policy_product || policy.policy_type}
        action={<StatusPill tone={status.tone}>{statusLabel}</StatusPill>}
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname={`/customer/policies/${policy.id}`} />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.75fr]">
        <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#174EA6]" /><h2 className="text-[13px] font-black text-[#10213D]">Policy information</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[#F7F9FC] px-3 py-2.5">
                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8794A7]">{label}</p>
                <p className="mt-1 break-words text-[11.5px] font-black text-[#35445B]">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8794A7]">Coverage timeline</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EEF4FF] text-[#174EA6]"><CalendarDays className="h-5 w-5" /></span>
              <div><p className="text-[11px] font-black text-[#10213D]">{formatCustomerDate(policy.start_date)} → {formatCustomerDate(policy.end_date)}</p><p className="mt-0.5 text-[10px] font-semibold text-[#74839A]">Current status: {statusLabel}</p></div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8794A7]">Premium & value</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#F7F9FC] p-3"><IndianRupee className="h-4 w-4 text-[#174EA6]" /><p className="mt-2 text-[9px] font-bold text-[#8794A7]">Premium</p><p className="text-[12px] font-black text-[#10213D]">{formatCustomerMoney(policy.premium_amount)}</p></div>
              <div className="rounded-xl bg-[#F7F9FC] p-3"><ShieldCheck className="h-4 w-4 text-[#174EA6]" /><p className="mt-2 text-[9px] font-bold text-[#8794A7]">IDV / Sum insured</p><p className="text-[12px] font-black text-[#10213D]">{formatCustomerMoney(policy.insured_declared_value)}</p></div>
            </div>
          </div>

          {policy.vehicle_id ? (
            <Link href={{ pathname: `/customer/vehicles/${policy.vehicle_id}`, query: { account: account.id } }} className="flex items-center gap-3 rounded-2xl border border-[#DCE4EE] bg-white p-4 hover:border-[#B9C9DB]">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EEF4FF] text-[#174EA6]"><CarFront className="h-5 w-5" /></span>
              <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8794A7]">Covered vehicle</p><p className="truncate text-[12px] font-black text-[#10213D]">{policy.vehicle_no || "Open vehicle"}</p><p className="truncate text-[10px] font-semibold text-[#74839A]">{[policy.vehicle_make, policy.vehicle_model].filter(Boolean).join(" · ")}</p></div>
            </Link>
          ) : null}
        </section>
      </div>
    </div>
  );
}
