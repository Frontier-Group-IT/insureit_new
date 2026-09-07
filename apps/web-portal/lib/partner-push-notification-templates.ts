export const PARTNER_PUSH_EVENT_TYPES = [
  "renewal_due",
  "claim_update",
  "intake_attention",
  "intake_approved",
  "intake_rejected",
] as const;

export type PartnerPushEventType = (typeof PARTNER_PUSH_EVENT_TYPES)[number];

export type PartnerPushNotification = {
  title: string;
  body: string;
  data: { url: string; event_type: PartnerPushEventType };
  channelId: "partner-updates";
};

const TEMPLATES: Record<PartnerPushEventType, Omit<PartnerPushNotification, "data"> & { url: string }> = {
  renewal_due: {
    title: "Renewal opportunity",
    body: "A renewal in your Partner scope needs attention.",
    url: "/renewals",
    channelId: "partner-updates",
  },
  claim_update: {
    title: "Claim update",
    body: "A claim in your Partner scope has a new update.",
    url: "/(tabs)/claims",
    channelId: "partner-updates",
  },
  intake_attention: {
    title: "Policy Intake needs attention",
    body: "A Policy Intake in your Partner scope needs review.",
    url: "/policy-intakes",
    channelId: "partner-updates",
  },
  intake_approved: {
    title: "Policy Intake updated",
    body: "A Policy Intake in your Partner scope has been completed.",
    url: "/policy-intakes",
    channelId: "partner-updates",
  },
  intake_rejected: {
    title: "Policy Intake needs review",
    body: "A Policy Intake in your Partner scope requires follow-up.",
    url: "/policy-intakes",
    channelId: "partner-updates",
  },
};

export function buildPartnerPushNotification(eventType: PartnerPushEventType): PartnerPushNotification {
  const template = TEMPLATES[eventType];
  if (!template) throw new Error("Unsupported Partner push event type.");

  return {
    title: template.title,
    body: template.body,
    channelId: template.channelId,
    data: {
      url: template.url,
      event_type: eventType,
    },
  };
}

export function isPartnerPushEventType(value: unknown): value is PartnerPushEventType {
  return typeof value === "string" && (PARTNER_PUSH_EVENT_TYPES as readonly string[]).includes(value);
}
