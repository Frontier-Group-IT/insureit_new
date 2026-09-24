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

export class SarvamRenewalSubmissionError extends Error {
  definitelyRejected: boolean;

  constructor(message: string, definitelyRejected: boolean) {
    super(message);
    this.name = "SarvamRenewalSubmissionError";
    this.definitelyRejected = definitelyRejected;
  }
}

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

function customerGreetingIdentity(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return { firstName: undefined, salutation: undefined };
  }

  const explicitHonorifics: Array<{ pattern: RegExp; salutation: "Sir" | "Madam" }> = [
    { pattern: /^(?:mr\.?|shri|shree|sri)\s+/i, salutation: "Sir" },
    { pattern: /^(?:mrs\.?|ms\.?|miss|smt\.?)\s+/i, salutation: "Madam" },
  ];

  let nameWithoutHonorific = normalized;
  let salutation: "Sir" | "Madam" | undefined;

  for (const entry of explicitHonorifics) {
    if (entry.pattern.test(nameWithoutHonorific)) {
      salutation = entry.salutation;
      nameWithoutHonorific = nameWithoutHonorific.replace(entry.pattern, "").trim();
      break;
    }
  }

  const rawFirstName = nameWithoutHonorific.split(/\s+/)[0]?.trim();
  if (!rawFirstName) {
    return { firstName: undefined, salutation };
  }

  const firstName =
    /^[A-Z]+$/.test(rawFirstName) && rawFirstName.length > 1
      ? rawFirstName.charAt(0) + rawFirstName.slice(1).toLowerCase()
      : rawFirstName;

  return { firstName, salutation };
}

function buildOpeningLine(context: ExternalRenewalVoiceStartContext) {
  const { firstName, salutation } = customerGreetingIdentity(context.customer_name);
  const addressee = [firstName, salutation].filter(Boolean).join(" ");
  const brand = stringVariable(context.calling_brand) ?? "Frontier JCB";
  const isRepeat = Boolean(context.repeat_call);
  const intro = addressee ? `नमस्ते ${addressee}, मैं अंजना बोल रही हूँ ${brand} से।` : `नमस्ते, मैं अंजना बोल रही हूँ ${brand} से।`;

  if (isRepeat) {
    const followUp = context.last_call_disposition === "follow_up"
      ? " पिछली बार आपने बाद में insurance renewal पर बात करने को कहा था—अभी दो मिनट हैं?"
      : " पिछली बार insurance renewal पर हमारी बात हुई थी—अभी दो मिनट हैं?";
    return intro + followUp;
  }

  const vehicleContext = context.campaign_type === "tata_commercial_renewal" ? "Tata commercial vehicle की " : "";
  return `${intro} आपकी ${vehicleContext}policy renewal के बारे में call किया था—दो मिनट बात कर सकते हैं क्या?`;
}

function buildAgentVariables(context: ExternalRenewalVoiceStartContext) {
  const variables: Record<string, string> = {};
  const greetingIdentity = customerGreetingIdentity(context.customer_name);
  const candidates: Record<string, string | undefined> = {
    customer_name: stringVariable(context.customer_name),
    customer_first_name: greetingIdentity.firstName,
    customer_salutation: greetingIdentity.salutation,
    opening_line: buildOpeningLine(context),
    vehicle_make_model: stringVariable(context.vehicle_make_model),
    vehicle_number: stringVariable(context.vehicle_number),
    current_insurer: stringVariable(context.current_insurer),
    policy_expiry_date: stringVariable(context.policy_expiry_date),
    previous_idv: stringVariable(context.previous_idv),
    previous_premium: stringVariable(context.previous_premium),
    campaign_type: stringVariable(context.campaign_type),
    calling_brand: stringVariable(context.calling_brand),
    vehicle_brand_context: stringVariable(context.vehicle_brand_context),
    primary_sales_pitch: stringVariable(context.primary_sales_pitch),
    cashless_claim_pitch: stringVariable(context.cashless_claim_pitch),
    renewal_bucket: stringVariable(context.renewal_bucket),
    days_to_expiry: context.days_to_expiry == null ? undefined : String(context.days_to_expiry),
    vehicle_count: context.vehicle_count == null ? undefined : String(context.vehicle_count),
    vehicle_context_summary: stringVariable(context.vehicle_context_summary),
    current_policy_number: stringVariable(context.current_policy_number),
    repeat_call: context.repeat_call ? "true" : "false",
    previous_connected_call_count:
      context.previous_connected_call_count == null ? undefined : String(context.previous_connected_call_count),
    last_call_disposition: stringVariable(context.last_call_disposition),
    last_call_summary: stringVariable(context.last_call_summary),
    last_customer_interest: stringVariable(context.last_customer_interest),
    last_customer_objection: stringVariable(context.last_customer_objection),
    last_follow_up_time: stringVariable(context.last_follow_up_time),
  };

  for (const [key, value] of Object.entries(candidates)) {
    if (value) variables[key] = value;
  }
  return variables;
}

