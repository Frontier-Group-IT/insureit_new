import "server-only";

import type { PartnerPushEventType } from "@/lib/partner-push-notification-templates";

export const PARTNER_PUSH_PROJECT_ID = "8ade82c1-4c96-4f09-b90b-802270fb406d";
export const PARTNER_PUSH_APP_VERSION = "0.2.0";

export type PartnerPushActor =
  | { actor_kind: "employee"; actor_id: string; intermediary_id: null }
  | { actor_kind: "intermediary"; actor_id: string; intermediary_id: string };

export type PartnerPushDeviceEndpoint = PartnerPushActor & {
  expo_push_token: string;
  platform: "android" | "ios";
  eas_project_id: string;
  app_version: string;
  active: boolean;
};

export type PartnerPushRecipient = Pick<PartnerPushDeviceEndpoint, "expo_push_token" | "platform">;

export type PartnerPushRecipientResolverDependencies = {
  /**
   * Must use the canonical policy / renewal Partner authorization relationship:
   * policy RM + intermediary + permanent Intermediary Group, with employee access
   * evaluated from current partner_app_commercial_scope() semantics.
   */
  resolveRenewalActors(recordId: string): Promise<PartnerPushActor[]>;
  /**
   * Must derive claim authorization from the claim's current customer relationship,
   * including customers.lead_source_intermediary_id, then evaluate current Partner scope.
   */
  resolveClaimActors(recordId: string): Promise<PartnerPushActor[]>;
  /**
   * Policy Intake is intentionally narrower than Partner-family scope. This dependency
   * must return only the exact current submitter/owner authorized by the intake contract.
   */
  resolvePolicyIntakeSubmitter(recordId: string): Promise<PartnerPushActor | null>;
  /** Called only after business authorization has produced a non-empty actor set. */
  loadActiveDevicesForActors(actors: PartnerPushActor[]): Promise<PartnerPushDeviceEndpoint[]>;
};

const INTAKE_EVENTS = new Set<PartnerPushEventType>([
  "intake_attention",
  "intake_approved",
  "intake_rejected",
]);

export async function resolvePartnerPushRecipients(
  eventType: PartnerPushEventType,
  recordId: string,
  dependencies: PartnerPushRecipientResolverDependencies,
): Promise<PartnerPushRecipient[]> {
  if (!isUuid(recordId)) return [];

  let authorizedActors: PartnerPushActor[];
  try {
    if (eventType === "renewal_due") {
      authorizedActors = await dependencies.resolveRenewalActors(recordId);
    } else if (eventType === "claim_update") {
      authorizedActors = await dependencies.resolveClaimActors(recordId);
    } else if (INTAKE_EVENTS.has(eventType)) {
      const submitter = await dependencies.resolvePolicyIntakeSubmitter(recordId);
      authorizedActors = submitter ? [submitter] : [];
    } else {
      return [];
    }
  } catch {
    return [];
  }

  const actors = uniqueValidActors(authorizedActors);
  if (actors.length === 0) return [];

  let devices: PartnerPushDeviceEndpoint[];
  try {
    devices = await dependencies.loadActiveDevicesForActors(actors);
  } catch {
    return [];
  }

  const authorizedActorKeys = new Set(actors.map(actorKey));
  const seenTokens = new Set<string>();
  const recipients: PartnerPushRecipient[] = [];

  for (const device of devices) {
    if (!device.active) continue;
    if (!authorizedActorKeys.has(actorKey(device))) continue;
    if (device.eas_project_id !== PARTNER_PUSH_PROJECT_ID) continue;
    if (device.app_version !== PARTNER_PUSH_APP_VERSION) continue;
    if (device.platform !== "android" && device.platform !== "ios") continue;
    if (!isExpoPushToken(device.expo_push_token)) continue;
    if (seenTokens.has(device.expo_push_token)) continue;

    seenTokens.add(device.expo_push_token);
    recipients.push({ expo_push_token: device.expo_push_token, platform: device.platform });
  }

  return recipients;
}

function uniqueValidActors(actors: PartnerPushActor[]) {
  const result: PartnerPushActor[] = [];
  const seen = new Set<string>();

  for (const actor of actors) {
    if (!isUuid(actor.actor_id)) continue;
    if (actor.actor_kind === "employee") {
      if (actor.intermediary_id !== null) continue;
    } else {
      if (!isUuid(actor.intermediary_id)) continue;
    }

    const key = actorKey(actor);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(actor);
  }

  return result;
}

function actorKey(actor: PartnerPushActor) {
  return actor.actor_kind === "employee"
    ? `employee:${actor.actor_id}`
    : `intermediary:${actor.actor_id}:${actor.intermediary_id}`;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isExpoPushToken(value: unknown): value is string {
  return typeof value === "string"
    && /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(value)
    && value.length <= 512;
}
