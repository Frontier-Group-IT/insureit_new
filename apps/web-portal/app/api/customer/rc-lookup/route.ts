import { NextResponse } from "next/server";

import { getAuthenticatedProfile } from "@/lib/auth";
import { lookupAuthbridgeRc, normalizeVehicleRegistrationNumber } from "@/lib/authbridge-rc-api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const RC_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RC_MAPPER_VERSION = "2026-09-05-v1";

type SafeVehicleDetails = {
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
};

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
  let cached: CacheRow | null = null;
  try {
    const { data } = await admin
      .from("vehicle_rc_lookup_cache")
      .select("registration_number_normalized,raw_response,normalized_details,transaction_id,fetched_at,expires_at")
      .eq("registration_number_normalized", registrationNumber)
      .maybeSingle();
    cached = (data as CacheRow | null) ?? null;
  } catch (error) {
    console.warn("customer_rc_cache_read_failed", { reason: safeReason(error instanceof Error ? error.message : "cache read failed") });
  }

  const now = Date.now();
  if (cached && Date.parse(cached.expires_at) > now) {
    const details = sanitizeCachedDetails(cached.normalized_details, registrationNumber);
    if (mappedFieldCount(details) > 0) {
      void admin
        .from("vehicle_rc_lookup_cache")
        .update({ last_served_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
        .eq("registration_number_normalized", registrationNumber);
      return NextResponse.json({
        status: "success",
        provider: "authbridge",
        source: "local_cache",
        isStale: false,
        transactionId: cached.transaction_id,
        lookedUpAt: cached.fetched_at,
        details,
      });
    }
  }

  try {
    const result = await lookupAuthbridgeRc(registrationNumber);
    const details = sanitizeVehicleResponse(result.data, registrationNumber);

    if (!mappedFieldCount(details)) {
      return NextResponse.json(
        {
          error: "Vehicle details were returned but could not be matched safely. Please enter the details manually.",
          transactionId: result.transactionId ?? null,
        },
        { status: 422 },
      );
    }

    const fetchedAt = normalizeTimestamp(result.lookedUpAt) ?? new Date(now).toISOString();
    const expiresAt = new Date(Date.parse(fetchedAt) + RC_CACHE_TTL_MS).toISOString();
    const { error: cacheError } = await admin.from("vehicle_rc_lookup_cache").upsert(
      {
        registration_number_normalized: registrationNumber,
        provider: "authbridge",
        service_code: "detailed_rc_372",
        raw_response: result.data,
        normalized_details: details,
        transaction_id: result.transactionId ?? null,
        fetched_at: fetchedAt,
        last_served_at: new Date(now).toISOString(),
        expires_at: expiresAt,
        mapper_version: RC_MAPPER_VERSION,
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: "registration_number_normalized" },
    );
    if (cacheError) console.warn("customer_rc_cache_write_failed", { reason: safeReason(cacheError.message) });

    return NextResponse.json({
      status: "success",
      provider: "authbridge",
      source: "authbridge",
      isStale: false,
      transactionId: result.transactionId ?? null,
      lookedUpAt: fetchedAt,
      details,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vehicle lookup failed.";
    console.warn("customer_rc_lookup_failed", {
      user_id: auth.user.id,
      reason: safeReason(message),
    });

    if (cached) {
      const staleDetails = sanitizeCachedDetails(cached.normalized_details, registrationNumber);
      if (mappedFieldCount(staleDetails) > 0) {
        void admin
          .from("vehicle_rc_lookup_cache")
          .update({ last_served_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
          .eq("registration_number_normalized", registrationNumber);
        return NextResponse.json({
          status: "success",
          provider: "authbridge",
          source: "local_cache",
          isStale: true,
          transactionId: cached.transaction_id,
          lookedUpAt: cached.fetched_at,
          details: staleDetails,
        });
      }
    }

    return NextResponse.json({ error: customerMessage(message) }, { status: 502 });
  }
}

function sanitizeVehicleResponse(raw: unknown, registrationNumber: string): SafeVehicleDetails {
  const values = flattenPrimitiveValues(raw);
  return {
    registrationNumber,
    registrationDate: toIsoDate(findValue(values, ["registrationdate", "regdate", "dateofregistration", "registrationdt"])),
    manufacturer: cleanText(findValue(values, ["manufacturer", "manufacturername", "maker", "makername", "makerdescription", "makerdesc", "vehiclemanufacturer", "vehiclemaker"])),
    model: cleanText(findValue(values, ["model", "modelname", "makermodel", "makermodelname", "vehiclename", "vehiclemodel", "vehiclemodelname", "modeldescription", "modeldesc", "variant", "variantname", "modelvariant", "modelvariantname"])),
    manufacturingYear: toYear(findValue(values, ["manufacturingyear", "manufactureyear", "mfgyear", "yearofmanufacture", "manufacturingdate", "manufacturedate", "monthyearofmanufacture"])),
    vehicleClass: mapVehicleClass(cleanText(findValue(values, ["vehicleclass", "vehicleclassdesc", "vehicleclassdescription", "classofvehicle", "vehiclecategory", "vehicletype", "bodytype"]))),
    fuelType: mapFuel(cleanText(findValue(values, ["fueltype", "fuel", "fueldescription", "fueltypecode"]))),
    engineCapacityCc: cleanNumber(findValue(values, ["cubiccapacity", "cubiccapacitycc", "enginecapacity", "enginecapacitycc", "enginecc", "cc"])),
    seatingCapacity: cleanInteger(findValue(values, ["seatingcapacity", "seatcapacity", "seatingcap", "numberofseats", "totalseats", "seats"])),
    gvwKg: cleanNumber(findValue(values, ["gvw", "gvwkg", "grossvehicleweight", "grossweight", "grossvehicleweightkg"])),
    chassisNumber: cleanCode(findValue(values, ["chassisnumber", "chassisno", "chassis"])),
    engineNumber: cleanCode(findValue(values, ["enginenumber", "engineno", "engine"])),
    fitnessExpiryDate: toIsoDate(findValue(values, ["fitnessexpirydate", "fitnessupto", "fitnessvalidupto", "fitnessvalidity"])),
    pucExpiryDate: toIsoDate(findValue(values, ["pucexpirydate", "puccupto", "pucupto", "pucvalidupto", "pollutionupto", "pollutionvalidupto"])),
    roadTaxExpiryDate: toIsoDate(findValue(values, ["roadtaxexpirydate", "taxupto", "taxvalidupto", "roadtaxupto"])),
    nationalPermitExpiryDate: toIsoDate(findValue(values, ["nationalpermitexpirydate", "nationalpermitupto", "nationalpermitvalidupto"])),
    localPermitExpiryDate: toIsoDate(findValue(values, ["localpermitexpirydate", "localpermitupto", "localpermitvalidupto", "permitupto", "permitvalidupto"])),
  };
}

function sanitizeCachedDetails(raw: unknown, registrationNumber: string): SafeVehicleDetails {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return {
    registrationNumber,
    registrationDate: toIsoDate(toPrimitive(value.registrationDate)),
    manufacturer: cleanText(toPrimitive(value.manufacturer)),
    model: cleanText(toPrimitive(value.model)),
    manufacturingYear: toYear(toPrimitive(value.manufacturingYear)),
    vehicleClass: mapStoredVehicleClass(toPrimitive(value.vehicleClass)),
    fuelType: mapFuel(cleanText(toPrimitive(value.fuelType))),
    engineCapacityCc: cleanNumber(toPrimitive(value.engineCapacityCc)),
    seatingCapacity: cleanInteger(toPrimitive(value.seatingCapacity)),
    gvwKg: cleanNumber(toPrimitive(value.gvwKg)),
    chassisNumber: cleanCode(toPrimitive(value.chassisNumber)),
    engineNumber: cleanCode(toPrimitive(value.engineNumber)),
    fitnessExpiryDate: toIsoDate(toPrimitive(value.fitnessExpiryDate)),
    pucExpiryDate: toIsoDate(toPrimitive(value.pucExpiryDate)),
    roadTaxExpiryDate: toIsoDate(toPrimitive(value.roadTaxExpiryDate)),
    nationalPermitExpiryDate: toIsoDate(toPrimitive(value.nationalPermitExpiryDate)),
    localPermitExpiryDate: toIsoDate(toPrimitive(value.localPermitExpiryDate)),
  };
}

function mappedFieldCount(details: SafeVehicleDetails) {
  return Object.entries(details).filter(([key, value]) => key !== "registrationNumber" && Boolean(value)).length;
}

function isValidIndianRegistrationNumber(value: string) {
  if (/^\d{2}BH\d{4}[A-Z]{2}$/.test(value)) return true;
  return /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(value) && value.length >= 7 && value.length <= 12;
}

function flattenPrimitiveValues(value: unknown, prefix = "", output = new Map<string, string>(), depth = 0) {
  if (depth > 8 || value == null) return output;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (prefix) {
      const key = normalizeKey(prefix);
      if (!output.has(key)) output.set(key, String(value));
    }
    return output;
  }
  if (Array.isArray(value)) {
    value.slice(0, 20).forEach((item, index) => flattenPrimitiveValues(item, `${prefix}${index}`, output, depth + 1));
    return output;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      flattenPrimitiveValues(nested, key, output, depth + 1);
    }
  }
  return output;
}

function findValue(values: Map<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = values.get(normalizeKey(key));
    if (value && value.trim() && !/^(null|undefined|na|n\/a)$/i.test(value.trim())) return value.trim();
  }
  return null;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toPrimitive(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function cleanText(value: string | null) {
  if (!value) return null;
  const next = value.replace(/\s+/g, " ").trim();
  return next && next.length <= 120 ? next : null;
}

function cleanCode(value: string | null) {
  if (!value) return null;
  const next = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!next || /[*X]{4,}/.test(next)) return null;
  return next.slice(0, 80);
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
  if (fuel === "other") return "Other";
  return "Other";
}

function mapStoredVehicleClass(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return ["PCP", "TWP", "GCV", "PCV", "MISD", "CPM"].includes(normalized) ? normalized : mapVehicleClass(value);
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

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function customerMessage(message: string) {
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
