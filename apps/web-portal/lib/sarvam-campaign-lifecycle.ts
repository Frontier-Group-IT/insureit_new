import "server-only";

const SARVAM_BASE_URL = "https://apps.sarvam.ai";
const REQUEST_TIMEOUT_MS = 10_000;
const KNOWN_STATUSES = new Set(["scheduled", "active", "paused", "ended", "cancelled"] as const);

export type SarvamCampaignStatus = "scheduled" | "active" | "paused" | "ended" | "cancelled";
export type SarvamCampaignAction = "pause" | "resume";

export type SarvamCampaignLifecycleState = {
  ok: boolean;
  status: SarvamCampaignStatus | "unknown";
  httpStatus: number | null;
  message: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function campaignUrl() {
  const orgId = requiredEnv("SARVAM_ORG_ID");
  const workspaceId = requiredEnv("SARVAM_WORKSPACE_ID");
  const campaignId = requiredEnv("SARVAM_RENEWAL_CAMPAIGN_ID");
  return `${SARVAM_BASE_URL}/api/scheduling/v1/orgs/${encodeURIComponent(orgId)}/workspaces/${encodeURIComponent(workspaceId)}/campaigns/${encodeURIComponent(campaignId)}`;
}

function normalizeStatus(value: unknown): SarvamCampaignStatus | "unknown" {
  const status = String(value ?? "").trim().toLowerCase();
  return KNOWN_STATUSES.has(status as SarvamCampaignStatus) ? (status as SarvamCampaignStatus) : "unknown";
}

async function sarvamFetch(url: string, init: RequestInit) {
  const apiKey = requiredEnv("SARVAM_API_KEY");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        "X-API-Key": apiKey,
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSarvamRenewalCampaignState(): Promise<SarvamCampaignLifecycleState> {
  try {
    const response = await sarvamFetch(campaignUrl(), { method: "GET" });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        status: "unknown",
        httpStatus: response.status,
        message: `Sarvam campaign state request failed with provider status ${response.status}.`,
      };
    }

    const status = normalizeStatus(
      body && typeof body === "object" && "status" in body ? (body as { status?: unknown }).status : null,
    );
    return {
      ok: status !== "unknown",
      status,
      httpStatus: response.status,
      message:
        status === "unknown"
          ? "Sarvam returned the campaign but its lifecycle status was not recognized."
          : "Sarvam campaign lifecycle state retrieved.",
    };
  } catch (error) {
    return {
      ok: false,
      status: "unknown",
      httpStatus: null,
      message:
        error instanceof Error && error.name === "AbortError"
          ? "Sarvam campaign state request timed out."
          : "Sarvam campaign state could not be retrieved.",
    };
  }
}

export async function updateSarvamRenewalCampaignStatus(
  action: SarvamCampaignAction,
): Promise<SarvamCampaignLifecycleState> {
  try {
    const response = await sarvamFetch(`${campaignUrl()}/status`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        status: "unknown",
        httpStatus: response.status,
        message: `Sarvam rejected the campaign ${action} request with provider status ${response.status}.`,
      };
    }

    const status = normalizeStatus(
      body && typeof body === "object" && "status" in body ? (body as { status?: unknown }).status : null,
    );
    return {
      ok: status !== "unknown",
      status,
      httpStatus: response.status,
      message:
        status === "unknown"
          ? `Sarvam accepted the campaign ${action} request but returned an unknown lifecycle state.`
          : `Sarvam campaign is now ${status}.`,
    };
  } catch (error) {
    return {
      ok: false,
      status: "unknown",
      httpStatus: null,
      message:
        error instanceof Error && error.name === "AbortError"
          ? `Sarvam campaign ${action} request timed out.`
          : `Sarvam campaign ${action} request could not be completed.`,
    };
  }
}


export async function assertSarvamRenewalCampaignDispatchable() {
  const state = await getSarvamRenewalCampaignState();

  if (!state.ok) {
    throw new Error("AI renewal calling is temporarily unavailable because INSUREIT could not verify the Sarvam campaign state.");
  }

  if (state.status === "paused") {
    throw new Error("AI renewal calling is paused by INSUREIT administration.");
  }

  if (state.status === "ended" || state.status === "cancelled") {
    throw new Error("The configured Sarvam renewal campaign is no longer available for new calls.");
  }

  if (state.status !== "active" && state.status !== "scheduled") {
    throw new Error("The configured Sarvam renewal campaign is not ready for new calls.");
  }

  return state;
}
