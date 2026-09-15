import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebCustomerDetail } from "@/lib/partner-web";
import { PartnerCustomerFleetSummary } from "../partner-customer-fleet-summary";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PartnerCustomerFleetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPartnerWebCustomerDetail(id);

  return (
    <PartnerPortalShell title="Fleet Summary">
      <div className="space-y-3 pb-5">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/partner/customers/${encodeURIComponent(id)}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-white px-3 text-[10.5px] font-semibold text-[#334155] transition hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Customer Details
          </Link>
        </div>

        <PartnerCustomerFleetSummary data={data} />
      </div>
    </PartnerPortalShell>
  );
}
