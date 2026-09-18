import { StandardActivityStatusCard } from "@/components/standard-activity-status-card";
import { loadPolicyActivityHistory } from "@/lib/policy-activity";

type PolicyActivityStatusProps = {
  policyId: string;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export async function PolicyActivityStatus({ policyId, createdBy, createdAt, updatedAt }: PolicyActivityStatusProps) {
  const activities = await loadPolicyActivityHistory({ policyId, createdBy, createdAt, updatedAt });

  return (
    <StandardActivityStatusCard
      items={activities.map((activity) => ({
        id: activity.id,
        title: activity.action,
        meta: activity.actorName ? `Created By: ${activity.actorName}` : null,
        at: activity.at,
      }))}
      emptyText="Activity not recorded"
    />
  );
}
