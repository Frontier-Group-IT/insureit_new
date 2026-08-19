import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const CUSTOMER_ACTIVITY_ACTIONS = {
  CUSTOMER_CREATED: "customer_created",
  CUSTOMER_EDITED: "customer_edited",
  CUSTOMER_ADDED_TO_PARENT: "customer_added_to_parent",
  CUSTOMER_REMOVED_FROM_PARENT: "customer_removed_from_parent",
} as const;

export type CustomerActivityAction = (typeof CUSTOMER_ACTIVITY_ACTIONS)[keyof typeof CUSTOMER_ACTIVITY_ACTIONS];

export const CUSTOMER_CREATION_CHANNELS = {
  LEGACY: "legacy",
  DIRECT: "direct_customer_onboarding",
  POLICY: "policy_onboarding",
  GROUP: "group_onboarding",
  CORPORATE: "corporate_onboarding",
  DEALERSHIP: "dealership_onboarding",
  GROUP_CHILD: "group_customer_onboarding",
  CORPORATE_CHILD: "corporate_customer_onboarding",
  DEALERSHIP_CHILD: "dealership_customer_onboarding",
} as const;

export type CustomerCreationChannel = (typeof CUSTOMER_CREATION_CHANNELS)[keyof typeof CUSTOMER_CREATION_CHANNELS];

export const CUSTOMER_ACTIVITY_CHANNELS = {
  CUSTOMER_PROFILE: "customer_profile",
  CORPORATE_PROFILE: "corporate_profile",
  DEALERSHIP_PROFILE: "dealership_profile",
  GROUP_PROFILE: "group_profile",
  CUSTOMER_RELATIONSHIPS: "customer_relationships",
} as const;

export type CustomerActivityChannel = (typeof CUSTOMER_ACTIVITY_CHANNELS)[keyof typeof CUSTOMER_ACTIVITY_CHANNELS];

const ACTION_LABELS: Record<CustomerActivityAction, string> = {
  customer_created: "Customer Created",
  customer_edited: "Customer Edited",
  customer_added_to_parent: "Customer Added to Parent",
  customer_removed_from_parent: "Customer Removed from Parent",
};

const CHANNEL_LABELS: Record<CustomerCreationChannel, string> = {
  legacy: "Legacy / Not recorded",
  direct_customer_onboarding: "Direct Customer Onboarding",
  policy_onboarding: "Policy Onboarding",
  group_onboarding: "Group Onboarding",
  corporate_onboarding: "Corporate Onboarding",
  dealership_onboarding: "Dealership Onboarding",
  group_customer_onboarding: "Group Customer Onboarding",
  corporate_customer_onboarding: "Corporate Customer Onboarding",
  dealership_customer_onboarding: "Dealership Customer Onboarding",
};

const ACTIVITY_CHANNEL_LABELS: Record<CustomerActivityChannel, string> = {
  customer_profile: "Customer Profile",
  corporate_profile: "Corporate Profile",
  dealership_profile: "Dealership Profile",
  group_profile: "Group Profile",
  customer_relationships: "Customer Relationships",
};

const TRACKED_ACTIONS = Object.values(CUSTOMER_ACTIVITY_ACTIONS);
const CUSTOMER_CREATED_ACTOR_CORRECTION_ACTION = "customer_created_actor_corrected";
const ACTIVITY_QUERY_ACTIONS = [...TRACKED_ACTIONS, CUSTOMER_CREATED_ACTOR_CORRECTION_ACTION];
const ACTIVITY_TABLE_NAME = "customers";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type AuditRow = { id: string; actor_id: string | null; action: string; new_data: Record<string, unknown> | null; created_at: string };
type ProfileRow = { id: string; full_name: string | null };
type CustomerNameRow = { id: string; contact_name: string; company_name: string | null };

type ActivityCandidate = {
  id: string;
  action: CustomerActivityAction;
  actorId: string | null;
  actorName?: string | null;
  at: string;
  viaLabel?: string | null;
  originCustomerId?: string | null;
};

