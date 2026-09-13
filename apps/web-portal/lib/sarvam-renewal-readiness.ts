import "server-only";

export type SarvamRenewalReadiness = {
  callingEnabled: boolean;
  requiredConfigured: boolean;
  optionalAppConfigured: boolean;
  webhookUrl: string;
  items: Array<{
    key: string;
    label: string;
    configured: boolean;
    required: boolean;
    safeHint: string | null;
  }>;
};

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

function safeIdentifierHint(name: string) {
  const value = process.env[name]?.trim();
  if (!value) return null;
  if (value.length <= 6) return "configured";
  return `…${value.slice(-6)}`;
}

export function getSarvamRenewalReadiness(): SarvamRenewalReadiness {
  const portalOrigin = (process.env.NEXT_PUBLIC_PORTAL_URL?.trim() || "https://portal.insureit.in").replace(/\/$/, "");
  const items = [
    { key: "api_key", label: "API subscription key", configured: configured("SARVAM_API_KEY"), required: true, safeHint: null },
    { key: "org_id", label: "Sarvam organization", configured: configured("SARVAM_ORG_ID"), required: true, safeHint: safeIdentifierHint("SARVAM_ORG_ID") },
    { key: "workspace_id", label: "Sarvam workspace", configured: configured("SARVAM_WORKSPACE_ID"), required: true, safeHint: safeIdentifierHint("SARVAM_WORKSPACE_ID") },
    { key: "campaign_id", label: "Approved renewal campaign", configured: configured("SARVAM_RENEWAL_CAMPAIGN_ID"), required: true, safeHint: safeIdentifierHint("SARVAM_RENEWAL_CAMPAIGN_ID") },
    { key: "app_id", label: "Expected agent / app binding", configured: configured("SARVAM_RENEWAL_APP_ID"), required: false, safeHint: safeIdentifierHint("SARVAM_RENEWAL_APP_ID") },
    { key: "webhook_secret", label: "INSUREIT webhook secret", configured: configured("SARVAM_RENEWAL_WEBHOOK_SECRET"), required: true, safeHint: null },
  ];

  return {
    callingEnabled: process.env.SARVAM_RENEWAL_CALLING_ENABLED?.trim().toLowerCase() === "true",
    requiredConfigured: items.filter((item) => item.required).every((item) => item.configured),
    optionalAppConfigured: configured("SARVAM_RENEWAL_APP_ID"),
    webhookUrl: `${portalOrigin}/api/integrations/sarvam/voice-campaign-webhook`,
    items,
  };
}
