import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebActivity, getPartnerWebClaimDetail } from "@/lib/partner-web";
import { ActivityTimelineClient } from "./activity-timeline-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PartnerActivityPage() {
  const data = await getPartnerWebActivity(40);

  const items = await Promise.all(
    data.items.map(async (item) => {
      if (item.kind !== "claim") return item;
      try {
        const detail = await getPartnerWebClaimDetail(item.entity_id);
        return { ...item, insurer_name: detail.insurer.name };
      } catch {
        return { ...item, insurer_name: null };
      }
    }),
  );

  const activityData = { ...data, items };

  return (
    <PartnerPortalShell title="Activity">
      <div className="space-y-7">
        <ActivityTimelineClient data={activityData} />
      </div>
    </PartnerPortalShell>
  );
}
