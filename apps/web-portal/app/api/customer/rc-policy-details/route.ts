import { NextResponse } from "next/server";

import { getAuthenticatedProfile } from "@/lib/auth";
import { normalizeVehicleRegistrationNumber } from "@/lib/authbridge-rc-api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type CacheRow = {
  raw_response: unknown;
  fetched_at: string;
  expires_at: string;
};

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  const auth = await getAuthenticatedProfile(accessToken);
  if (!auth.user || !auth.profile?.is_active || auth.profile.role !== "customer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { registrationNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const registrationNumber = normalizeVehicleRegistrationNumber(body.registrationNumber ?? "");
  if (!isValidIndianRegistrationNumber(registrationNumber)) {
    return NextResponse.json({ error: "Enter the complete vehicle registration number." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("vehicle_rc_lookup_cache")
    .select("raw_response,fetched_at,expires_at")
    .eq("registration_number_normalized", registrationNumber)
    .maybeSingle();

  if (error) {
    console.warn("customer_rc_policy_cache_read_failed", { reason: safeReason(error.message) });
    return NextResponse.json({ error: "Insurance details are temporarily unavailable." }, { status: 503 });
  }

  const cached = (data as CacheRow | null) ?? null;
  if (!cached?.raw_response) {
    return NextResponse.json({
      status: "success",
      source: "local_cache",
      isStale: false,
      lookedUpAt: null,
      details: emptyInsuranceDetails(),
    });
  }

  const details = sanitizeInsuranceDetails(cached.raw_response);
  return NextResponse.json({
    status: "success",
    source: "local_cache",
    isStale: Date.parse(cached.expires_at) <= Date.now(),
    lookedUpAt: cached.fetched_at,
    details,
  });
}

function sanitizeInsuranceDetails(raw: unknown) {
  const insurance = getAuthbridgeSection(raw, "Insurance Details");
  return {
    insuranceCompany: cleanText(findObjectValue(insurance, ["Insurance Company", "Insurer", "Insurance Company Name"])),
    policyNumber: cleanCode(findObjectValue(insurance, ["Policy Number", "Policy No", "Policy No."])),
    policyEndDate: toIsoDate(findObjectValue(insurance, ["Insurance To Date/Insurance Upto", "Insurance Upto", "Insurance To Date", "Policy Upto", "Policy End Date"])),
  };
}

function emptyInsuranceDetails() {
  return {
    insuranceCompany: null,
    policyNumber: null,
    policyEndDate: null,
  };
}

function getAuthbridgeSection(raw: unknown, sectionName: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const root = raw as Record<string, unknown>;
  const msg = getObjectValue(root, "msg");
  if (!msg) return null;
  return getObjectValue(msg, sectionName);
}

function getObjectValue(object: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const target = normalizeKey(key);
  for (const [candidate, value] of Object.entries(object)) {
    if (normalizeKey(candidate) !== target) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return null;
}

function findObjectValue(object: Record<string, unknown> | null, keys: string[]) {
  if (!object) return null;
  for (const key of keys) {
    const target = normalizeKey(key);
    for (const [candidate, value] of Object.entries(object)) {
      if (normalizeKey(candidate) !== target) continue;
      if (typeof value !== "string" && typeof value !== "number") continue;
      const next = String(value).trim();
      if (next && !/^(null|undefined|na|n\/a)$/i.test(next)) return next;
    }
  }
  return null;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanText(value: string | null) {
  if (!value) return null;
  const next = value.replace(/\s+/g, " ").trim();
  return next && next.length <= 160 ? next : null;
}

function cleanCode(value: string | null) {
  if (!value) return null;
  const next = value.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9\-\/]/g, "");
  return next ? next.slice(0, 100) : null;
}

function toIsoDate(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  let match = trimmed.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (match) return validIso(match[1], match[2], match[3]);
  match = trimmed.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
  if (match) return validIso(match[3], match[2], match[1]);
  return null;
}

function validIso(year: string, month: string, day: string) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const parsed = new Date(y, m - 1, d);
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function isValidIndianRegistrationNumber(value: string) {
  if (/^\d{2}BH\d{4}[A-Z]{2}$/.test(value)) return true;
  return /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(value) && value.length >= 7 && value.length <= 12;
}

function safeReason(message: string) {
  return message
    .replace(/[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}/gi, "[rc]")
    .replace(/\d{2}BH\d{4}[A-Z]{2}/gi, "[rc]")
    .slice(0, 160);
}
