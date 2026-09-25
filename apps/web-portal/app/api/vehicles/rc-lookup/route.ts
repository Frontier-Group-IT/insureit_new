import { NextResponse } from "next/server";

import { getAuthenticatedProfile } from "@/lib/auth";
import { getServerAccessToken } from "@/lib/auth-server";
import { lookupAuthbridgeRc, normalizeVehicleRegistrationNumber } from "@/lib/authbridge-rc-api";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeFetchedVehicleManufacturer } from "@/lib/vehicle-manufacturer-resolution";
import { isValidVehicleRegistrationNumber } from "@/lib/vehicle-registration";

export const dynamic = "force-dynamic";

const RC_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RC_MAPPER_VERSION = "2026-09-21-v5";
const MAX_DISPLAY_FIELDS = 160;

type RcMappedDetails = {
  registrationNumber: string;
  registrationDate: string | null;
  manufacturer: string | null;
  model: string | null;
  manufacturingYear: string | null;
  vehicleClass: string | null;
  fuelType: string | null;
  engineCapacityCc: string | null;
  seatingCapacity: string | null;
  gvwKg: string | null;
  chassisNumber: string | null;
  engineNumber: string | null;
  fitnessExpiryDate: string | null;
  pucExpiryDate: string | null;
  roadTaxExpiryDate: string | null;
  nationalPermitExpiryDate: string | null;
  localPermitExpiryDate: string | null;
  permitNumber: string | null;
  insuranceCompany: string | null;
  policyNumber: string | null;
  policyStartDate: string | null;
  policyExpiryDate: string | null;
};

type DisplayField = { label: string; value: string };
type DisplaySection = { title: string; fields: DisplayField[] };

