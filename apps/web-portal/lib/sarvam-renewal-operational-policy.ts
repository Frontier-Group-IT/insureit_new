import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";
const DEFAULT_TIME_ZONE = "Asia/Kolkata";
export const SARVAM_CALLING_WINDOW_SETTINGS_ID = "production";
export const SARVAM_CALLING_WINDOW_CLOCK_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

type CallingWindowRow = {
  window_start: string | null;
  window_end: string | null;
  time_zone: string | null;
};

function clockValue(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value && SARVAM_CALLING_WINDOW_CLOCK_RE.test(value) ? value : fallback;
}

function normalizeClock(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const normalized = value.trim().slice(0, 5);
  return SARVAM_CALLING_WINDOW_CLOCK_RE.test(normalized) ? normalized : fallback;
}

function envTimeZoneValue() {
  const candidate = process.env.SARVAM_RENEWAL_CALL_TIMEZONE?.trim();
  if (!candidate) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function normalizeTimeZone(candidate: string | null | undefined, fallback: string) {
  if (!candidate) return fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return fallback;
  }
}

function minutes(clock: string) {
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

function zonedClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export type SarvamRenewalOperationalPolicy = {
  start: string;
  end: string;
  timeZone: string;
  withinCallingWindow: boolean;
  dndAndTerminalGuard: true;
  applicationAutoRetry: false;
  source: "database" | "environment";
};

function buildPolicy(start: string, end: string, timeZone: string, now: Date, source: SarvamRenewalOperationalPolicy["source"]): SarvamRenewalOperationalPolicy {
  const current = zonedClock(now, timeZone);
  const startMinutes = minutes(start);
  const endMinutes = minutes(end);

  const withinCallingWindow =
    startMinutes <= endMinutes
      ? current >= startMinutes && current < endMinutes
      : current >= startMinutes || current < endMinutes;

  return {
    start,
    end,
    timeZone,
    withinCallingWindow,
    dndAndTerminalGuard: true,
    applicationAutoRetry: false,
    source,
  };
}

export function getSarvamRenewalOperationalPolicy(now = new Date()): SarvamRenewalOperationalPolicy {
  const start = clockValue("SARVAM_RENEWAL_CALL_WINDOW_START", DEFAULT_START);
  const end = clockValue("SARVAM_RENEWAL_CALL_WINDOW_END", DEFAULT_END);
  const timeZone = envTimeZoneValue();
  return buildPolicy(start, end, timeZone, now, "environment");
}

export async function getConfiguredSarvamRenewalOperationalPolicy(now = new Date()): Promise<SarvamRenewalOperationalPolicy> {
  const fallback = getSarvamRenewalOperationalPolicy(now);

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("sarvam_voice_operational_settings")
      .select("window_start,window_end,time_zone")
      .eq("id", SARVAM_CALLING_WINDOW_SETTINGS_ID)
      .maybeSingle<CallingWindowRow>();

    if (error || !data) return fallback;

    const start = normalizeClock(data.window_start, fallback.start);
    const end = normalizeClock(data.window_end, fallback.end);
    const timeZone = normalizeTimeZone(data.time_zone, fallback.timeZone);
    return buildPolicy(start, end, timeZone, now, "database");
  } catch {
    return fallback;
  }
}

export function assertSarvamRenewalCallingWindow(now = new Date()) {
  const policy = getSarvamRenewalOperationalPolicy(now);
  if (!policy.withinCallingWindow) {
    throw new Error(
      `AI renewal calling is available only between ${policy.start} and ${policy.end} (${policy.timeZone}).`,
    );
  }
  return policy;
}

export async function assertConfiguredSarvamRenewalCallingWindow(now = new Date()) {
  const policy = await getConfiguredSarvamRenewalOperationalPolicy(now);
  if (!policy.withinCallingWindow) {
    throw new Error(
      `AI renewal calling is available only between ${policy.start} and ${policy.end} (${policy.timeZone}).`,
    );
  }
  return policy;
}
