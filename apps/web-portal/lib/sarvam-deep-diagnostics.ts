import "server-only";

const CORE_BASE_URL = "https://api.sarvam.ai";
const VOICE_BASE_URL = "https://apps.sarvam.ai";
const TIMEOUT_MS = 10_000;

export type SarvamDiagnosticProbe = {
  key: "core" | "scheduling_subscription" | "scheduling_bearer";
  label: string;
  status: number | null;
  classification: string;
  errorCode: string | null;
  requestId: string | null;
};

export type SarvamDeepDiagnostics = {
  probes: SarvamDiagnosticProbe[];
  conclusion: string;
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

function classifyCore(status: number | null) {
  if (status === null) return "network_or_timeout";
  if (status === 401 || status === 403) return "api_key_rejected";
  if (status === 404 || status === 422 || (status >= 200 && status < 300)) return "api_key_accepted";
  if (status === 429) return "api_key_accepted_rate_limited";
  return `provider_http_${status}`;
}

function classifyScheduling(status: number | null) {
  if (status === null) return "network_or_timeout";
  if (status >= 200 && status < 300) return "campaign_reachable";
  if (status === 401) return "authentication_rejected";
  if (status === 403) return "authenticated_but_forbidden_or_key_rejected";
  if (status === 404) return "campaign_binding_not_found";
  if (status === 429) return "authenticated_rate_limited";
  return `provider_http_${status}`;
}

async function runProbe(
  key: SarvamDiagnosticProbe["key"],
  label: string,
  url: string,
  headers: HeadersInit,
  classifier: (status: number | null) => string,
): Promise<SarvamDiagnosticProbe> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    const { errorCode, requestId } = await safeProviderMetadata(response);
    return {
      key,
      label,
      status: response.status,
      classification: classifier(response.status),
      errorCode,
      requestId,
    };
  } catch {
    return {
      key,
      label,
      status: null,
      classification: classifier(null),
      errorCode: null,
      requestId: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function summarize(probes: SarvamDiagnosticProbe[]) {
  const core = probes.find((probe) => probe.key === "core");
  const subscription = probes.find((probe) => probe.key === "scheduling_subscription");
  const bearer = probes.find((probe) => probe.key === "scheduling_bearer");

  const coreAccepted = core?.classification.startsWith("api_key_accepted") ?? false;
  const schedulingOk = [subscription, bearer].some((probe) => probe?.classification === "campaign_reachable");

  if (!coreAccepted) {
    return "Core Sarvam API authentication did not reach the authenticated resource layer. Check the API key before changing campaign configuration.";
  }
  if (schedulingOk) {
    return "The API key is accepted and at least one Voice Agents scheduling authentication form can reach the configured campaign.";
  }
  if (subscription?.status === 401 && bearer?.status === 401) {
    return "The API key is accepted by api.sarvam.ai, but both Voice Agents scheduling authentication forms return 401. This isolates the blocker to the Voice Agents scheduling auth/permission contract rather than the API key itself.";
  }
  if (subscription?.status === 403 || bearer?.status === 403) {
    return "Core API authentication is accepted, while the Voice Agents scheduling API reports forbidden access. Check Voice Agents product/workspace/campaign permissions with Sarvam.";
  }
  if (subscription?.status === 404 || bearer?.status === 404) {
    return "Core API authentication is accepted, while the Voice Agents campaign binding is not found. Recheck organisation, workspace and campaign identifiers.";
  }
  return "The API key reaches Sarvam core successfully, but the Voice Agents scheduling probes did not reach the configured campaign. Use the individual sanitized statuses below for provider escalation.";
}

export async function runSarvamDeepDiagnostics(): Promise<SarvamDeepDiagnostics> {
  const apiKey = requiredEnv("SARVAM_API_KEY");
  const orgId = requiredEnv("SARVAM_ORG_ID");
  const workspaceId = requiredEnv("SARVAM_WORKSPACE_ID");
  const campaignId = requiredEnv("SARVAM_RENEWAL_CAMPAIGN_ID");

  const schedulingUrl = `${VOICE_BASE_URL}/api/scheduling/v1/orgs/${encodeURIComponent(orgId)}/workspaces/${encodeURIComponent(workspaceId)}/campaigns/${encodeURIComponent(campaignId)}/webhooks?limit=1`;
  const coreUrl = `${CORE_BASE_URL}/text-to-speech/pronunciation-dictionary/insureit-diagnostic-do-not-create`;

  const probes = await Promise.all([
    runProbe(
      "core",
      "Core Sarvam API key",
      coreUrl,
      { "api-subscription-key": apiKey },
      classifyCore,
    ),
    runProbe(
      "scheduling_subscription",
      "Voice Agents scheduling · subscription key",
      schedulingUrl,
      { "api-subscription-key": apiKey },
      classifyScheduling,
    ),
    runProbe(
      "scheduling_bearer",
      "Voice Agents scheduling · Bearer",
      schedulingUrl,
      { authorization: `Bearer ${apiKey}` },
      classifyScheduling,
    ),
  ]);

  return { probes, conclusion: summarize(probes) };
}
