import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const VEHICLE_ACTIVITY_ACTIONS = {
  VEHICLE_CREATED: "vehicle_created",
  VEHICLE_EDITED: "vehicle_edited",
  VEHICLE_LINKED_TO_POLICY: "vehicle_linked_to_policy",
} as const;

export type VehicleActivityAction = (typeof VEHICLE_ACTIVITY_ACTIONS)[keyof typeof VEHICLE_ACTIVITY_ACTIONS];

const ACTION_LABELS: Record<VehicleActivityAction, string> = {
  vehicle_created: "Vehicle Created",
  vehicle_edited: "Vehicle Edited",
  vehicle_linked_to_policy: "Vehicle Linked to Policy",
};

const TRACKED_ACTIONS = Object.values(VEHICLE_ACTIVITY_ACTIONS);
const ACTIVITY_TABLE_NAME = "vehicles";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type AuditRow = { id: string; actor_id: string | null; action: string; created_at: string };
type ProfileRow = { id: string; full_name: string | null };

type ActivityCandidate = {
  id: string;
  action: VehicleActivityAction;
  actorId: string | null;
  at: string;
};

export type VehicleActivityDisplay = {
  id: string;
  action: string;
  actorName: string;
  at: string;
};

function asTrackedAction(value: string): VehicleActivityAction | null {
  return TRACKED_ACTIONS.includes(value as VehicleActivityAction) ? value as VehicleActivityAction : null;
}

function timestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function materiallyLater(updatedAt: string | null | undefined, createdAt: string | null | undefined) {
  return timestamp(updatedAt) - timestamp(createdAt) > 1000;
}

export async function recordVehicleActivity(
  admin: AdminClient,
  vehicleId: string,
  actorId: string | null,
  action: VehicleActivityAction,
) {
  const { error } = await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    table_name: ACTIVITY_TABLE_NAME,
    record_id: vehicleId,
  });
  return !error;
}

export async function loadVehicleActivityHistory({
  vehicleId,
  createdAt,
  updatedAt,
}: {
  vehicleId: string;
  createdAt: string | null;
  updatedAt: string | null;
}): Promise<VehicleActivityDisplay[]> {
  const admin = createSupabaseAdminClient();
  const { data: auditRows } = await admin
    .from("audit_logs")
    .select("id,actor_id,action,created_at")
    .eq("table_name", ACTIVITY_TABLE_NAME)
    .eq("record_id", vehicleId)
    .in("action", TRACKED_ACTIONS)
    .order("created_at", { ascending: false })
    .returns<AuditRow[]>();

  const candidates: ActivityCandidate[] = [];
  const auditActions = new Set<VehicleActivityAction>();

  for (const row of auditRows ?? []) {
    const action = asTrackedAction(row.action);
    if (!action) continue;
    auditActions.add(action);
    candidates.push({
      id: `audit:${row.id}`,
      action,
      actorId: row.actor_id,
      at: row.created_at,
    });
  }

  if (createdAt && !auditActions.has(VEHICLE_ACTIVITY_ACTIONS.VEHICLE_CREATED)) {
    candidates.push({
      id: "derived:vehicle-created",
      action: VEHICLE_ACTIVITY_ACTIONS.VEHICLE_CREATED,
      actorId: null,
      at: createdAt,
    });
  }

  if (
    updatedAt
    && materiallyLater(updatedAt, createdAt)
    && !auditActions.has(VEHICLE_ACTIVITY_ACTIONS.VEHICLE_EDITED)
  ) {
    candidates.push({
      id: "derived:legacy-vehicle-edited",
      action: VEHICLE_ACTIVITY_ACTIONS.VEHICLE_EDITED,
      actorId: null,
      at: updatedAt,
    });
  }

  const actorIds = Array.from(new Set(candidates.map((candidate) => candidate.actorId).filter((id): id is string => Boolean(id))));
  const actorNames = new Map<string, string>();

  if (actorIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id,full_name")
      .in("id", actorIds)
      .returns<ProfileRow[]>();

    for (const profile of profiles ?? []) {
      const name = profile.full_name?.trim();
      if (name) actorNames.set(profile.id, name);
    }
  }

  return candidates
    .filter((candidate) => timestamp(candidate.at) > 0)
    .sort((a, b) => timestamp(b.at) - timestamp(a.at))
    .map((candidate) => ({
      id: candidate.id,
      action: ACTION_LABELS[candidate.action],
      actorName: candidate.actorId ? actorNames.get(candidate.actorId) ?? "Not recorded" : "Not recorded",
      at: candidate.at,
    }));
}
