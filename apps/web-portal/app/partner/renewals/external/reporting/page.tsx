import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  CircleX,
  FileText,
  IndianRupee,
  MessageCircle,
  MessageSquareText,
  Percent,
  PhoneCall,
  Target,
  Users,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerExternalRenewalReporting } from "@/lib/partner-external-renewal-reporting";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function currency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export default async function PartnerExternalRenewalReportingPage() {
  const reporting = await getPartnerExternalRenewalReporting();

  const metrics = [
    {
      label: "Opportunities",
      value: reporting.total_opportunities,
      meta: "Published and active",
      icon: FileText,
      iconClassName: "bg-[#EAF3FF] text-[#2F72DE]",
    },
    {
      label: "Contacted",
      value: reporting.contacted_count,
      meta: "At least one CRM interaction",
      icon: Users,
      iconClassName: "bg-[#F0E9FF] text-[#7B4CE8]",
    },
    {
      label: "Connected",
      value: reporting.connected_count,
      meta: "Customer conversation reached",
      icon: MessageCircle,
      iconClassName: "bg-[#FFF0E5] text-[#F07A20]",
    },
    {
      label: "Quote Shared",
      value: reporting.quote_shared_count,
      meta: "Quote sent to customer",
      icon: FileText,
      iconClassName: "bg-[#E8FAF3] text-[#19A96B]",
    },
    {
      label: "Converted",
      value: reporting.converted_count,
      meta: "Issued through INSUREIT",
      icon: Target,
      iconClassName: "bg-[#FFEDEE] text-[#F04E54]",
    },
    {
      label: "Conversion Rate",
      value: reporting.conversion_rate_pct + "%",
      meta: "Converted ÷ opportunities",
      icon: Percent,
      iconClassName: "bg-[#EAF3FF] text-[#2F72DE]",
    },
    {
      label: "Premium Generated",
      value: currency(reporting.premium_generated),
      meta: "Verified converted policies only",
      icon: IndianRupee,
      iconClassName: "bg-[#E8FAF3] text-[#119B61]",
    },
    {
      label: "Closed Without Conversion",
      value: reporting.closed_without_conversion_count,
      meta: "Renewed elsewhere or lost",
      icon: CircleX,
      iconClassName: "bg-[#F3E9FF] text-[#8A45EC]",
    },
  ];

  return (
    <PartnerPortalShell title="External Renewal Reporting">
      <div className="space-y-5 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[8.5px] font-black uppercase tracking-[0.12em] text-[#6F83A0]">External Renewal Reporting</p>
            <h1 className="mt-1 text-[25px] font-black tracking-[-0.035em] text-[#14294D]">Retargeting performance</h1>
            <p className="mt-1.5 text-[10px] font-medium text-[#7A8BA3]">Track the external renewal funnel without mixing opportunities into verified INSUREIT business.</p>
          </div>
          <Link
            href="/partner/renewals/external"
            prefetch={false}
            className="inline-flex min-h-9 items-center gap-2 self-start rounded-lg border border-[#D2DCE9] bg-white px-3.5 text-[10px] font-bold text-[#203653] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 sm:self-auto"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Opportunities
          </Link>
        </div>

        <section className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_5px_18px_rgba(31,55,86,0.05)]">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={
                    "flex min-h-[112px] items-center gap-4 px-5 py-4 " +
                    (index % 4 ? "border-l border-[#E3EAF2]" : "") +
                    (index >= 4 ? " border-t border-[#E3EAF2]" : "")
                  }
                >
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${item.iconClassName}`}>
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase tracking-[0.07em] text-[#6C82A1]">{item.label}</p>
                    <p className="mt-1 text-[21px] font-black leading-none tracking-[-0.03em] text-[#14294D]">{item.value}</p>
                    <p className="mt-2 text-[9px] font-medium leading-4 text-[#7C8CA3]">{item.meta}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-[#DDE6F0] bg-white px-5 py-4 shadow-[0_5px_18px_rgba(31,55,86,0.05)]">
          <div className="border-b border-[#E5EBF2] pb-3">
            <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[#6F83A0]">Funnel</p>
            <h2 className="mt-1 text-[15px] font-black tracking-[-0.02em] text-[#14294D]">How the numbers are counted</h2>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            <FunnelItem icon={PhoneCall} title="Contacted" description="Counts an opportunity once it has any recorded CRM interaction." />
            <FunnelItem icon={MessageSquareText} title="Connected" description="Counts opportunities that reached a connected, interested, quote or follow-up outcome." />
            <FunnelItem icon={CheckCircle2} title="Converted" description="Counts only opportunities linked to a Policy Intake that produced a real final policy." />
            <FunnelItem icon={IndianRupee} title="Premium" description="Uses premium from the verified converted INSUREIT policy, never from the external source record." />
          </div>
        </section>

        <div className="flex items-start gap-3 rounded-lg border border-[#D8E6F7] bg-[#F8FBFF] px-4 py-3 text-[#5E7089] shadow-[0_3px_10px_rgba(31,55,86,0.025)]">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#EAF3FF] text-[#2F72DE]">
            <BarChart3 className="h-4 w-4" />
          </span>
          <p className="pt-1 text-[9.5px] leading-5">Funnel stages use interaction history, so an opportunity that later converts still remains counted in the earlier Contacted, Connected and Quote Shared stages.</p>
        </div>
      </div>
    </PartnerPortalShell>
  );
}

function FunnelItem({ icon: Icon, title, description }: { icon: typeof BarChart3; title: string; description: string }) {
  return (
    <div className="min-h-[108px] px-3 py-4 first:pl-0 xl:border-l xl:border-[#E6ECF3] xl:first:border-l-0 xl:first:pl-0">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EEF4FF] text-[#2F72DE]">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[10.5px] font-extrabold text-[#263D5E]">{title}</p>
      </div>
      <p className="mt-2 pl-[42px] text-[9.5px] leading-5 text-[#728198]">{description}</p>
    </div>
  );
}
