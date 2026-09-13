import "server-only";

import type { ExternalRenewalVoiceStartContext } from "@/lib/partner-external-renewal-voice";

const SARVAM_BASE_URL = "https://apps.sarvam.ai";
const REQUEST_TIMEOUT_MS = 15_000;

export type SarvamRenewalCohortResponse = {
  name: string;
  cohort_id: string;
  status: string;
  result?: {
    total_records?: number;
    valid_records?: number;
    rejected_records?: number;
  } | null;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function isSarvamRenewalCallingEnabled() {
  return process.env.SARVAM_RENEWAL_CALLING_ENABLED?.trim().toLowerCase() === "true";
}

export function normalizeIndiaPhoneForSarvam(value: string) {
  const trimmed = value.trim();
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  throw new Error("A valid Indian mobile number is required for AI calling.");
}

function stringVariable(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function buildAgentVariables(context: ExternalRenewalVoiceStartContext) {
  const variables: Record<string, string> = {};
  const candidates: Record<string, string | undefined> = {
    customer_name: stringVariable(context.customer_name),
    vehicle_make_model: stringVariable(context.vehicle_make_model),
    vehicle_number: stringVariable(context.vehicle_number),
    current_insurer: stringVariable(context.current_insurer),
    policy_expiry_date: stringVariable(context.policy_expiry_date),
    previous_idv: stringVariable(context.previous_idv),
    previous_premium: stringVariable(context.previous_premium),
  };

  for (const [key, value] of Object.entries(candidates)) {
    if (value) variables[key] = value;
  }
  return variables;
}

export async function streamExternalRenewalToSarvam(context: ExternalRenewalVoiceStartContext) {
  if (!isSarvamRenewalCallingEnabled()) {
    throw new Error("AI renewal calling is currently disabled by INSUREIT administration.");
  }

  const apiKey = requiredEnv("SARVAM_API_KEY");
  const orgId = requiredEnv("SARVAM_ORG_ID");
  const workspaceId = requiredEnv("SARVAM_WORKSPACE_ID");
  const campaignId = requiredEnv("SARVAM_RENEWAL_CAMPAIGN_ID");
  const phone = normalizeIndiaPhoneForSarvam(context.mobile);
  const cohortName = `renewal-${context.attempt_id.slice(0, 8)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${SARVAM_BASE_URL}/api/scheduling/v1/orgs/${encodeURIComponent(orgId)}/workspaces/${encodeURIComponent(workspaceId)}/campaigns/${encodeURIComponent(campaignId)}/cohorts/stream`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "api-subscription-key": apiKey,
        },
        body: JSON.stringify({
          name: cohortName,
          users: [
            {
              user_phone_number: phone,
              user_identifier: context.attempt_id,
              app_variables: buildAgentVariables(context),
            },
          ],
        }),
        signal: controller.signal,
        cache: "no-store",
      },
    );

    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (!response.ok) {
      const providerMessage =
        body && typeof body === "object" && "detail" in body
          ? String((body as { detail?: unknown }).detail ?? "")
          : "";
      throw new Error(
        providerMessage
          ? `Sarvam rejected the call request (${response.status}): ${providerMessage.slice(0, 180)}`
          : `Sarvam rejected the call request (${response.status}).`,
      );
    }

    if (!body || typeof body !== "object") throw new Error("Sarvam returned an invalid cohort response.");
    const cohortId = String((body as { cohort_id?: unknown }).cohort_id ?? "").trim();
    if (!cohortId) throw new Error("Sarvam did not return a cohort id.");

    return {
      campaignId,
      response: body as SarvamRenewalCohortResponse,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Sarvam did not accept the call request within 15 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