type CacheRow = {
  registration_number_normalized: string;
  raw_response: unknown;
  normalized_details: unknown;
  transaction_id: string | null;
  fetched_at: string;
  expires_at: string;
};

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearerAccessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  const accessToken = bearerAccessToken || (await getServerAccessToken()) || "";
  const auth = await getAuthenticatedProfile(accessToken);

  if (!auth.user || !auth.profile?.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canLookup =
    (await hasEffectiveCapability(auth.profile, "create_vehicles", "edit")) ||
    (await hasEffectiveCapability(auth.profile, "view_vehicles", "edit"));

  if (!canLookup) {
    return NextResponse.json({ error: "You do not have permission to fetch RC details." }, { status: 403 });
  }

  let body: { registrationNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const registrationNumber = normalizeVehicleRegistrationNumber(body.registrationNumber ?? "");
  if (!isValidVehicleRegistrationNumber(registrationNumber)) {
    return NextResponse.json({ error: "Enter the complete vehicle registration number." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const now = Date.now();
  let cached: CacheRow | null = null;

  try {
    const { data } = await admin
      .from("vehicle_rc_lookup_cache")
      .select("registration_number_normalized,raw_response,normalized_details,transaction_id,fetched_at,expires_at")
      .eq("registration_number_normalized", registrationNumber)
      .maybeSingle();
    cached = (data as CacheRow | null) ?? null;
  } catch (error) {
    console.warn("vehicle_rc_cache_read_failed", { reason: safeReason(error instanceof Error ? error.message : "cache read failed") });
  }

  if (cached && Date.parse(cached.expires_at) > now && cached.raw_response) {
    const payload = buildSuccessPayload({
      registrationNumber,
      raw: cached.raw_response,
      source: "local_cache",
      isStale: false,
      transactionId: cached.transaction_id,
      lookedUpAt: cached.fetched_at,
    });

    if (mappedFieldCount(payload.details) > 0 || payload.sections.length > 0) {
      void admin
        .from("vehicle_rc_lookup_cache")
        .update({ last_served_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
        .eq("registration_number_normalized", registrationNumber);
      return NextResponse.json(payload);
    }
  }

  try {
    const result = await lookupAuthbridgeRc(registrationNumber);
    const payload = buildSuccessPayload({
      registrationNumber,
      raw: result.data,
      source: "authbridge",
      isStale: false,
      transactionId: result.transactionId ?? null,
      lookedUpAt: normalizeTimestamp(result.lookedUpAt) ?? new Date(now).toISOString(),
    });

    if (mappedFieldCount(payload.details) === 0 && payload.sections.length === 0) {
      return NextResponse.json(
        {
          error: "Vehicle details were returned but could not be matched safely. Please enter the details manually.",
          transactionId: result.transactionId ?? null,
        },
        { status: 422 },
      );
    }

    const fetchedAt = payload.lookedUpAt ?? new Date(now).toISOString();
    const expiresAt = new Date(Date.parse(fetchedAt) + RC_CACHE_TTL_MS).toISOString();
    const { error: cacheError } = await admin.from("vehicle_rc_lookup_cache").upsert(
      {
        registration_number_normalized: registrationNumber,
        provider: "authbridge",
        service_code: "detailed_rc_372",
        raw_response: result.data,
        normalized_details: payload.details,
        transaction_id: result.transactionId ?? null,
        fetched_at: fetchedAt,
        last_served_at: new Date(now).toISOString(),
        expires_at: expiresAt,
        mapper_version: RC_MAPPER_VERSION,
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: "registration_number_normalized" },
    );

    if (cacheError) {
      console.warn("vehicle_rc_cache_write_failed", { reason: safeReason(cacheError.message) });
    }

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vehicle lookup failed.";
    console.warn("vehicle_rc_lookup_failed", {
      user_id: auth.user.id,
      reason: safeReason(message),
    });

    if (cached?.raw_response) {
      const payload = buildSuccessPayload({
        registrationNumber,
        raw: cached.raw_response,
        source: "local_cache",
        isStale: true,
        transactionId: cached.transaction_id,
        lookedUpAt: cached.fetched_at,
      });

      if (mappedFieldCount(payload.details) > 0 || payload.sections.length > 0) {
        void admin
          .from("vehicle_rc_lookup_cache")
          .update({ last_served_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
          .eq("registration_number_normalized", registrationNumber);
        return NextResponse.json(payload);
      }
    }

    return NextResponse.json({ error: userMessage(message) }, { status: 502 });
  }
}

function buildSuccessPayload({
  registrationNumber,
  raw,
  source,
  isStale,
  transactionId,
  lookedUpAt,
}: {
  registrationNumber: string;
  raw: unknown;
  source: "local_cache" | "authbridge";
  isStale: boolean;
  transactionId: string | null;
  lookedUpAt: string | null;
}) {
  return {
    status: "success" as const,
    provider: "authbridge" as const,
    source,
    isStale,
    transactionId,
    lookedUpAt,
    details: mapVehicleDetails(raw, registrationNumber),
    sections: buildDisplaySections(raw),
  };
}

function mapVehicleDetails(raw: unknown, registrationNumber: string): RcMappedDetails {
  const values = flattenPrimitiveValues(raw);
  const policyExpiryDate = toIsoDate(findValue(values, [
    "Insurance To Date/Insurance Upto",
    "Insurance To Date",
    "Insurance Upto",
    "Policy Expiry Date",
    "insuranceexpirydate",
  ]));

  const policyStartDate = toIsoDate(findValue(values, [
    "Insurance From Date",
    "Insurance From",
    "Policy Start Date",
    "Policy From Date",
  ]));

  return {
    registrationNumber,
    registrationDate: toIsoDate(findValue(values, ["Registration Date", "registrationdate", "regdate", "dateofregistration"])),
    manufacturer: normalizeFetchedVehicleManufacturer(cleanText(findValue(values, ["Maker/Manufacturer", "Manufacturer", "Maker", "manufacturername", "makername"]))),
    model: cleanText(findValue(values, ["Model / Makers Class", "Model/Makers Class", "Model", "Makers Class", "vehiclemodel", "variant"])),
    manufacturingYear: toYear(findValue(values, ["Manufacturing Date", "Manufacturing Year", "Month/Year of Manufacture", "mfgyear", "yearofmanufacture"])),
    vehicleClass: mapVehicleClass(cleanText(findValue(values, ["Vehicle Class", "Class of Vehicle", "Vehicle Category", "Vehicle Type", "Body Type"]))),
    fuelType: mapFuel(cleanText(findValue(values, ["Fuel Type", "Fuel", "Fuel Description"]))),
    engineCapacityCc: cleanNumber(findValue(values, ["Cubic Capacity", "Cubic Capacity CC", "Engine Capacity", "Engine Capacity CC", "Engine CC"])),
    seatingCapacity: cleanInteger(findValue(values, ["Seating Capacity", "Seat Capacity", "Number of Seats", "Total Seats"])),
    gvwKg: cleanNumber(findValue(values, ["GVW", "GVW KG", "Gross Vehicle Weight", "Gross Weight"])),
    chassisNumber: cleanCode(findValue(values, ["Chassis Number", "Chassis No", "Chassis"])),
    engineNumber: cleanCode(findValue(values, ["Engine Number", "Engine No", "Engine"])),
    fitnessExpiryDate: toIsoDate(findValue(values, ["Fitness Upto", "Fitness Expiry Date", "Fitness Valid Upto", "Fitness Validity"])),
    pucExpiryDate: toIsoDate(findValue(values, ["PUCC Upto", "PUC Upto", "PUC Expiry Date", "Pollution Upto", "PUC Valid Upto"])),
    roadTaxExpiryDate: toIsoDate(findValue(values, ["Tax Upto", "Road Tax Upto", "Road Tax Expiry Date", "Tax Valid Upto"])),
    nationalPermitExpiryDate: toIsoDate(findValue(values, ["National Permit Upto", "National Permit Expiry Date", "National Permit Valid Upto"])),
    localPermitExpiryDate: toIsoDate(findValue(values, ["Permit Upto", "Permit Expiry Date", "Permit Valid Upto", "Local Permit Upto"])),
    permitNumber: cleanCode(findValue(values, ["Permit Number", "Permit No", "National Permit Number"])),
    insuranceCompany: cleanText(findValue(values, ["Insurance Company", "Insurer", "Insurer Name"])),
    policyNumber: cleanPolicyNumber(findValue(values, ["Policy Number", "Policy No", "Insurance Policy Number"])),
    policyStartDate: policyStartDate ?? derivePolicyStartDate(policyExpiryDate),
    policyExpiryDate,
  };
}

function buildDisplaySections(raw: unknown): DisplaySection[] {
  const root = asRecord(raw);
  if (!root) return [];

  const msg = findRecordByKey(root, "msg") ?? root;
  const sections: DisplaySection[] = [];
  const general: DisplayField[] = [];
  let totalFields = 0;

  for (const [key, value] of Object.entries(msg)) {
    if (totalFields >= MAX_DISPLAY_FIELDS || isTechnicalSecretKey(key)) continue;

    const record = asRecord(value);
    if (record) {
      const fields = flattenDisplayFields(record, "", MAX_DISPLAY_FIELDS - totalFields);
      if (fields.length > 0) {
        sections.push({ title: humanizeLabel(key), fields });
        totalFields += fields.length;
      }
      continue;
    }

    const primitive = normalizeDisplayFieldValue(key, cleanDisplayValue(value));
    if (primitive) {
      general.push({ label: humanizeLabel(key), value: primitive });
      totalFields += 1;
    }
  }

  if (general.length > 0) sections.unshift({ title: "General", fields: general });
  return sections;
}

function flattenDisplayFields(record: Record<string, unknown>, prefix: string, remaining: number) {
  const fields: DisplayField[] = [];

  for (const [key, value] of Object.entries(record)) {
    if (fields.length >= remaining || isTechnicalSecretKey(key)) break;
    const nextLabel = prefix ? `${prefix} · ${humanizeLabel(key)}` : humanizeLabel(key);
    const nested = asRecord(value);

    if (nested) {
      fields.push(...flattenDisplayFields(nested, nextLabel, remaining - fields.length));
      continue;
    }

    if (Array.isArray(value)) {
      const items = value
        .slice(0, 20)
        .map((item) => cleanDisplayValue(item))
        .filter((item): item is string => Boolean(item));
      if (items.length > 0) fields.push({ label: nextLabel, value: items.join(", ") });
      continue;
    }

    const primitive = normalizeDisplayFieldValue(key, cleanDisplayValue(value));
    if (primitive) fields.push({ label: nextLabel, value: primitive });
  }

  return fields;
}

function flattenPrimitiveValues(value: unknown, output = new Map<string, string>(), depth = 0) {
  if (depth > 8 || value == null) return output;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return output;
  }

  if (Array.isArray(value)) {
    value.slice(0, 20).forEach((item) => flattenPrimitiveValues(item, output, depth + 1));
    return output;
  }

  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (typeof nested === "string" || typeof nested === "number" || typeof nested === "boolean") {
        const normalized = normalizeKey(key);
        if (!output.has(normalized)) output.set(normalized, String(nested));
      } else {
        flattenPrimitiveValues(nested, output, depth + 1);
      }
    }
  }

  return output;
}

function findValue(values: Map<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = values.get(normalizeKey(key));
    if (value && isMeaningful(value)) return value.trim();
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function findRecordByKey(record: Record<string, unknown>, target: string) {
  const normalizedTarget = normalizeKey(target);
  for (const [key, value] of Object.entries(record)) {
    if (normalizeKey(key) !== normalizedTarget) continue;
    return asRecord(value);
  }
  return null;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function humanizeLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDisplayFieldValue(key: string, value: string | null) {
  if (!value) return null;
  const normalizedKey = normalizeKey(key);
  if (["makermanufacturer", "manufacturer", "manufacturername", "maker", "makername"].includes(normalizedKey)) {
    return normalizeFetchedVehicleManufacturer(value);
  }
  return value;
}

function cleanDisplayValue(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!isMeaningful(text)) return null;
  return text.slice(0, 500);
}

function isMeaningful(value: string) {
  return Boolean(value.trim()) && !/^(null|undefined|na|n\/a|not available)$/i.test(value.trim());
}

function isTechnicalSecretKey(key: string) {
  const normalized = normalizeKey(key);
  return /(password|secret|token|credential|encrypted|stringencrypted|authorization|username)/.test(normalized);
}

function cleanText(value: string | null) {
  if (!value) return null;
  const next = value.replace(/\s+/g, " ").trim();
  return next && next.length <= 160 ? next : null;
}

function cleanCode(value: string | null) {
  if (!value) return null;
  const next = value.toUpperCase().replace(/[^A-Z0-9/-]/g, "").trim();
  if (!next || /[*X]{4,}/.test(next)) return null;
  return next.slice(0, 120);
}

function cleanPolicyNumber(value: string | null) {
  if (!value) return null;
  const next = value.replace(/\s+/g, "").trim().toUpperCase();
  return next && next.length <= 120 ? next : null;
}

function cleanNumber(value: string | null) {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match?.[0] ?? null;
}

function cleanInteger(value: string | null) {
  const number = cleanNumber(value);
  if (!number) return null;
  const parsed = Number(number);
  return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : null;
}

function toYear(value: string | null) {
  if (!value) return null;
  const match = value.match(/(?:19|20)\d{2}/);
  return match?.[0] ?? null;
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

function mapFuel(value: string | null) {
  if (!value) return null;
  const fuel = value.toLowerCase();
  if (fuel.includes("diesel")) return "Diesel";
  if (fuel.includes("petrol")) return "Petrol";
  if (fuel.includes("cng")) return "CNG";
  if (fuel.includes("electric")) return "Electric";
  if (fuel.includes("hybrid")) return "Hybrid";
  if (fuel.includes("bi") && fuel.includes("fuel")) return "Bi-Fuel";
  return "Other";
}

function mapVehicleClass(value: string | null) {
  if (!value) return null;
  const text = value.toLowerCase();
  if (/(two.?wheeler|motor.?cycle|motorcycle|scooter)/.test(text)) return "TWP";
  if (/(private.?car|motor.?car|private vehicle)/.test(text)) return "PCP";
  if (/(goods|truck|lorry|goods.?carrier|light goods|heavy goods)/.test(text)) return "GCV";
  if (/(passenger|bus|taxi|cab|maxi|omnibus)/.test(text)) return "PCV";
  if (/(construction|plant|machinery|excavator|crane|earth mover)/.test(text)) return "CPM";
  if (/(miscellaneous|special purpose|tractor|trailer)/.test(text)) return "MISD";
  return null;
}

function derivePolicyStartDate(expiryIso: string | null) {
  if (!expiryIso) return null;
  const [year, month, day] = expiryIso.split("-").map(Number);
  if (!year || !month || !day) return null;
  const start = new Date(year - 1, month - 1, day);
  start.setDate(start.getDate() + 1);
  return `${String(start.getFullYear()).padStart(4, "0")}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
}

function mappedFieldCount(details: RcMappedDetails) {
  return Object.entries(details).filter(([key, value]) => key !== "registrationNumber" && Boolean(value)).length;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function userMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("valid vehicle registration")) return "Enter the complete vehicle registration number.";
  if (lower.includes("timed out") || lower.includes("timeout")) return "Vehicle details are taking longer than usual. Please try again.";
  if (lower.includes("not configured") || lower.includes("unauthorized")) return "Vehicle lookup is temporarily unavailable. You can continue manually.";
  return "We could not fetch the vehicle details. You can continue manually.";
}

function safeReason(message: string) {
  return message
    .replace(/[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}/gi, "[rc]")
    .replace(/\d{2}BH\d{4}[A-Z]{2}/gi, "[rc]")
    .slice(0, 160);
}
