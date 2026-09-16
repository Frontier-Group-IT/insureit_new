import "server-only";

const VOICE_BASE_URL = "https://apps.sarvam.ai";
const CONTROL_CAMPAIGN_ID = "INSUREIT-Re-31885c09-3493";
const TIMEOUT_MS = 10_000;

export type SarvamControlCampaignProbe = {
  status: number | null;
  classification: string;
  errorCode: string | null;
  requestId: string | null;
};

export type SarvamControlCampaignDiagnostic = {
  campaignId: string;
  webhookList: SarvamControlCampaignProbe;
  streamValidation: SarvamControlCampaignProbe;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function safeString(value: unknown, max = 80) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[\r\n\t]+/g, " ");
  return normalized ? normalized.slice(0, max) : null;
}

function classify(status: number | null, mode: "read" | "validation") {
  if (status === null) return "network_or_timeout";
  if (mode === "validation" && (status === 400 || status === 422)) return "authenticated_validation_reached";
  if (status >= 200 && status < 300) return mode === "validation" ? "unexpected_invalid_payload_accepted" : "campaign_reachable";
  if (status === 401) return "authentication_rejected";
  if (status === 403) return "authenticated_but_forbidden_or_key_rejected";
  if (status === 404) return "campaign_binding_not_found";
  if (status === 429) return "authenticated_rate_limited";
  return `provider_http_${status}`;
}

async function safeProviderMetadata(response: Response) {
  let errorCode: string | null = null;
  try {
    const text = await response.text();
    if (text) {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      errorCode =
        safeString(parsed.error_code) ??
        safeString(parsed.code) ??
        (parsed.error && typeof parsed.error === "object"
          ? safeString((parsed.error as Record<string, unknown>).code)
          : null);
    }
  } catch {
    // Raw provider bodies are intentionally not surfaced or logged.
  }

  const requestId =
    safeString(response.headers.get("x-request-id")) ??
    safeString(response.headers.get("x-correlation-id")) ??
    safeString(response.headers.get("cf-ray"));

  return { errorCode, requestId };
}

async function runProbe(
  url: string,
  apiKey: string,
  mode: "read" | "validation",
  init: Omit<RequestInit, "headers" | "cache" | "signal">,
): Promise<SarvamControlCampaignProbe> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        "X-API-Key": apiKey,
        ...(init.method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const { errorCode, requestId } = await safeProviderMetadata(response);
    return {
      status: response.status,
      classification: classify(response.status, mode),
      errorCode,
      requestId,
    };
  } catch {
    return {
      status: null,
      classification: classify(null, mode),
      errorCode: null,
      requestId: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runSarvamControlCampaignDiagnostic(): Promise<SarvamControlCampaignDiagnostic> {
  const apiKey = requiredEnv("SARVAM_API_KEY");
  const orgId = requiredEnv("SARVAM_ORG_ID");
  const workspaceId = requiredEnv("SARVAM_WORKSPACE_ID");
  const campaignBase = `${VOICE_BASE_URL}/api/scheduling/v1/orgs/${encodeURIComponent(orgId)}/workspaces/${encodeURIComponent(workspaceId)}/campaigns/${encodeURIComponent(CONTROL_CAMPAIGN_ID)}`;

  const webhookList = await runProbe(`${campaignBase}/webhooks?limit=1`, apiKey, "read", { method: "GET" });

  // This deliberately invalid payload is documented by Sarvam as a validation error:
  // cohort name must be 1-50 chars and users must contain at least one record.
  // A 400/422 therefore proves the request passed auth/campaign routing and reached
  // request validation without creating a cohort or adding a callable contact.
  const streamValidation = await runProbe(`${campaignBase}/cohorts/stream`, apiKey, "validation", {
    method: "POST",
    body: JSON.stringify({ name: "", users: [] }),
  });

  return {
    campaignId: CONTROL_CAMPAIGN_ID,
    webhookList,
    streamValidation,
  };
}
