import Link from "next/link";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, CalendarDays, Car, CircleDollarSign, FileText, Percent, ShieldCheck, UserRound } from "lucide-react";
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
  return values.map((value) => value == null ? "" : String(value).trim()).filter(Boolean).join(" · ");
}

export default async function PartnerPolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPartnerWebPolicyDetail(id);
  const categorySource = [data.policy.policy_type, data.policy.policy_product, data.policy.business_line].filter(Boolean).join(" ").toLowerCase();
  const category = categorySource.includes("health") ? "Health" : categorySource.includes("life") ? "Life" : categorySource.includes("motor") || data.vehicle ? "Motor" : "Non-Motor";

  return (
    <PartnerPortalShell title="Policy Detail">
      <div className="space-y-3 pb-4">
        <Link href="/partner/policies" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#D5DFEA] bg-white px-3 text-[10px] font-bold text-[#24405F] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Policy Register
        </Link>

        <section className="overflow-hidden rounded-xl bg-gradient-to-r from-[#06285D] via-[#0A458A] to-[#0C57B3] text-white shadow-[0_8px_24px_rgba(13,64,128,0.18)]">
          <div className="px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white text-[#176AF0] shadow-sm"><FileText className="h-7 w-7" /></span>
                <div className="min-w-0">
                  <h1 className="break-words text-[22px] font-black tracking-[-0.03em] sm:text-[24px]">{data.policy.policy_no || data.policy.policy_code || "Policy"}</h1>
                </div>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#0D8D7D] px-3 py-1.5 text-[9.5px] font-bold"><span className="h-2 w-2 rounded-full bg-[#2EF0A5]" />{humanize(data.policy.lifecycle_status)}</span>
            </div>

            <div className="mt-4 grid border-t border-white/20 sm:grid-cols-2 xl:grid-cols-6">
              <HeroMetric icon={CircleDollarSign} label="Gross Premium" value={currency(data.premium.gross_premium)} />
              <HeroMetric icon={CalendarDays} label="Policy Start" value={dateLabel(data.policy.start_date)} />
              <HeroMetric icon={CalendarDays} label="Policy End" value={dateLabel(data.policy.end_date)} />
              <HeroMetric icon={Building2} label="Insurer" value={data.insurer.name || "Insurer not recorded"} />
              <HeroMetric icon={FileText} label="Policy Type" value={category} />
              <HeroMetric icon={BriefcaseBusiness} label="Business Type" value={data.policy.business_type || data.policy.policy_product || "Not recorded"} />
            </div>
          </div>
        </section>

        <div className="grid gap-3 xl:grid-cols-2">
          <Card title="Policy Overview" icon={FileText}>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Info label="IDV" value={data.policy.insured_declared_value != null ? currency(data.policy.insured_declared_value) : "Not recorded"} />
              <Info label="Policy Start" value={dateLabel(data.policy.start_date)} />
              <Info label="Product" value={data.policy.policy_product || data.policy.policy_type || data.policy.business_line || "Not recorded"} />
              <Info label="Policy End" value={dateLabel(data.policy.end_date)} />
              <Info label="Status" value={humanize(data.policy.status || data.policy.lifecycle_status)} accent />
              <Info label="Lifecycle" value={humanize(data.policy.lifecycle_status)} />
              <Info label="Issuance" value={dateLabel(data.policy.issuance_date)} />
              <Info label="Category" value={category} />
            </div>
          </Card>

          <Card title="Premium Breakup" icon={CircleDollarSign}>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <PremiumInfo icon={FileText} label="Net Premium" value={currency(data.premium.net_premium)} tone="blue" />
              <PremiumInfo icon={Car} label="OD Premium" value={currency(data.premium.od_premium)} tone="purple" />
              <PremiumInfo icon={ShieldCheck} label="TP Premium" value={currency(data.premium.tp_premium)} tone="green" />
              <PremiumInfo icon={Percent} label="GST" value={currency(data.premium.gst_amount)} tone="orange" />
              <PremiumInfo icon={CircleDollarSign} label="CPA" value={data.premium.cpa_opted ? currency(data.premium.cpa_amount) : "Not opted / not recorded"} tone="blue" />
              <PremiumInfo icon={CircleDollarSign} label="Gross Premium" value={currency(data.premium.gross_premium)} tone="red" />
            </div>
          </Card>

          <Card title={data.vehicle ? "Customer & Vehicle" : "Customer & Insured Risk"} icon={UserRound}>
            <div className="divide-y divide-[#E7EDF4]">
              {data.customer.id ? (
                <Link href={"/partner/customers/" + encodeURIComponent(data.customer.id)} className="group flex items-center gap-3 py-3.5 transition hover:bg-[#FAFCFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#176AF0]"><UserRound className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block break-words text-[10px] font-extrabold text-[#1B3152]">{data.customer.name}</span><span className="mt-0.5 block break-words text-[9px] text-[#7489A5]">{data.customer.customer_code || "Customer"}</span></span>
                  <ArrowRight className="h-4 w-4 text-[#176AF0] transition group-hover:translate-x-0.5" />
                </Link>
              ) : null}
              <div className="flex items-center gap-3 py-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#176AF0]"><Car className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block break-words text-[10px] font-extrabold text-[#1B3152]">{data.vehicle?.vehicle_no || data.policy.policy_product || data.policy.policy_type || "Insured risk"}</span><span className="mt-0.5 block break-words text-[9px] text-[#7489A5]">{data.vehicle ? display(data.vehicle.make, data.vehicle.model, data.vehicle.year, data.vehicle.vehicle_type) || "Vehicle details" : "No vehicle linked"}</span></span>
              </div>
            </div>
          </Card>

          <Card title="Business Details" icon={Building2}>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Info label="Intermediary" value={display(humanize(data.commercial.intermediary_type), data.commercial.intermediary_code) || "Not recorded"} />
              <Info label="Relationship Manager" value={data.commercial.rm_name || "Not recorded"} />
              <Info label="Group" value={display(data.commercial.group_name, data.commercial.group_code) || "Not recorded"} />
              <Info label="Policy Lifecycle" value={humanize(data.policy.lifecycle_status)} />
            </div>
          </Card>
        </div>
      </div>
    </PartnerPortalShell>
  );
}

function HeroMetric({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/15 py-3 sm:border-r sm:px-4 xl:border-b-0 xl:first:pl-0 xl:last:border-r-0 xl:last:pr-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[0.08em] text-white/65">{label}</p><p className="mt-1 break-words text-[10px] font-bold text-white">{value}</p></div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_14px_rgba(31,55,86,0.04)]">
      <div className="flex items-center gap-3 border-b border-[#E7EDF4] px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEF4FF] text-[#176AF0]"><Icon className="h-4 w-4" /></span>
        <h2 className="text-[13px] font-black text-[#142B50]">{title}</h2>
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function Info({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[8.5px] font-black tracking-[0.03em] text-[#8290A4]">{label}</p>
      <p className={"mt-1 break-words text-[10.5px] font-semibold leading-4 " + (accent ? "text-[#12A36B]" : "text-[#203653]")}>{value}</p>
    </div>
  );
}

function PremiumInfo({ icon: Icon, label, value, tone }: { icon: typeof FileText; label: string; value: string; tone: "blue" | "purple" | "green" | "orange" | "red" }) {
  const toneClass = {
    blue: "bg-[#EAF3FF] text-[#2875DD]",
    purple: "bg-[#F2E9FF] text-[#7B4DE2]",
    green: "bg-[#E8F8EF] text-[#18A56C]",
    orange: "bg-[#FFF0DE] text-[#F28A12]",
    red: "bg-[#FFE8E8] text-[#D84A4A]",
  }[tone];
  return (
    <div className="flex items-center gap-3">
      <span className={"grid h-9 w-9 shrink-0 place-items-center rounded-full " + toneClass}><Icon className="h-4 w-4" /></span>
      <div><p className="text-[8.5px] font-semibold text-[#8290A4]">{label}</p><p className="mt-1 break-words text-[10.5px] font-bold text-[#203653]">{value}</p></div>
    </div>
  );
}