export type CustomerActivityDisplay = {
  id: string;
  action: string;
  actorName: string;
  via: string | null;
  under: string | null;
  at: string;
};

function asTrackedAction(value: string): CustomerActivityAction | null {
  return TRACKED_ACTIONS.includes(value as CustomerActivityAction) ? value as CustomerActivityAction : null;
}

export function asCreationChannel(value: unknown): CustomerCreationChannel {
  return Object.values(CUSTOMER_CREATION_CHANNELS).includes(value as CustomerCreationChannel)
    ? value as CustomerCreationChannel
    : CUSTOMER_CREATION_CHANNELS.LEGACY;
}

export function customerCreationChannelLabel(value: unknown) {
  return CHANNEL_LABELS[asCreationChannel(value)];
}

function asActivityChannel(value: unknown): CustomerActivityChannel | null {
  return Object.values(CUSTOMER_ACTIVITY_CHANNELS).includes(value as CustomerActivityChannel)
    ? value as CustomerActivityChannel
    : null;
}

function activityChannelForPartnerType(value: string | null | undefined): CustomerActivityChannel {
  if (value === "corporate") return CUSTOMER_ACTIVITY_CHANNELS.CORPORATE_PROFILE;
  if (value === "dealership") return CUSTOMER_ACTIVITY_CHANNELS.DEALERSHIP_PROFILE;
  if (value === "group") return CUSTOMER_ACTIVITY_CHANNELS.GROUP_PROFILE;
  return CUSTOMER_ACTIVITY_CHANNELS.CUSTOMER_PROFILE;
}

function timestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function metadataValue(data: Record<string, unknown> | null, key: string) {
  const value = data?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function recordCustomerActivity(
  admin: AdminClient,
  customerId: string,
  actorId: string | null,
  action: CustomerActivityAction,
  metadata?: {
    creationChannel?: CustomerCreationChannel | null;
    originCustomerId?: string | null;
    activityChannel?: CustomerActivityChannel | null;
  },
) {
  const newData: Record<string, string> = {};
  if (metadata?.creationChannel) newData.creation_channel = metadata.creationChannel;
  if (metadata?.originCustomerId) newData.origin_customer_id = metadata.originCustomerId;
  if (metadata?.activityChannel) newData.activity_channel = metadata.activityChannel;

  const { error } = await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    table_name: ACTIVITY_TABLE_NAME,
    record_id: customerId,
    new_data: Object.keys(newData).length ? newData : null,
  });
  return !error;
}

