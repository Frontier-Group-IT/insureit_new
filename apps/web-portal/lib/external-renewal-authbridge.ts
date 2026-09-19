import "server-only";

import { lookupAuthbridgeRc, normalizeVehicleRegistrationNumber } from "@/lib/authbridge-rc-api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const RC_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EXTERNAL_MAPPER_VERSION = "external-renewal-2026-09-18-v1";

export type ExternalRenewalRcDetails = {
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
  fitnessExpiryDate: string | null;
  pucExpiryDate: string | null;
  roadTaxExpiryDate: string | null;
  nationalPermitExpiryDate: string | null;
  localPermitExpiryDate: string | null;
  insuranceCompany: string | null;
  policyNumber: string | null;
  policyExpiryDate: string | null;
};

type OpportunityRow = {
  id: string;
  registration_no: string | null;
  is_active: boolean;
};

type CacheRow = {
  raw_response: unknown;
  normalized_details: unknown;
  transaction_id: string | null;
  fetched_at: string;
  expires_at: string;
};

function primitive(value: unknown) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : null;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function flatten(value: unknown, output = new Map<string, string>(), depth = 0) {
  if (depth > 8 || value == null) return output;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 20)) flatten(item, output, depth + 1);
    return output;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const v = primitive(nested);
      if (v && v.trim() && !/^(null|undefined|na|n\/a)$/i.test(v.trim()) && !output.has(normalizeKey(key))) {
        output.set(normalizeKey(key), v.trim());
      }
      if (nested && typeof nested === "object") flatten(nested, output, depth + 1);
    }
  }
  return output;
}

function pick(values: Map<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = values.get(normalizeKey(key));
    if (value) return value;
  }
  return null;
}

function cleanText(value: unknown, max = 120) {
  const v = primitive(value)?.replace(/\s+/g, " ").trim() ?? "";
  return v && v.length <= max ? v : null;
}

function cleanCode(value: unknown) {
  const v = primitive(value)?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
  return v && !/[*X]{4,}/.test(v) ? v.slice(0, 80) : null;
}

function cleanPolicyNumber(value: unknown) {
  const v = primitive(value)?.replace(/\s+/g, "").trim().toUpperCase() ?? "";
  return v && v.length <= 120 ? v : null;
}

function toIsoDate(value: unknown) {
  const text = primitive(value)?.trim();
  if (!text) return null;
  let match = text.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (match) return validIso(match[1], match[2], match[3]);
  match = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
  return match ? validIso(match[3], match[2], match[1]) : null;
}

