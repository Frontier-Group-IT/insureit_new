import "server-only";

const SARVAM_BASE_URL = "https://apps.sarvam.ai";
const CONNECTION_TIMEOUT_MS = 10_000;

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

export type SarvamRenewalConnectionCheck = {
  ok: boolean;
  status: number | null;
  message: string;
};

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
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

export async function checkSarvamRenewalConnection(): Promise<SarvamRenewalConnectionCheck> {
  let apiKey: string;
  let orgId: string;
  let workspaceId: string;
  let campaignId: string;

  try {
    apiKey = requiredEnv("SARVAM_API_KEY");
    orgId = requiredEnv("SARVAM_ORG_ID");
    workspaceId = requiredEnv("SARVAM_WORKSPACE_ID");
    campaignId = requiredEnv("SARVAM_RENEWAL_CAMPAIGN_ID");
  } catch {
    return {
      ok: false,
      status: null,
      message: "Required Sarvam server configuration is incomplete.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);

  try {
    const url = `${SARVAM_BASE_URL}/api/scheduling/v1/orgs/${encodeURIComponent(orgId)}/workspaces/${encodeURIComponent(workspaceId)}/campaigns/${encodeURIComponent(campaignId)}/cohorts/stream`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        name: "insureit-readiness-validation",
        users: [],
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    // The readiness probe intentionally sends an empty users array. Sarvam's
    // documented stream endpoint requires 1-1000 users, so HTTP 422 proves the
    // key, org/workspace route, campaign lookup, and stream endpoint are all
    // reachable without creating a contact or placing a call.
    if (response.status === 422 || response.status === 400) {
      return {
        ok: true,
        status: response.status,
        message: "Sarvam authenticated successfully and the configured renewal campaign stream endpoint is reachable.",
      };
    }

    if (response.ok) {
      return {
        ok: false,
        status: response.status,
        message: "Sarvam unexpectedly accepted the validation-only readiness payload. Stop and review provider behavior before enabling customer dispatch.",
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: response.status,
        message: "Sarvam rejected the X-API-Key credential or workspace access for the renewal stream endpoint.",
      };
    }

    if (response.status === 404) {
      return {
        ok: false,
        status: response.status,
        message: "Sarvam is reachable, but the configured organisation, workspace or campaign could not be found by the stream endpoint.",
      };
    }

    return {
      ok: false,
      status: response.status,
      message: `Sarvam stream readiness check failed with provider status ${response.status}.`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        status: null,
        message: "Sarvam did not respond to the validation-only stream readiness check within 10 seconds.",
      };
    }

    return {
      ok: false,
      status: null,
      message: "Sarvam could not be reached from the INSUREIT server.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
