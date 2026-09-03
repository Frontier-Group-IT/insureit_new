import Link from "next/link";
import { ArrowLeft, Car, ShieldCheck, UserRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebPolicyDetail } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function currency(value: number | string | null | undefined) {
  if (value == null) return "Not recorded";
  const amount = Number(value);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}
function dateLabel(value: string | null) {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? value + "T00:00:00" : value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function humanize(value: string | null | undefined) {
  return (value || "not recorded").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function display(...values: Array<string | number | null | undefined>) {
  return values.map((v) => v == null ? "" : String(v).trim()).filter(Boolean).join(" · ");
}

export default async function PartnerPolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPartnerWebPolicyDetail(id);
  const categorySource = [data.policy.policy_type, data.policy.policy_product, data.policy.business_line].filter(Boolean).join(" ").toLowerCase();
  const category = categorySource.includes("health") ? "Health" : categorySource.includes("life") ? "Life" : categorySource.includes("motor") || data.vehicle ? "Motor" : "Non-Motor";

  return (
    <PartnerPortalShell title="Policy Detail">
      <div className="space-y-4">
        <Link href="/partner/policies" className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653]">
          <ArrowLeft className="h-3.5 w-3.5" /> Policy Register
        </Link>

        <section className="overflow-hidden rounded-[26px] border border-[#D7E0EC] bg-white shadow-[0_16px_45px_rgba(34,56,89,.07)]">
          <div className="flex flex-col gap-4 border-b border-[#E6ECF3] px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EEF4FF] text-[#3156B8]"><ShieldCheck className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#6F8098]">{category}</p>
                <h2 className="mt-1 truncate text-[23px] font-extrabold tracking-[-0.025em] text-[#142541]">{data.policy.policy_no || data.policy.policy_code || "Policy"}</h2>
                <p className="mt-1 text-[10.5px] font-medium text-[#74839A]">{data.insurer.name || "Insurer not recorded"}</p>
              </div>
            </div>
            <span className="inline-flex w-fit rounded-xl bg-[#EEF3F8] px-3 py-1.5 text-[9.5px] font-bold text-[#425672]">{humanize(data.policy.lifecycle_status)}</span>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            <HeroMetric label="Gross Premium" value={currency(data.premium.gross_premium)} />
            <HeroMetric label="Policy Start" value={dateLabel(data.policy.start_date)} />
            <HeroMetric label="Policy End" value={dateLabel(data.policy.end_date)} />
            <HeroMetric label="Business Type" value={data.policy.business_type || data.policy.policy_product || "Not recorded"} />
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
            <SectionTitle title="Policy Overview" />
            <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <Info label="Category" value={category} />
              <Info label="Product" value={data.policy.policy_product || data.policy.policy_type || data.policy.business_line || "Not recorded"} />
              <Info label="Issuance" value={dateLabel(data.policy.issuance_date)} />
              <Info label="Status" value={humanize(data.policy.status || data.policy.lifecycle_status)} />
              <Info label="IDV" value={data.policy.insured_declared_value != null ? currency(data.policy.insured_declared_value) : "Not recorded"} />
              <Info label="Lifecycle" value={humanize(data.policy.lifecycle_status)} />
            </div>
          </section>

          <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
            <SectionTitle title="Premium Breakup" />
            <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <Info label="Net Premium" value={currency(data.premium.net_premium)} />
              <Info label="OD Premium" value={currency(data.premium.od_premium)} />
              <Info label="TP Premium" value={currency(data.premium.tp_premium)} />
              <Info label="GST" value={currency(data.premium.gst_amount)} />
              <Info label="CPA" value={data.premium.cpa_opted ? currency(data.premium.cpa_amount) : "Not opted / not recorded"} />
              <Info label="Gross Premium" value={currency(data.premium.gross_premium)} />
            </div>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
            <SectionTitle title={data.vehicle ? "Customer & Vehicle" : "Customer & Insured Risk"} />
            <div className="mt-4 space-y-3">
              {data.customer.id ? (
                <Link href={"/partner/customers/" + encodeURIComponent(data.customer.id)} className="flex items-center gap-3 rounded-2xl border border-[#E1E7F0] bg-[#F8FAFD] p-4">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#3156B8]"><UserRound className="h-4 w-4" /></span>
                  <span><span className="block text-[11px] font-extrabold text-[#1B2F4E]">{data.customer.name}</span><span className="mt-0.5 block text-[9.5px] text-[#74839A]">{data.customer.customer_code || "Customer"}</span></span>
                </Link>
              ) : null}
              <div className="flex items-center gap-3 rounded-2xl border border-[#E1E7F0] bg-[#F8FAFD] p-4">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#3156B8]"><Car className="h-4 w-4" /></span>
                <span><span className="block text-[11px] font-extrabold text-[#1B2F4E]">{data.vehicle?.vehicle_no || data.policy.policy_product || data.policy.policy_type || "Insured risk"}</span><span className="mt-0.5 block text-[9.5px] text-[#74839A]">{data.vehicle ? display(data.vehicle.make, data.vehicle.model, data.vehicle.year) || humanize(data.vehicle.vehicle_type) : "No vehicle linked to this policy"}</span></span>
              </div>
            </div>
          </section>

          <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
            <SectionTitle title="Commercial Attribution" />
            <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <Info label="Intermediary" value={display(humanize(data.commercial.intermediary_type), data.commercial.intermediary_code) || "Not recorded"} />
              <Info label="RM" value={data.commercial.rm_name || "Not recorded"} />
              <Info label="Group" value={display(data.commercial.group_name, data.commercial.group_code) || "No policy snapshot"} />
              <Info label="Policy Lifecycle" value={humanize(data.policy.lifecycle_status)} />
            </div>
          </section>
        </div>
      </div>
    </PartnerPortalShell>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-[#E6ECF3] px-5 py-4 sm:border-r sm:px-6 xl:border-b-0 xl:last:border-r-0"><p className="text-[8.5px] font-black uppercase tracking-[0.1em] text-[#7A899F]">{label}</p><p className="mt-1.5 truncate text-[11px] font-extrabold text-[#203653]">{value}</p></div>;
}
function SectionTitle({ title }: { title: string }) { return <h3 className="text-[16px] font-extrabold text-[#152746]">{title}</h3>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[8.5px] font-black uppercase tracking-[0.1em] text-[#8390A3]">{label}</p><p className="mt-1 text-[10.5px] font-semibold text-[#203653]">{value}</p></div>; }
