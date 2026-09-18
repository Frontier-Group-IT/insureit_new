import "server-only";

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";
const DEFAULT_TIME_ZONE = "Asia/Kolkata";
const CLOCK_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function clockValue(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value && CLOCK_RE.test(value) ? value : fallback;
}

function timeZoneValue() {
  const candidate = process.env.SARVAM_RENEWAL_CALL_TIMEZONE?.trim();
  if (!candidate) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
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
};

export function getSarvamRenewalOperationalPolicy(now = new Date()): SarvamRenewalOperationalPolicy {
  const start = clockValue("SARVAM_RENEWAL_CALL_WINDOW_START", DEFAULT_START);
  const end = clockValue("SARVAM_RENEWAL_CALL_WINDOW_END", DEFAULT_END);
  const timeZone = timeZoneValue();
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
  };
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