// Production diagnostics proved the Voice Agents stream endpoint accepts
// X-API-Key. The legacy api-subscription-key and Bearer forms returned 401 and
// are intentionally not used for real cohort submission.
async function postSarvam(url: string, apiKey: string, body: string, signal: AbortSignal) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-API-Key": apiKey,
    },
    body,
    signal,
    cache: "no-store",
  });
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
    const url = `${SARVAM_BASE_URL}/api/scheduling/v1/orgs/${encodeURIComponent(orgId)}/workspaces/${encodeURIComponent(workspaceId)}/campaigns/${encodeURIComponent(campaignId)}/cohorts/stream`;
    const body = JSON.stringify({
      name: cohortName,
      users: [
        {
          user_phone_number: phone,
          user_identifier: context.attempt_id,
          app_variables: buildAgentVariables(context),
        },
      ],
    });

    const response = await postSarvam(url, apiKey, body, controller.signal);

    const text = await response.text();
    let responseBody: unknown = null;
    try {
      responseBody = text ? JSON.parse(text) : null;
    } catch {
      responseBody = null;
    }

    if (!response.ok) {
      // An explicit non-2xx response proves Sarvam rejected this request. Do not
      // expose provider response details to the Partner browser.
      throw new SarvamRenewalSubmissionError(
        `Sarvam rejected the AI call request (${response.status}).`,
        true,
      );
    }

    if (!responseBody || typeof responseBody !== "object") {
      // A 2xx followed by an unreadable body is ambiguous: the cohort may already
      // exist. Keep the local active-attempt guard so a retry cannot duplicate it.
      throw new SarvamRenewalSubmissionError(
        "Sarvam accepted the request but returned an unexpected response. Await reconciliation before retrying.",
        false,
      );
    }

    const cohort = responseBody as SarvamRenewalCohortResponse;
    const cohortId = String(cohort.cohort_id ?? "").trim();
    if (!cohortId) {
      throw new SarvamRenewalSubmissionError(
        "Sarvam accepted the request without a cohort id. Await reconciliation before retrying.",
        false,
      );
    }

    // Stream processing can complete synchronously for tiny cohorts. If Sarvam
    // explicitly reports zero valid records, this single-user submission was
    // definitively rejected and can safely release the local active-attempt guard.
    const validRecords = cohort.result?.valid_records;
    const rejectedRecords = cohort.result?.rejected_records;
    if (cohort.status === "failed" || (validRecords === 0 && (rejectedRecords ?? 0) > 0)) {
      throw new SarvamRenewalSubmissionError("Sarvam rejected the cohort record.", true);
    }

    return {
      campaignId,
      response: cohort,
    };
  } catch (error) {
    if (error instanceof SarvamRenewalSubmissionError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      // Timeout is not proof of rejection. The request may have reached Sarvam and
      // must remain protected against a duplicate Partner retry.
      throw new SarvamRenewalSubmissionError(
        "Sarvam did not confirm the call request within 15 seconds. Await reconciliation before retrying.",
        false,
      );
    }
    throw new SarvamRenewalSubmissionError(
      "Sarvam could not confirm the AI call request. Await reconciliation before retrying.",
      false,
    );
  } finally {
    clearTimeout(timeout);
  }
}
