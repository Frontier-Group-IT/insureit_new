import Image from "next/image";
import Link from "next/link";
import { CalendarDays, CarFront, ChevronDown, FileCheck2, Info, ShieldCheck, Wallet } from "lucide-react";
import { CustomerAccountTabs, StatusPill } from "@/components/customer-portal/customer-phase1";
import { getStaticInsurerLogo } from "@/lib/insurer-logo";
import {
  customerPolicyTone,
  formatCustomerDate,
  formatCustomerMoney,
  loadCustomerPolicyDetail,
  resolveCustomerWebScope,
} from "@/lib/customer-web-data";
import { CopyPolicyNumber } from "./copy-policy-number";
import "./policy-details.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0 border-b border-[#E9EEF6] py-2 last:border-b-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[.045em] text-[#72839D]">{label}</dt>
      <dd className="mt-0.5 break-words text-[12px] font-semibold leading-5 text-[#1D355A]">{value?.trim() || "—"}</dd>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: {
  icon: typeof ShieldCheck;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[#E6EDF7] px-4 py-3 sm:px-5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#ECF4FF] text-[#1764C0]"><Icon className="h-4.5 w-4.5" aria-hidden="true" /></span>
      <div className="min-w-0">
        <h2 className="text-[14px] font-bold text-[#16335E]">{title}</h2>
        {subtitle ? <p className="text-[11px] text-[#7A8BA4]">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export default async function CustomerPolicyDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ account?: string; source?: string }>;
}) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(query.account);
  const policy = await loadCustomerPolicyDetail(account.id, id, query.source);
  const status = customerPolicyTone(policy.end_date);
  const statusLabel = status.tone === "due" ? "Due in " + status.days + " days" : status.tone;
  const sourceName = policy.source === "external" ? "External policy" : "INSUREIT policy";
  const insurerLogo = getStaticInsurerLogo(policy.insurer_name);
  const makeModel = [policy.vehicle_make, policy.vehicle_model].filter(Boolean).join(" · ") || "Vehicle details unavailable";
  const insuredName = account.customer_name || account.contact_name || "—";
  const premium = policy.premium_amount == null ? "—" : formatCustomerMoney(policy.premium_amount);
  const idv = policy.insured_declared_value == null ? "—" : formatCustomerMoney(policy.insured_declared_value);

  return (
    <div className="customer-policy-detail space-y-3 pb-6">
      {/* The existing portal breadcrumb provides return navigation; no extra Back link above this hero. */}
      <section aria-labelledby="policy-detail-title" className="policy-detail-enter overflow-hidden rounded-2xl border border-[#DCE7F5] bg-white shadow-[0_8px_26px_rgba(20,55,105,.06)]">
        <div className="relative isolate overflow-hidden bg-[linear-gradient(108deg,#102D58_0%,#17549D_65%,#2184AF_100%)] px-4 py-4 text-white sm:px-5">
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border-[28px] border-white/[.07]" />
          <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-[25%] h-20 w-32 rounded-full bg-[#9BDAFF]/10 blur-2xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-white/90 bg-white p-1.5 shadow-[0_5px_14px_rgba(2,18,43,.18)]">
                {insurerLogo
                  ? <Image src={insurerLogo} alt="" aria-hidden="true" width={48} height={48} unoptimized className="h-11 w-11 object-contain" />
                  : <Image src="/assets/Custom-Icons/optimized-128/policy.png" alt="" aria-hidden="true" width={48} height={48} unoptimized className="h-11 w-11 object-contain" />}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#C8E1FF]">{sourceName} · {policy.policy_type || "Insurance"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <h1 id="policy-detail-title" className="min-w-0 break-all text-[clamp(17px,2vw,23px)] font-extrabold tracking-tight">{policy.policy_no}</h1>
                  <CopyPolicyNumber value={policy.policy_no} />
                </div>
                <p className="mt-1 text-[12px] text-[#E4F0FF]">{policy.insurer_name || "Insurer not available"}</p>
              </div>
            </div>
            <StatusPill tone={status.tone}>{statusLabel}</StatusPill>
          </div>
          <div className="relative mt-4 grid grid-cols-2 gap-2 border-t border-white/20 pt-3 sm:grid-cols-4">
            <div><p className="text-[9px] uppercase tracking-wide text-[#C3DDF6]">Vehicle</p><p className="mt-0.5 break-words text-[12px] font-bold">{policy.vehicle_no || "—"}</p></div>
            <div><p className="text-[9px] uppercase tracking-wide text-[#C3DDF6]">Valid from</p><p className="mt-0.5 text-[12px] font-bold">{formatCustomerDate(policy.start_date)}</p></div>
            <div><p className="text-[9px] uppercase tracking-wide text-[#C3DDF6]">Valid until</p><p className="mt-0.5 text-[12px] font-bold">{formatCustomerDate(policy.end_date)}</p></div>
            <div><p className="text-[9px] uppercase tracking-wide text-[#C3DDF6]">Product</p><p className="mt-0.5 break-words text-[12px] font-bold">{policy.policy_product || policy.business_line || "—"}</p></div>
          </div>
        </div>
      </section>

      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/policies" />

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_310px]">
        <main className="min-w-0 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <section id="policy-vehicle" className="policy-detail-card policy-detail-enter scroll-mt-24 overflow-hidden rounded-2xl border border-[#DDE7F4] bg-white">
              <SectionTitle icon={CarFront} title="Vehicle & insured" subtitle="Registration and ownership at a glance" />
              <dl className="grid grid-cols-2 gap-x-4 px-4 py-2 sm:px-5">
                <Detail label="Registration no." value={policy.vehicle_no} />
                <Detail label="Insured name" value={insuredName} />
                <Detail label="Make & model" value={makeModel} />
                <Detail label="Policy type" value={policy.policy_type} />
              </dl>
              {policy.vehicle_id ? <div className="border-t border-[#E6EDF7] px-4 py-2.5 sm:px-5"><Link href={{ pathname: "/customer/vehicles/" + policy.vehicle_id, query: { account: account.id } }} className="text-[11px] font-semibold text-[#1764C0] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1764C0]">View linked vehicle details →</Link></div> : null}
            </section>
            <section id="policy-coverage" className="policy-detail-card policy-detail-enter scroll-mt-24 overflow-hidden rounded-2xl border border-[#DDE7F4] bg-white">
              <SectionTitle icon={CalendarDays} title="Policy coverage" subtitle="Cover period and validity" />
              <div className="px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-2 text-[11px]"><span className="text-[#6B7F9A]">Start date</span><strong className="text-[#18365D]">{formatCustomerDate(policy.start_date)}</strong></div>
                <div aria-hidden="true" className="my-3 flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-[3px] border-[#1F78CF] bg-white"/><span className="policy-detail-timeline h-1 flex-1 rounded-full bg-[linear-gradient(90deg,#1F78CF,#8AC9F3)]"/><span className="h-3 w-3 rounded-full border-[3px] border-[#1F78CF] bg-white"/></div>
                <div className="flex items-center justify-between gap-2 text-[11px]"><span className="text-[#6B7F9A]">Expiry date</span><strong className="text-[#18365D]">{formatCustomerDate(policy.end_date)}</strong></div>
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#E6EDF7] bg-[#F5F9FE] px-3 py-2 text-[11px] text-[#496384]"><ShieldCheck className="h-4 w-4 shrink-0 text-[#287FCB]" /><span>Validity is calculated from the recorded policy dates.</span></div>
              </div>
            </section>
          </div>

          <section id="policy-premium" className="policy-detail-card policy-detail-enter scroll-mt-24 overflow-hidden rounded-2xl border border-[#DDE7F4] bg-white">
            <SectionTitle icon={Wallet} title="Policy & premium" subtitle="Only amounts available in your policy record are displayed" />
            <div className="grid grid-cols-2 gap-x-5 px-4 py-2 sm:grid-cols-4 sm:px-5">
              <Detail label="Gross premium" value={premium} />
              <Detail label="IDV / Sum insured" value={idv} />
              <Detail label="Product" value={policy.policy_product || policy.business_line} />
              <Detail label="Insurer" value={policy.insurer_name} />
            </div>
          </section>

          <details id="policy-source" className="policy-detail-card policy-detail-enter group scroll-mt-24 overflow-hidden rounded-2xl border border-[#DDE7F4] bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1764C0] sm:px-5">
              <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#ECF4FF] text-[#1764C0]"><FileCheck2 className="h-4.5 w-4.5"/></span><div><h2 className="text-[14px] font-bold text-[#16335E]">Additional policy details</h2><p className="text-[11px] text-[#7A8BA4]">Source, identifiers and other available information</p></div></div>
              <ChevronDown className="h-4 w-4 shrink-0 text-[#5A7293] transition-transform duration-200 group-open:rotate-180" aria-hidden="true"/>
            </summary>
            <div className="border-t border-[#E6EDF7] px-4 py-2 sm:px-5">
              <dl className="grid grid-cols-2 gap-x-5 sm:grid-cols-3">
                <Detail label="Policy number" value={policy.policy_no} />
                <Detail label="Intermediary type" value={sourceName} />
                <Detail label="Policy issuance date" value="—" />
                <Detail label="Lead source" value="—" />
                <Detail label="Phone number" value="—" />
                <Detail label="Vehicle class" value="—" />
                <Detail label="Fuel type" value="—" />
                <Detail label="Manufacturing year" value="—" />
                <Detail label="RTO" value="—" />
                <Detail label="Capacity" value="—" />
                <Detail label="Chassis number" value="—" />
                <Detail label="Engine number" value="—" />
              </dl>
              <p className="flex items-start gap-1.5 border-t border-[#E6EDF7] py-2 text-[10px] text-[#7888A0]"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0"/>Missing technical details are not available in the current policy record. No values are estimated.</p>
            </div>
          </details>
        </main>
        <aside className="policy-detail-enter xl:sticky xl:top-4">
          <section className="policy-detail-card overflow-hidden rounded-2xl border border-[#DDE7F4] bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-[#E6EDF7] px-4 py-3">
              <h2 className="text-[14px] font-bold text-[#16335E]">Policy summary</h2>

            </div>
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#72839D]">Gross premium</p>
              <p className="mt-1 break-words text-[23px] font-extrabold tracking-tight text-[#163C6B]">{premium}</p>
              <div className="mt-3 flex items-center justify-between border-t border-[#E6EDF7] py-2 text-[11px]"><span className="text-[#6B7F9A]">IDV / Sum insured</span><strong className="text-[#16345C]">{idv}</strong></div>
              <div className="flex items-center justify-between border-t border-[#E6EDF7] py-2 text-[11px]"><span className="text-[#6B7F9A]">Policy source</span><strong className="text-[#16345C]">{sourceName}</strong></div>
              <div className="flex items-center gap-2 border-t border-[#E6EDF7] pt-3 text-[10px] text-[#71839E]"><ShieldCheck className="h-4 w-4 text-[#1D71C2]"/><span>View-only policy information</span></div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
