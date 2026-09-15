import Link from "next/link";
import {
  Building2,
  Check,
  ChevronRight,
  FileText,
  FileUp,
  IndianRupee,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebPolicyDetail } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(value: number | string | null | undefined, decimals = 2) {
  if (value == null || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

function dateInput(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function monthLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" }).format(date);
}

function humanize(value: string | null | undefined, fallback = "Not recorded") {
  if (!value) return fallback;
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function valueOrFallback(value: string | number | null | undefined, fallback = "Not recorded") {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  return String(value);
}

export default async function PartnerPolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPartnerWebPolicyDetail(id);

  const policyType = data.policy.business_line === "Non Motor" ? "Non Motor" : "Motor";
  const intermediary = [humanize(data.commercial.intermediary_type, ""), data.commercial.intermediary_code]
    .filter(Boolean)
    .join(" / ") || "Not recorded";
  const customerName = valueOrFallback(data.customer.name, "Customer not recorded");
  const grossPremium = data.premium.gross_premium ?? data.premium.net_premium;
  const statusComplete = data.policy.status || data.policy.lifecycle_status;

  return (
    <PartnerPortalShell title="Edit Policy">
      <div className="pb-5">
        <section className="overflow-hidden rounded-[14px] border border-[#D8E0EB] bg-white shadow-[0_8px_24px_rgba(42,61,92,0.07)]">
          <div className="flex min-h-[64px] items-center justify-between bg-gradient-to-r from-[#0B2C62] via-[#0D3978] to-[#2C5D9F] px-5 text-white">
            <h1 className="text-[16px] font-extrabold tracking-[-0.02em]">Edit Policy</h1>
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-[#5E8BC3] bg-[#1D588F]/80 text-[#70E0D8] shadow-inner">
              <FileUp className="h-[18px] w-[18px]" />
            </span>
          </div>

          <div className="flex min-h-[38px] items-center gap-6 border-b border-[#DDE5EF] bg-[#F7F9FC] px-5 text-[10px] font-semibold text-[#65748A]">
            <Step label="Source" />
            <Step label="Customer & Vehicle" active />
            <Step label="Policy & Premium" />
          </div>
        </section>

        <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-4">
            <FormSection number="01" title="Policy source & ownership">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Policy issuance date" required value={dateInput(data.policy.issuance_date)} helper={`Month · ${monthLabel(data.policy.issuance_date)}`} />
                <Field label="Policy type" required value={policyType} chevron />
                <Field label="Intermediary type" required value={humanize(data.commercial.intermediary_type)} chevron helper={data.commercial.rm_name ? `RM · ${data.commercial.rm_name}` : undefined} />
                <Field label="Lead source" required value={intermediary} chevron helper={data.commercial.intermediary_code ? `ID · ${data.commercial.intermediary_code}` : undefined} />
              </div>
            </FormSection>

            <FormSection
              number="02"
              title="Insured & vehicle identification"
              actions={
                <div className="flex items-center gap-2">
                  {data.customer.id ? (
                    <Link href={`/partner/customers/${encodeURIComponent(data.customer.id)}`} className="rounded-lg border border-[#C8D4E2] bg-white px-3 py-2 text-[9px] font-bold text-[#294463] transition hover:bg-[#F7FAFD]">Edit Customer</Link>
                  ) : null}
                  <Link href="/partner/vehicles" className="rounded-lg bg-[#153A68] px-3 py-2 text-[9px] font-bold text-white transition hover:bg-[#0E2D55]">Edit Vehicle</Link>
                </div>
              }
            >
              {data.vehicle ? (
                <div className="grid gap-x-3 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Registration no." required value={valueOrFallback(data.vehicle.vehicle_no)} verified />
                  <Field label="Insured name" required value={customerName} />
                  <Field label="Phone number" required value="Not recorded" />
                  <Field label="Class" required value={valueOrFallback(data.vehicle.vehicle_type)} helper={data.vehicle.vehicle_type || undefined} />
                  <Field label="Make" value={valueOrFallback(data.vehicle.make)} />
                  <Field label="Model" value={valueOrFallback(data.vehicle.model)} />
                  <Field label="Fuel type" value="Not recorded" chevron />
                  <Field label="Year of manufacturing" value={valueOrFallback(data.vehicle.year)} chevron />
                  <Field label="RTO" required value="Not recorded" />
                  <Field label="RTO name" value="Not recorded" />
                  <Field label="Capacity (CC)" value="Not recorded" />
                  <Field label="Chassis number" value="Not recorded" />
                  <Field label="Engine number" value="Not recorded" />
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Insured name" required value={customerName} />
                  <Field label="Customer code" value={valueOrFallback(data.customer.customer_code)} />
                  <Field label="Policy category" value={humanize(data.policy.business_line)} />
                  <Field label="Insured risk" value={valueOrFallback(data.policy.policy_product || data.policy.policy_type)} />
                </div>
              )}
            </FormSection>

            <FormSection number="03" title="Policy & premium">
              <div className="grid gap-x-3 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Policy number" required value={valueOrFallback(data.policy.policy_no || data.policy.policy_code)} />
                <Field label="Policy product" required value={valueOrFallback(data.policy.policy_product || data.policy.policy_type)} chevron />
                <Field label="Policy start" required value={dateInput(data.policy.start_date)} />
                <Field label="Policy end" required value={dateInput(data.policy.end_date)} />
                <Field label="Insurer" required value={valueOrFallback(data.insurer.name)} chevron />
                <Field label="IDV / Sum insured" value={data.policy.insured_declared_value == null ? "Not recorded" : money(data.policy.insured_declared_value, 0)} />
                <Field label="Net premium" value={money(data.premium.net_premium)} />
                <Field label="GST" value={money(data.premium.gst_amount)} />
                <Field label="Gross premium" value={money(data.premium.gross_premium)} />
                <Field label="OD premium" value={money(data.premium.od_premium)} />
                <Field label="TP premium" value={money(data.premium.tp_premium)} />
                <Field label="CPA" value={data.premium.cpa_opted ? money(data.premium.cpa_amount) : "Not opted"} />
              </div>
            </FormSection>
          </main>

          <aside className="self-start overflow-hidden rounded-[14px] border border-[#D8E0EB] bg-white shadow-[0_8px_24px_rgba(42,61,92,0.06)] xl:sticky xl:top-3">
            <div className="flex items-center justify-between border-b border-[#DDE5EF] px-4 py-4">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.09em] text-[#7C899C]">Policy status</p>
                <h2 className="mt-1 text-[13px] font-extrabold text-[#1E3B61]">Onboarding summary</h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full border-[5px] border-[#163D68] text-[9px] font-extrabold text-[#163D68]">100%</div>
                <span className="rounded-full bg-[#E7F8EE] px-3 py-1 text-[8px] font-extrabold text-[#168A5D]">Complete</span>
              </div>
            </div>

            <div className="border-b border-[#E2E8F0] px-4 py-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#EDF4FD] text-[#5479A7]"><IndianRupee className="h-3.5 w-3.5" /></span>
                <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8995A7]">Premium</p>
              </div>
              <SummaryRow label="Net premium" value={money(data.premium.net_premium)} />
              <SummaryRow label="GST" value={money(data.premium.gst_amount)} />
              <SummaryRow label="Gross premium" value={money(grossPremium)} accent />
            </div>

            <div className="px-4 py-4">
              <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8995A7]">PayIn-PayOut</p>
              <p className="mt-1 text-[8px] text-[#A1ACBB]">Sensitive terms · popup entry</p>

              <ActionCard icon={<FileText className="h-4 w-4" />} title="Insurer Pay-in" subtitle="Add projected insurer terms" />
              <ActionCard icon={<ShieldCheck className="h-4 w-4" />} title="Partner Payout" subtitle="Add agreed partner payout" />
            </div>

            <div className="border-t border-[#E3E9F1] bg-[#F8FAFC] px-4 py-3">
              <div className="flex items-center gap-2 text-[9px] font-semibold text-[#66768C]">
                <Building2 className="h-3.5 w-3.5 text-[#456D9C]" />
                <span>{humanize(statusComplete)}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PartnerPortalShell>
  );
}

function Step({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div className={"relative flex h-[38px] items-center gap-2 " + (active ? "text-[#3156B8]" : "text-[#69788D]")}> 
      <Check className="h-3 w-3 text-[#12A36B]" />
      <span>{label}</span>
      {active ? <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#5B5CEB]" /> : null}
    </div>
  );
}

function FormSection({ number, title, actions, children }: { number: string; title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#D8E0EB] bg-white shadow-[0_6px_18px_rgba(42,61,92,0.05)]">
      <div className="flex min-h-[54px] items-center justify-between gap-3 border-b border-[#DFE6EF] px-4">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#153A68] text-[10px] font-extrabold text-white">{number}</span>
          <h2 className="text-[13px] font-extrabold text-[#1D385B]">{title}</h2>
        </div>
        {actions}
      </div>
      <div className="px-4 py-5">{children}</div>
    </section>
  );
}

function Field({ label, value, required = false, chevron = false, helper, verified = false }: { label: string; value: string; required?: boolean; chevron?: boolean; helper?: string; verified?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-1.5">
        <p className="text-[8px] font-black uppercase tracking-[0.04em] text-[#66758A]">{label}</p>
        {required ? <span className="text-[10px] font-black text-[#E94242]">*</span> : null}
        {verified ? <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-[#16A36F] text-[#16A36F]"><Check className="h-2.5 w-2.5" /></span> : null}
      </div>
      <div className="flex min-h-[42px] items-center justify-between gap-2 rounded-xl border border-[#D4DDE9] bg-[#F8FAFC] px-3 text-[10px] font-medium text-[#65758B] shadow-inner shadow-[#F1F4F8]">
        <span className="min-w-0 break-words">{value}</span>
        {chevron ? <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90 text-[#73849B]" /> : null}
      </div>
      {helper ? <p className="mt-1.5 text-[8px] text-[#7A8BA2]">{helper}</p> : null}
    </div>
  );
}

function SummaryRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[#E8EDF3] py-3 last:border-b-0">
      <span className="text-[9px] font-medium text-[#6E7E92]">{label}</span>
      <span className={"text-[10px] font-bold " + (accent ? "text-[#4C50E8]" : "text-[#264568]")}>{value}</span>
    </div>
  );
}

function ActionCard({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#D6E0EB] bg-[#FBFCFE] px-3 py-3">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E6F6F4] text-[#12988D]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-extrabold text-[#294667]">{title}</p>
        <p className="mt-0.5 text-[8px] text-[#8492A5]">{subtitle}</p>
      </div>
      <span className="rounded-full bg-[#F2F4F7] px-2 py-1 text-[7px] font-bold text-[#8B98AA]">Not entered</span>
      <ChevronRight className="h-3.5 w-3.5 text-[#8A99AD]" />
    </div>
  );
}