export async function loadCustomerActivityHistory({
  customerId,
  createdById,
  createdByName,
  createdAt,
  creationChannel,
  originCustomerId,
  partnerType,
}: {
  customerId: string;
  createdById: string | null;
  createdByName?: string | null;
  createdAt: string | null;
  creationChannel: string | null;
  originCustomerId: string | null;
  partnerType?: string | null;
}): Promise<CustomerActivityDisplay[]> {
  const admin = createSupabaseAdminClient();
  const { data: auditRows } = await admin
    .from("audit_logs")
    .select("id,actor_id,action,new_data,created_at")
    .eq("table_name", ACTIVITY_TABLE_NAME)
    .eq("record_id", customerId)
    .in("action", ACTIVITY_QUERY_ACTIONS)
    .order("created_at", { ascending: false })
    .returns<AuditRow[]>();

  const correctedCreatedAuditIds = new Set<string>();
  for (const row of auditRows ?? []) {
    if (row.action !== CUSTOMER_CREATED_ACTOR_CORRECTION_ACTION) continue;
    const correctedAuditId = metadataValue(row.new_data, "customer_created_audit_id");
    if (correctedAuditId) correctedCreatedAuditIds.add(correctedAuditId);
  }

  const candidates: ActivityCandidate[] = [];
  let hasCreatedAudit = false;

  for (const row of auditRows ?? []) {
    const action = asTrackedAction(row.action);
    if (!action) continue;
    if (action === CUSTOMER_ACTIVITY_ACTIONS.CUSTOMER_CREATED) hasCreatedAudit = true;
    const useOriginalCreator = action === CUSTOMER_ACTIVITY_ACTIONS.CUSTOMER_CREATED && correctedCreatedAuditIds.has(row.id);

    let viaLabel: string | null = null;
    if (action === CUSTOMER_ACTIVITY_ACTIONS.CUSTOMER_CREATED) {
      viaLabel = CHANNEL_LABELS[asCreationChannel(metadataValue(row.new_data, "creation_channel") ?? creationChannel)];
    } else {
      const explicitChannel = asActivityChannel(metadataValue(row.new_data, "activity_channel"));
      if (explicitChannel) {
        viaLabel = ACTIVITY_CHANNEL_LABELS[explicitChannel];
      } else if (action === CUSTOMER_ACTIVITY_ACTIONS.CUSTOMER_EDITED) {
        const inferredChannel = activityChannelForPartnerType(metadataValue(row.new_data, "partner_type") ?? partnerType);
        viaLabel = ACTIVITY_CHANNEL_LABELS[inferredChannel];
      } else if (
        action === CUSTOMER_ACTIVITY_ACTIONS.CUSTOMER_ADDED_TO_PARENT
        || action === CUSTOMER_ACTIVITY_ACTIONS.CUSTOMER_REMOVED_FROM_PARENT
      ) {
        viaLabel = ACTIVITY_CHANNEL_LABELS[CUSTOMER_ACTIVITY_CHANNELS.CUSTOMER_RELATIONSHIPS];
      }
    }

    candidates.push({
      id: `audit:${row.id}`,
      action,
      actorId: useOriginalCreator ? createdById : row.actor_id,
      actorName: useOriginalCreator ? createdByName : undefined,
      at: row.created_at,
      viaLabel,
      originCustomerId: metadataValue(row.new_data, "origin_customer_id")
        ?? (action === CUSTOMER_ACTIVITY_ACTIONS.CUSTOMER_CREATED ? originCustomerId : null),
    });
  }

  if (createdAt && !hasCreatedAudit) {
    candidates.push({
      id: "derived:customer-created",
      action: CUSTOMER_ACTIVITY_ACTIONS.CUSTOMER_CREATED,
      actorId: createdById,
      actorName: createdByName,
      at: createdAt,
      viaLabel: CHANNEL_LABELS[asCreationChannel(creationChannel)],
      originCustomerId,
    });
  }

  const actorIds = Array.from(new Set(candidates.map((candidate) => candidate.actorId).filter((id): id is string => Boolean(id))));
  const originIds = Array.from(new Set(candidates.map((candidate) => candidate.originCustomerId).filter((id): id is string => Boolean(id))));
  const [profilesResult, originsResult] = await Promise.all([
    actorIds.length
      ? admin.from("profiles").select("id,full_name").in("id", actorIds).returns<ProfileRow[]>()
      : Promise.resolve({ data: [] as ProfileRow[] }),
    originIds.length
      ? admin.from("customers").select("id,contact_name,company_name").in("id", originIds).returns<CustomerNameRow[]>()
      : Promise.resolve({ data: [] as CustomerNameRow[] }),
  ]);

  const actorNames = new Map<string, string>();
  for (const profile of profilesResult.data ?? []) {
    const name = profile.full_name?.trim();
    if (name) actorNames.set(profile.id, name);
  }

  const originNames = new Map<string, string>();
  for (const origin of originsResult.data ?? []) {
    originNames.set(origin.id, origin.company_name?.trim() || origin.contact_name.trim());
  }

  return candidates
    .filter((candidate) => timestamp(candidate.at) > 0)
    .sort((a, b) => timestamp(b.at) - timestamp(a.at))
    .map((candidate) => ({
      id: candidate.id,
      action: ACTION_LABELS[candidate.action],
      actorName: candidate.actorName?.trim() || (candidate.actorId ? actorNames.get(candidate.actorId) : null) || "Not recorded",
      via: candidate.viaLabel ?? null,
      under: candidate.originCustomerId ? originNames.get(candidate.originCustomerId) ?? "Parent customer" : null,
      at: candidate.at,
    }));
}
