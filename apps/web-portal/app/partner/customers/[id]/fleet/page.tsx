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
        <PartnerCustomerFleetSummary data={data} />
      </div>
    </PartnerPortalShell>
  );
}
