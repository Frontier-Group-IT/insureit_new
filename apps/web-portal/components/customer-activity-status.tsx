import { StandardActivityStatusCard } from "@/components/standard-activity-status-card";
import { loadCustomerActivityHistory } from "@/lib/customer-activity";

type CustomerActivityStatusProps = {
  customerId: string;
  createdById: string | null;
  createdByName?: string | null;
  createdAt: string | null;
  creationChannel: string | null;
  originCustomerId: string | null;
};

export async function CustomerActivityStatus(props: CustomerActivityStatusProps) {
  const activities = await loadCustomerActivityHistory(props);

  return (
    <StandardActivityStatusCard
      items={activities.map((activity) => ({
        id: activity.id,
        title: activity.action,
        meta: [
          activity.actorName ? `Created By: ${activity.actorName}` : null,
          activity.via ? `Via: ${activity.via}` : null,
          activity.under ? `Under: ${activity.under}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        at: activity.at,
      }))}
      emptyText="Activity not recorded"
    />
  );
}
