import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { applyExternalRenewalVoiceResult } from "@/lib/partner-external-renewal-voice";

const MAX_WEBHOOK_BYTES = 256_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONNECTIVITY = new Set(["connected", "busy", "no_answer", "failed"]);
const COMPLETION = new Set(["completed", "partial", "failed"]);

// These are the durable INSUREIT persistence values used by the existing
// production schema/RPC. The committed Sarvam agent may expose newer,
// customer-facing enum labels; normalize those labels here rather than widening
// the database contract during a controlled production pilot.
const DISPOSITIONS = new Set([
  "no_decision",
  "interested",
  "follow_up",
  "not_interested",
  "already_renewed",
  "wrong_person",
  "human_assistance",
  "quote_requested",
  "do_not_contact",
]);
const INTEREST = new Set(["unknown", "high", "medium", "low"]);

function secureEqual(actual: string | null, expected: string) {
  if (!actual) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function optionalText(value: unknown, max = 2000) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function normalizeToken(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/[\s-]+/g, "_") : null;
}

function normalizeDisposition(value: unknown) {
  const token = normalizeToken(value);
  if (!token) return null;
  const aliases: Record<string, string> = {
    // Current committed Sarvam agent contract.
    connected: "no_decision",
    renewed_elsewhere: "already_renewed",

    // Existing/legacy provider labels remain accepted for backward compatibility.
    no_decision: "no_decision",
    interested: "interested",
    follow_up: "follow_up",
    callback: "follow_up",
    call_back: "follow_up",
    not_interested: "not_interested",
    already_renewed: "already_renewed",
    renewed: "already_renewed",
    wrong_person: "wrong_person",
    human_assistance: "human_assistance",
    human_needed: "human_assistance",
    quote_requested: "quote_requested",
    do_not_contact: "do_not_contact",
    opt_out: "do_not_contact",
    stop_calling: "do_not_contact",
  };
  const normalized = aliases[token] ?? token;
  return DISPOSITIONS.has(normalized) ? normalized : null;
}

function normalizeInterest(value: unknown) {
  const token = normalizeToken(value);
  if (!token) return null;
  const aliases: Record<string, string> = {
    // Current committed Sarvam agent contract.
    interested: "high",
    maybe: "medium",
    not_interested: "low",

    // Existing/legacy provider labels remain accepted for backward compatibility.
    unknown: "unknown",
    high: "high",
    medium: "medium",
    low: "low",
  };
  const normalized = aliases[token] ?? token;
  return INTEREST.has(normalized) ? normalized : null;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const token = value.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(token)) return true;
    if (["false", "no", "n", "0"].includes(token)) return false;
  }
  return null;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  // Follow-up time is accepted only when the agent returns an explicit timezone.
  // Natural-language callback requests remain for human review rather than being guessed.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(trimmed)) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeInteger(value: unknown) {
  const number = normalizeNumber(value);
  return number === null ? 0 : Math.floor(number);
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.SARVAM_RENEWAL_WEBHOOK_SECRET?.trim();
  if (!expectedSecret) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const suppliedSecret =
    request.headers.get("x-insureit-sarvam-webhook-secret") ??
    new URL(request.url).searchParams.get("token");
  if (!secureEqual(suppliedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = asRecord(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const providerAttemptId = optionalText(payload.attempt_id, 160);
  const campaignId = optionalText(payload.campaign_id, 200);
  const cohortId = optionalText(payload.cohort_id, 200);
  const localAttemptId = optionalText(payload.user_identifier, 80);
  const expectedCampaignId = process.env.SARVAM_RENEWAL_CAMPAIGN_ID?.trim();
  const expectedAppId = process.env.SARVAM_RENEWAL_APP_ID?.trim();
  const appId = optionalText(payload.app_id, 200);

  if (!providerAttemptId || !campaignId || !cohortId || !localAttemptId || !UUID_RE.test(localAttemptId)) {
    return NextResponse.json({ error: "Missing or invalid call identifiers." }, { status: 400 });
  }
  if (!expectedCampaignId || campaignId !== expectedCampaignId) {
    return NextResponse.json({ error: "Unexpected campaign." }, { status: 403 });
  }
  if (expectedAppId && appId !== expectedAppId) {
    return NextResponse.json({ error: "Unexpected agent." }, { status: 403 });
  }

  const connectivityToken = normalizeToken(payload.connectivity_status);
  const completionToken = normalizeToken(payload.completion_status);
  const connectivityStatus = connectivityToken && CONNECTIVITY.has(connectivityToken) ? connectivityToken : null;
  const completionStatus = completionToken && COMPLETION.has(completionToken) ? completionToken : null;
  const output = asRecord(payload.output_agent_variables);
  const finalVariables = asRecord(payload.final_agent_variables);
  const variable = (name: string) => output[name] ?? finalVariables[name];

  try {
    const result = await applyExternalRenewalVoiceResult({
      attemptId: localAttemptId,
      providerAttemptId,
      providerInteractionId: optionalText(payload.interaction_id, 300),
      providerCampaignId: campaignId,
      providerCohortId: cohortId,
      connectivityStatus,
      completionStatus,
      nextActionStatus: optionalText(payload.next_action_status, 120),
      failureReason: optionalText(payload.failure_reason, 1000),
      retryAttempt: normalizeInteger(payload.retry_attempt),
      durationSeconds: normalizeNumber(payload.duration ?? payload.duration_in_seconds),
      startedAt: normalizeTimestamp(payload.start_datetime),
      endedAt: normalizeTimestamp(payload.end_datetime),
      callDisposition: normalizeDisposition(variable("call_disposition")),
      customerInterest: normalizeInterest(variable("customer_interest")),
      followUpRequired: normalizeBoolean(variable("follow_up_required")),
      followUpAt: normalizeTimestamp(variable("follow_up_time")),
      customerObjection: optionalText(variable("customer_objection"), 1000),
      callSummary: optionalText(variable("call_summary"), 2000),
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not apply call result.";
    // Do not echo the provider payload or transcript in errors/logs.
    return NextResponse.json({ error: message.slice(0, 180) }, { status: 409 });
  }
}
