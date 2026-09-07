import Link from "next/link";
import { ArrowLeft, BarChart3, CheckCircle2, IndianRupee, MessageSquareText, PhoneCall } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerMetricStrip, PartnerPageHeader, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
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

  return (
    <PartnerPortalShell title="External Renewal Reporting">
      <div className="space-y-7">
        <PartnerPageHeader
          eyebrow="External Renewal Reporting"
          title="Retargeting performance"
          description="Track the external renewal funnel without mixing opportunities into verified INSUREIT business."
          action={
            <Link href="/partner/renewals/external" prefetch={false} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#D2DCE9] px-3.5 text-[10px] font-bold text-[#203653] transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Opportunities
            </Link>
          }
        />

        <PartnerMetricStrip
          items={[
            { label: "Opportunities", value: reporting.total_opportunities, meta: "Published and active" },
            { label: "Contacted", value: reporting.contacted_count, meta: "At least one CRM interaction" },
            { label: "Connected", value: reporting.connected_count, meta: "Customer conversation reached" },
            { label: "Quote Shared", value: reporting.quote_shared_count, meta: "Quote sent to customer" },
          ]}
        />

        <PartnerMetricStrip
          items={[
            { label: "Converted", value: reporting.converted_count, meta: "Issued through INSUREIT" },
            { label: "Conversion Rate", value: reporting.conversion_rate_pct + "%", meta: "Converted ÷ opportunities" },
            { label: "Premium Generated", value: currency(reporting.premium_generated), meta: "Verified converted policies only" },
            { label: "Closed Without Conversion", value: reporting.closed_without_conversion_count, meta: "Renewed elsewhere or lost" },
          ]}
        />

        <section>
          <PartnerSectionHeading eyebrow="Funnel" title="How the numbers are counted" />
          <div className="mt-3 grid gap-3 border-y border-[#DCE4ED] py-4 sm:grid-cols-2 xl:grid-cols-4">
            <FunnelItem icon={PhoneCall} title="Contacted" description="Counts an opportunity once it has any recorded CRM interaction." />
            <FunnelItem icon={MessageSquareText} title="Connected" description="Counts opportunities that reached a connected, interested, quote or follow-up outcome." />
            <FunnelItem icon={CheckCircle2} title="Converted" description="Counts only opportunities linked to a Policy Intake that produced a real final policy." />
            <FunnelItem icon={IndianRupee} title="Premium" description="Uses premium from the verified converted INSUREIT policy, never from the external source record." />
          </div>
        </section>

        <div className="flex items-start gap-3 rounded-lg border border-[#DCE4ED] bg-[#F8FAFD] px-3.5 py-3 text-[#5E7089]">
          <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-[#3156B8]" />
          <p className="text-[9.5px] leading-5">Funnel stages use interaction history, so an opportunity that later converts still remains counted in the earlier Contacted, Connected and Quote Shared stages.</p>
        </div>
      </div>
    </PartnerPortalShell>
  );
}

function FunnelItem({ icon: Icon, title, description }: { icon: typeof BarChart3; title: string; description: string }) {
  return (
    <div className="px-1 sm:px-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#3156B8]" />
        <p className="text-[10.5px] font-extrabold text-[#263D5E]">{title}</p>
      </div>
      <p className="mt-1.5 text-[9.5px] leading-5 text-[#728198]">{description}</p>
    </div>
  );
}
