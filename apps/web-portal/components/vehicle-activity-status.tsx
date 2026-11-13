import { StandardActivityStatusCard } from "@/components/standard-activity-status-card";
import { loadVehicleActivityHistory } from "@/lib/vehicle-activity";

type VehicleActivityStatusProps = {
  vehicleId: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export async function VehicleActivityStatus({ vehicleId, createdAt, updatedAt }: VehicleActivityStatusProps) {
  const activities = await loadVehicleActivityHistory({ vehicleId, createdAt, updatedAt });

  return (
    <StandardActivityStatusCard
      items={activities.map((activity) => ({
        id: activity.id,
        title: activity.action,
        changes: activity.changes,
        meta: activity.actorName && activity.actorName !== "Not recorded" ? `By: ${activity.actorName}` : null,
        at: activity.at,
      }))}
      emptyText="Activity not recorded"
    />
  );
}
