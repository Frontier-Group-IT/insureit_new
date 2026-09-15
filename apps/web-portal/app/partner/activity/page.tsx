import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebActivity } from "@/lib/partner-web";
import { ActivityTimelineClient } from "./activity-timeline-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PartnerActivityPage() {
  const data = await getPartnerWebActivity(40);

  return (
    <PartnerPortalShell title="Activity">
      <div className="space-y-7">
        <ActivityTimelineClient data={data} />
      </div>
    </PartnerPortalShell>
  );
}
