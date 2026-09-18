import "server-only";

const SARVAM_BASE_URL = "https://apps.sarvam.ai";
const REQUEST_TIMEOUT_MS = 10_000;
const PROVIDER_ATTEMPT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SarvamWebhookRetryResult = {
  ok: boolean;
  status: number | null;
  message: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function isValidSarvamProviderAttemptId(value: string) {
  return PROVIDER_ATTEMPT_ID_RE.test(value.trim());
}

export async function retrySarvamCampaignWebhookDelivery(providerAttemptId: string): Promise<SarvamWebhookRetryResult> {
  const normalizedAttemptId = providerAttemptId.trim();
  if (!isValidSarvamProviderAttemptId(normalizedAttemptId)) {
    return { ok: false, status: null, message: "A valid Sarvam provider attempt ID is required." };
  }

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
    return { ok: false, status: null, message: "Required Sarvam server configuration is incomplete." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${SARVAM_BASE_URL}/api/scheduling/v1/orgs/${encodeURIComponent(orgId)}/workspaces/${encodeURIComponent(workspaceId)}/campaigns/${encodeURIComponent(campaignId)}/webhooks/retry`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ attempt_ids: [normalizedAttemptId] }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 202) {
      return {
        ok: true,
        status: response.status,
        message: "Sarvam accepted the webhook re-delivery request.",
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: response.status,
        message: "Sarvam rejected the configured X-API-Key credential or workspace access.",
      };
    }

    if (response.status === 404) {
      return {
        ok: false,
        status: response.status,
        message: "The configured Sarvam campaign or webhook retry route was not found.",
      };
    }

    return {
      ok: false,
      status: response.status,
      message: `Sarvam webhook re-delivery request failed with provider status ${response.status}.`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        status: null,
        message: "Sarvam did not confirm the webhook re-delivery request within 10 seconds.",
      };
    }
    return {
      ok: false,
      status: null,
      message: "Sarvam could not be reached for webhook re-delivery.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
