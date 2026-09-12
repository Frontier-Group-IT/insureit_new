import { NextRequest, NextResponse } from "next/server";

import { accessTokenCookie } from "@/lib/auth-config";
import { getAuthenticatedProfile } from "@/lib/auth";
import { lookupAuthbridgeRc } from "@/lib/authbridge-rc-api";
import {
  classifyAuthbridgeResponse,
  flattenAuthbridgeResponse,
  getAuthbridgeBusinessCode,
  getAuthbridgeMessage,
} from "@/lib/authbridge-rc-bulk";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isValidVehicleRegistrationNumber, normalizeVehicleRegistrationNumber } from "@/lib/vehicle-registration";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BATCH_SIZE = 5;
const PROVIDER_SPACING_MS = 1_600;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BULK_MAPPER_VERSION = "2026-09-12-bulk-v1";

type CacheRow = {
  registration_number_normalized: string;
  raw_response: unknown;
  transaction_id: string | null;
  fetched_at: string;
  expires_at: string;
};

type BulkResult = {
  registrationNumber: string;
  status: "success" | "no_data" | "invalid" | "provider_error" | "request_error";
  source: "cache" | "authbridge" | "validation";
  providerCode: number | null;
  message: string | null;
  transactionId: string | null;
  lookedUpAt: string | null;
  fields: Record<string, string | number | boolean | null>;
};

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get(accessTokenCookie)?.value;
  const auth = await getAuthenticatedProfile(accessToken);
  if (!auth.user || !auth.profile?.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.profile.role !== "super_admin") {
    return NextResponse.json({ error: "Super Admin access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { registrationNumbers?: unknown } | null;
  const supplied = Array.isArray(body?.registrationNumbers) ? body.registrationNumbers : [];
  const registrationNumbers = [...new Set(
    supplied
      .filter((value): value is string => typeof value === "string")
      .map(normalizeVehicleRegistrationNumber)
      .filter(Boolean),
  )].slice(0, MAX_BATCH_SIZE);

  if (!registrationNumbers.length) {
    return NextResponse.json({ error: "Provide at least one registration number." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const now = Date.now();
  const validNumbers = registrationNumbers.filter(isValidVehicleRegistrationNumber);
  const cacheByRegistration = new Map<string, CacheRow>();

  if (validNumbers.length) {
    const { data, error } = await admin
      .from("vehicle_rc_lookup_cache")
      .select("registration_number_normalized,raw_response,transaction_id,fetched_at,expires_at")
      .in("registration_number_normalized", validNumbers);

    if (error) {
      console.warn("authbridge_bulk_cache_read_failed", { reason: "cache_read_failed" });
    } else {
      for (const row of (data ?? []) as CacheRow[]) cacheByRegistration.set(row.registration_number_normalized, row);
    }
  }

  const results: BulkResult[] = [];
  let liveCalls = 0;

  for (const registrationNumber of registrationNumbers) {
    if (!isValidVehicleRegistrationNumber(registrationNumber)) {
      results.push({
        registrationNumber,
        status: "invalid",
        source: "validation",
        providerCode: null,
        message: "Registration number does not match the supported Indian RC format.",
        transactionId: null,
        lookedUpAt: null,
        fields: {},
      });
      continue;
    }

    const cached = cacheByRegistration.get(registrationNumber);
    if (cached && Date.parse(cached.expires_at) > now && cached.raw_response) {
      const outcome = classifyAuthbridgeResponse(cached.raw_response);
      if (outcome === "success" || outcome === "no_data") {
        results.push({
          registrationNumber,
          status: outcome,
          source: "cache",
          providerCode: getAuthbridgeBusinessCode(cached.raw_response),
          message: getAuthbridgeMessage(cached.raw_response),
          transactionId: cached.transaction_id,
          lookedUpAt: cached.fetched_at,
          fields: outcome === "success" ? flattenAuthbridgeResponse(cached.raw_response) : {},
        });
        continue;
      }
    }

    if (liveCalls > 0) await sleep(PROVIDER_SPACING_MS);
    liveCalls += 1;

    try {
      const response = await lookupAuthbridgeRc(registrationNumber);
      const raw = response.data;
      const outcome = classifyAuthbridgeResponse(raw);
      const providerCode = getAuthbridgeBusinessCode(raw);
      const message = getAuthbridgeMessage(raw);
      const fetchedAt = normalizeTimestamp(response.lookedUpAt) ?? new Date().toISOString();
      const expiresAt = new Date(Date.parse(fetchedAt) + CACHE_TTL_MS).toISOString();

      if (outcome === "success" || outcome === "no_data") {
        const { error: cacheError } = await admin.from("vehicle_rc_lookup_cache").upsert(
          {
            registration_number_normalized: registrationNumber,
            provider: "authbridge",
            service_code: "detailed_rc_372",
            raw_response: raw,
            normalized_details: {},
            transaction_id: response.transactionId ?? null,
            fetched_at: fetchedAt,
            last_served_at: new Date().toISOString(),
            expires_at: expiresAt,
            mapper_version: BULK_MAPPER_VERSION,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "registration_number_normalized" },
        );
        if (cacheError) console.warn("authbridge_bulk_cache_write_failed", { reason: "cache_write_failed" });
      }

      results.push({
        registrationNumber,
        status: outcome,
        source: "authbridge",
        providerCode,
        message,
        transactionId: response.transactionId ?? null,
        lookedUpAt: fetchedAt,
        fields: outcome === "success" ? flattenAuthbridgeResponse(raw) : {},
      });
    } catch (error) {
      results.push({
        registrationNumber,
        status: "request_error",
        source: "authbridge",
        providerCode: null,
        message: safeErrorMessage(error),
        transactionId: null,
        lookedUpAt: null,
        fields: {},
      });
    }
  }

  return NextResponse.json({
    results,
    limits: { maxBatchSize: MAX_BATCH_SIZE, providerSpacingMs: PROVIDER_SPACING_MS },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTimestamp(value: string | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Vehicle lookup failed.";
  if (/unauthorized|configuration|not configured/i.test(message)) return "AuthBridge gateway configuration error.";
  if (/timeout/i.test(message)) return "AuthBridge request timed out. Retry this vehicle later.";
  return "AuthBridge lookup failed. Retry this vehicle later.";
}