function validIso(year: string, month: string, day: string) {
  const y = Number(year), m = Number(month), d = Number(day);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${String(y).padStart(4,"0")}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function fromNormalized(raw: unknown, registrationNumber: string): ExternalRenewalRcDetails {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return {
    registrationNumber,
    registrationDate: toIsoDate(value.registrationDate),
    manufacturer: cleanText(value.manufacturer),
    model: cleanText(value.model),
    manufacturingYear: cleanText(value.manufacturingYear, 4),
    vehicleClass: cleanText(value.vehicleClass, 40),
    fuelType: cleanText(value.fuelType, 40),
    engineCapacityCc: cleanText(value.engineCapacityCc, 40),
    seatingCapacity: cleanText(value.seatingCapacity, 20),
    gvwKg: cleanText(value.gvwKg, 40),
    chassisNumber: cleanCode(value.chassisNumber),
    fitnessExpiryDate: toIsoDate(value.fitnessExpiryDate),
    pucExpiryDate: toIsoDate(value.pucExpiryDate),
    roadTaxExpiryDate: toIsoDate(value.roadTaxExpiryDate),
    nationalPermitExpiryDate: toIsoDate(value.nationalPermitExpiryDate),
    localPermitExpiryDate: toIsoDate(value.localPermitExpiryDate),
    insuranceCompany: cleanText(value.insuranceCompany),
    policyNumber: cleanPolicyNumber(value.policyNumber),
    policyExpiryDate: toIsoDate(value.policyExpiryDate),
  };
}

function fromRaw(raw: unknown, registrationNumber: string): ExternalRenewalRcDetails {
  const values = flatten(raw);
  return {
    registrationNumber,
    registrationDate: toIsoDate(pick(values, ["registrationdate","regdate","dateofregistration"])),
    manufacturer: cleanText(pick(values, ["makermanufacturer","manufacturer","maker","vehiclemanufacturer","vehiclemaker"])),
    model: cleanText(pick(values, ["modelmakersclass","model","modelname","vehiclemodel","variant"])),
    manufacturingYear: cleanText(pick(values, ["manufacturingyear","manufactureyear","mfgyear","yearofmanufacture"]), 4),
    vehicleClass: cleanText(pick(values, ["vehicleclass","vehicleclassdesc","classofvehicle","vehiclecategory","vehicletype","bodytype"]), 40),
    fuelType: cleanText(pick(values, ["fueltype","fuel","fueldescription"]), 40),
    engineCapacityCc: cleanText(pick(values, ["cubiccapacity","cubiccapacitycc","enginecapacity","enginecapacitycc","enginecc","cc"]), 40),
    seatingCapacity: cleanText(pick(values, ["seatingcapacity","seatcapacity","numberofseats","totalseats"]), 20),
    gvwKg: cleanText(pick(values, ["gvw","gvwkg","grossvehicleweight","grossweight"]), 40),
    chassisNumber: cleanCode(pick(values, ["chassisnumber","chassisno","chassis"])),
    fitnessExpiryDate: toIsoDate(pick(values, ["fitnessexpirydate","fitnessupto","fitnessvalidupto"])),
    pucExpiryDate: toIsoDate(pick(values, ["pucexpirydate","puccupto","pucupto","pucvalidupto","pollutionupto"])),
    roadTaxExpiryDate: toIsoDate(pick(values, ["roadtaxexpirydate","taxupto","taxvalidupto","roadtaxupto"])),
    nationalPermitExpiryDate: toIsoDate(pick(values, ["nationalpermitexpirydate","nationalpermitupto","nationalpermitvalidupto"])),
    localPermitExpiryDate: toIsoDate(pick(values, ["localpermitexpirydate","localpermitupto","localpermitvalidupto","permitupto","permitvalidupto"])),
    insuranceCompany: cleanText(pick(values, ["insurancecompany","insurer","insurername"])),
    policyNumber: cleanPolicyNumber(pick(values, ["policynumber","policyno","insurancepolicynumber"])),
    policyExpiryDate: toIsoDate(pick(values, ["insurancetodateinsuranceupto","insurancetodate","insuranceupto","policyexpirydate","insuranceexpirydate"])),
  };
}

function usefulFieldCount(details: ExternalRenewalRcDetails) {
  return [
    details.manufacturer, details.model, details.chassisNumber, details.insuranceCompany, details.policyNumber,
    details.policyExpiryDate, details.registrationDate, details.manufacturingYear, details.vehicleClass, details.fuelType,
  ].filter(Boolean).length;
}

async function persistOpportunityResult(
  opportunityId: string,
  status: "ready" | "no_data" | "failed",
  details: ExternalRenewalRcDetails | null,
  source: "local_cache" | "authbridge" | "stale_cache" | null,
  errorCode: string | null,
) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("external_renewal_opportunities")
    .update({
      rc_enrichment_status: status,
      rc_enrichment_source: source,
      rc_enrichment_details: details ?? {},
      rc_enriched_at: new Date().toISOString(),
      rc_enrichment_error_code: errorCode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opportunityId);
  if (error) throw new Error("Could not save RC enrichment state.");
}

export async function enrichExternalRenewalOpportunity(opportunityId: string) {
  const admin = createSupabaseAdminClient();
  const { data: opportunity, error: opportunityError } = await admin
    .from("external_renewal_opportunities")
    .select("id,registration_no,is_active")
    .eq("id", opportunityId)
    .maybeSingle<OpportunityRow>();

  if (opportunityError || !opportunity || !opportunity.is_active) throw new Error("External renewal opportunity is unavailable.");

  const registrationNumber = normalizeVehicleRegistrationNumber(opportunity.registration_no ?? "");
  if (!registrationNumber) {
    await persistOpportunityResult(opportunity.id, "failed", null, null, "missing_registration");
    throw new Error("RC number is required before fetching vehicle details.");
  }

  let cached: CacheRow | null = null;
  const { data: cacheData } = await admin
    .from("vehicle_rc_lookup_cache")
    .select("raw_response,normalized_details,transaction_id,fetched_at,expires_at")
    .eq("registration_number_normalized", registrationNumber)
    .maybeSingle<CacheRow>();
  cached = cacheData ?? null;

  const now = Date.now();
  if (cached && Date.parse(cached.expires_at) > now) {
    const normalized = fromNormalized(cached.normalized_details, registrationNumber);
    const details = usefulFieldCount(normalized) > 0 ? normalized : fromRaw(cached.raw_response, registrationNumber);
    if (usefulFieldCount(details) > 0) {
      await persistOpportunityResult(opportunity.id, "ready", details, "local_cache", null);
      return { status: "ready" as const, source: "local_cache" as const, details };
    }

    await persistOpportunityResult(opportunity.id, "no_data", details, "local_cache", "no_usable_fields");
    return { status: "no_data" as const, source: "local_cache" as const, details };
  }

  try {
    const result = await lookupAuthbridgeRc(registrationNumber);
    const details = fromRaw(result.data, registrationNumber);
    const fetchedAt = result.lookedUpAt ?? new Date(now).toISOString();
    const expiresAt = new Date(Date.parse(fetchedAt) + RC_CACHE_TTL_MS).toISOString();
    await admin.from("vehicle_rc_lookup_cache").upsert({
      registration_number_normalized: registrationNumber,
      provider: "authbridge",
      service_code: "detailed_rc_372",
      raw_response: result.data ?? {},
      normalized_details: details,
      transaction_id: result.transactionId ?? null,
      fetched_at: fetchedAt,
      last_served_at: new Date(now).toISOString(),
      expires_at: expiresAt,
      mapper_version: EXTERNAL_MAPPER_VERSION,
      updated_at: new Date(now).toISOString(),
    }, { onConflict: "registration_number_normalized" });

    if (!usefulFieldCount(details)) {
      await persistOpportunityResult(opportunity.id, "no_data", details, "authbridge", "no_usable_fields");
      return { status: "no_data" as const, source: "authbridge" as const, details };
    }

    await persistOpportunityResult(opportunity.id, "ready", details, "authbridge", null);
    return { status: "ready" as const, source: "authbridge" as const, details };
  } catch {
    if (cached) {
      const normalized = fromNormalized(cached.normalized_details, registrationNumber);
      const details = usefulFieldCount(normalized) > 0 ? normalized : fromRaw(cached.raw_response, registrationNumber);
      if (usefulFieldCount(details) > 0) {
        await persistOpportunityResult(opportunity.id, "ready", details, "stale_cache", null);
        return { status: "ready" as const, source: "stale_cache" as const, details };
      }
    }

    await persistOpportunityResult(opportunity.id, "failed", null, null, "provider_unavailable");
    throw new Error("RC details could not be fetched right now.");
  }
}
