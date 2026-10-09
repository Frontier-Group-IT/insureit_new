import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
  const { id } = await params;
  const query: { account?: string; source?: string } = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(query.account);
  const policy = await loadCustomerPolicyDetail(account.id, id, query.source);
  const status = customerPolicyTone(policy.end_date);
  const statusLabel = status.tone === "due" ? `Due in ${status.days}d` : status.tone;

  const field = (label: string, value: string) => (
    <div className="min-w-0">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#5D6D84]">{label}</p>
      <div className="min-h-12 break-words rounded-xl border border-[#D9E2EF] bg-[#F8FAFD] px-3 py-3 text-[12px] font-medium text-[#243B5B]">{value || "—"}</div>
    </div>
  );
  const sourceName = policy.source === "external" ? "External policy" : "INSUREIT policy";
  return (
    <div className="space-y-4 pb-6">
      <Link href={{ pathname: "/customer/policies", query: { account: account.id } }} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#53627A] hover:text-[#142746]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to policies
      </Link>
      <div className="overflow-hidden rounded-2xl border border-[#D9E2EF] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-[#0C254E] to-[#2B5594] px-6 py-5 text-white">
          <div><p className="text-[11px] opacity-75">POLICY DETAILS · {sourceName.toUpperCase()}</p><h1 className="mt-1 break-all text-[18px] font-bold">{policy.policy_no}</h1><p className="mt-1 text-[12px] opacity-80">{policy.insurer_name || "Insurer not available"}</p></div>
          <StatusPill tone={status.tone}>{statusLabel}</StatusPill>
        </div>
        <nav aria-label="Policy details sections" className="flex flex-wrap gap-5 border-b border-[#D9E2EF] bg-[#F7F9FD] px-5 py-3 text-[11px] font-semibold text-[#315487]">
          <a href="#policy-source">01 Source</a><a href="#insured-vehicle">02 Customer &amp; Vehicle</a><a href="#policy-premium">03 Policy &amp; Premium</a>
        </nav>
      </div>
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/policies" />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="space-y-4">
          <section id="policy-source" className="overflow-hidden rounded-2xl border border-[#D9E2EF] bg-white">
            <div className="flex items-center gap-3 border-b border-[#E1E8F1] px-5 py-4"><span className="rounded-lg bg-[#17345B] px-3 py-2 text-[12px] font-bold text-white">01</span><h2 className="text-[14px] font-semibold text-[#172844]">Policy source &amp; ownership</h2></div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {field("Policy issuance date", "—")}
              {field("Policy type", policy.policy_type || "—")}
              {field("Intermediary type", sourceName)}
              {field("Lead source", "—")}
            </div>
          </section>
          <section id="insured-vehicle" className="overflow-hidden rounded-2xl border border-[#D9E2EF] bg-white">
            <div className="flex items-center gap-3 border-b border-[#E1E8F1] px-5 py-4"><span className="rounded-lg bg-[#17345B] px-3 py-2 text-[12px] font-bold text-white">02</span><div><h2 className="text-[14px] font-semibold text-[#172844]">Insured &amp; vehicle identification</h2><p className="text-[10px] text-[#7C8AA1]">Read-only details linked to this policy.</p></div></div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {field("Registration no.", policy.vehicle_no || "—")}
              {field("Insured name", account.customer_name || account.contact_name || "—")}
              {field("Phone number", "—")}
              {field("Vehicle class", "—")}
              {field("Make", policy.vehicle_make || "—")}
              {field("Model", policy.vehicle_model || "—")}
              {field("Fuel type", "—")}
              {field("Manufacturing year", "—")}
              {field("RTO", "—")}
              {field("Capacity", "—")}
              {field("Chassis number", "—")}
              {field("Engine number", "—")}
            </div>
            {policy.vehicle_id ? <div className="border-t border-[#E1E8F1] px-5 py-3"><Link href={{ pathname: `/customer/vehicles/${policy.vehicle_id}`, query: { account: account.id } }} className="text-[11px] font-semibold text-[#174EA6] hover:underline">View linked vehicle details →</Link></div> : null}
          </section>
          <section id="policy-premium" className="overflow-hidden rounded-2xl border border-[#D9E2EF] bg-white">
            <div className="flex items-center gap-3 border-b border-[#E1E8F1] px-5 py-4"><span className="rounded-lg bg-[#17345B] px-3 py-2 text-[12px] font-bold text-white">03</span><h2 className="text-[14px] font-semibold text-[#172844]">Policy &amp; premium</h2></div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {field("Policy number", policy.policy_no)}
              {field("Insurer", policy.insurer_name || "—")}
              {field("Product", policy.policy_product || policy.business_line || "—")}
              {field("Start date", formatCustomerDate(policy.start_date))}
              {field("End date", formatCustomerDate(policy.end_date))}
              {field("Gross premium", formatCustomerMoney(policy.premium_amount))}
              {field("IDV / Sum insured", formatCustomerMoney(policy.insured_declared_value))}
              {field("Source", sourceName)}
            </div>
          </section>
        </main>
        <aside className="space-y-4 xl:sticky xl:top-4">
          <section className="overflow-hidden rounded-2xl border border-[#D9E2EF] bg-white">
            <div className="flex items-center justify-between border-b border-[#E1E8F1] px-5 py-4"><div><p className="text-[10px] uppercase text-[#788BA6]">Policy status</p><h2 className="text-[14px] font-semibold text-[#17345B]">Policy summary</h2></div><StatusPill tone={status.tone}>{statusLabel}</StatusPill></div>
            <div className="space-y-4 p-5">
              <div className="flex justify-between text-[12px]"><span>Net premium</span><strong>—</strong></div>
              <div className="flex justify-between border-t border-[#E1E8F1] pt-3 text-[12px]"><span>GST</span><strong>—</strong></div>
              <div className="flex justify-between border-t border-[#E1E8F1] pt-3 text-[12px]"><span>Gross premium</span><strong>{formatCustomerMoney(policy.premium_amount)}</strong></div>
              <div className="border-t border-[#E1E8F1] pt-3 text-[11px] text-[#60738F]">Validity: {formatCustomerDate(policy.start_date)} – {formatCustomerDate(policy.end_date)}</div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
