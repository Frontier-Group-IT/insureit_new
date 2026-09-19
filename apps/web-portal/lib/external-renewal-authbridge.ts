import "server-only";

import { lookupAuthbridgeRc, normalizeVehicleRegistrationNumber } from "@/lib/authbridge-rc-api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const RC_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EXTERNAL_MAPPER_VERSION = "external-renewal-2026-09-19-v2";

export type ExternalRenewalRcDetails = {
  registrationNumber: string;
  registrationDate: string | null;
  rto: string | null;
  rcStatus: string | null;
  rcStatusAsOn: string | null;
  ownerName: string | null;
  ownerSerialNumber: string | null;
  fatherHusbandName: string | null;
  permanentAddress: string | null;
  permanentAddressCity: string | null;
  permanentAddressDistrict: string | null;
  permanentAddressState: string | null;
  permanentAddressPincode: string | null;
  permanentAddressCountry: string | null;
  presentAddress: string | null;
  presentAddressCity: string | null;
  presentAddressDistrict: string | null;
  presentAddressState: string | null;
  presentAddressPincode: string | null;
  presentAddressCountry: string | null;
  manufacturer: string | null;
  model: string | null;
  manufactureDate: string | null;
  manufacturingYear: string | null;
  vehicleClass: string | null;
  vehicleCategory: string | null;
  bodyType: string | null;
  color: string | null;
  fuelType: string | null;
  normsType: string | null;
  engineNumber: string | null;
  engineCapacityCc: string | null;
  cylinderCount: string | null;
  seatingCapacity: string | null;
  standingCapacity: string | null;
  sleeperCapacity: string | null;
  wheelBaseMm: string | null;
  gvwKg: string | null;
  unladenWeightKg: string | null;
  commercial: string | null;
  chassisNumber: string | null;
  fitnessExpiryDate: string | null;
  roadTaxExpiryDate: string | null;
  vehicleTaxUptoDate: string | null;
  pucNumber: string | null;
  pucExpiryDate: string | null;
  permitNumber: string | null;
  permitType: string | null;
  permitIssueDate: string | null;
  permitValidFrom: string | null;
  localPermitExpiryDate: string | null;
  nationalPermitNumber: string | null;
  nationalPermitIssuedBy: string | null;
  nationalPermitExpiryDate: string | null;
  financed: string | null;
  financerName: string | null;
  insuranceCompany: string | null;
  policyNumber: string | null;
  policyExpiryDate: string | null;
  blacklistStatus: string | null;
  nocDetails: string | null;
};

type OpportunityRow = {
  id: string;
  registration_no: string | null;
  is_active: boolean;
  ai_profile_overrides: Record<string, unknown> | null;
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
    rto: cleanText(value.rto),
    rcStatus: cleanText(value.rcStatus, 40),
    rcStatusAsOn: toIsoDate(value.rcStatusAsOn),
    ownerName: cleanText(value.ownerName),
    ownerSerialNumber: cleanText(value.ownerSerialNumber, 20),
    fatherHusbandName: cleanText(value.fatherHusbandName),
    permanentAddress: cleanText(value.permanentAddress, 300),
    permanentAddressCity: cleanText(value.permanentAddressCity, 80),
    permanentAddressDistrict: cleanText(value.permanentAddressDistrict, 80),
    permanentAddressState: cleanText(value.permanentAddressState, 80),
    permanentAddressPincode: cleanText(value.permanentAddressPincode, 20),
    permanentAddressCountry: cleanText(value.permanentAddressCountry, 80),
    presentAddress: cleanText(value.presentAddress, 300),
    presentAddressCity: cleanText(value.presentAddressCity, 80),
    presentAddressDistrict: cleanText(value.presentAddressDistrict, 80),
    presentAddressState: cleanText(value.presentAddressState, 80),
    presentAddressPincode: cleanText(value.presentAddressPincode, 20),
    presentAddressCountry: cleanText(value.presentAddressCountry, 80),
    manufacturer: cleanText(value.manufacturer),
    model: cleanText(value.model),
    manufactureDate: cleanText(value.manufactureDate, 20),
    manufacturingYear: cleanText(value.manufacturingYear, 4),
    vehicleClass: cleanText(value.vehicleClass, 80),
    vehicleCategory: cleanText(value.vehicleCategory, 40),
    bodyType: cleanText(value.bodyType, 80),
    color: cleanText(value.color, 40),
    fuelType: cleanText(value.fuelType, 40),
    normsType: cleanText(value.normsType, 80),
    engineNumber: cleanCode(value.engineNumber),
    engineCapacityCc: cleanText(value.engineCapacityCc, 40),
    cylinderCount: cleanText(value.cylinderCount, 20),
    seatingCapacity: cleanText(value.seatingCapacity, 20),
    standingCapacity: cleanText(value.standingCapacity, 20),
    sleeperCapacity: cleanText(value.sleeperCapacity, 20),
    wheelBaseMm: cleanText(value.wheelBaseMm, 40),
    gvwKg: cleanText(value.gvwKg, 40),
    unladenWeightKg: cleanText(value.unladenWeightKg, 40),
    commercial: cleanText(value.commercial, 20),
    chassisNumber: cleanCode(value.chassisNumber),
    fitnessExpiryDate: toIsoDate(value.fitnessExpiryDate),
    roadTaxExpiryDate: toIsoDate(value.roadTaxExpiryDate),
    vehicleTaxUptoDate: toIsoDate(value.vehicleTaxUptoDate),
    pucNumber: cleanText(value.pucNumber, 80),
    pucExpiryDate: toIsoDate(value.pucExpiryDate),
    permitNumber: cleanText(value.permitNumber, 80),
    permitType: cleanText(value.permitType, 80),
    permitIssueDate: toIsoDate(value.permitIssueDate),
    permitValidFrom: toIsoDate(value.permitValidFrom),
    localPermitExpiryDate: toIsoDate(value.localPermitExpiryDate),
    nationalPermitNumber: cleanText(value.nationalPermitNumber, 80),
    nationalPermitIssuedBy: cleanText(value.nationalPermitIssuedBy, 80),
    nationalPermitExpiryDate: toIsoDate(value.nationalPermitExpiryDate),
    financed: cleanText(value.financed, 20),
    financerName: cleanText(value.financerName),
    insuranceCompany: cleanText(value.insuranceCompany),
    policyNumber: cleanPolicyNumber(value.policyNumber),
    policyExpiryDate: toIsoDate(value.policyExpiryDate),
    blacklistStatus: cleanText(value.blacklistStatus, 80),
    nocDetails: cleanText(value.nocDetails, 80),
  };
}
function fromRaw(raw: unknown, registrationNumber: string): ExternalRenewalRcDetails {
  const values = flatten(raw);
  return {
    registrationNumber,
    registrationDate: toIsoDate(pick(values, ["registrationdate","regdate","dateofregistration"])),
    rto: cleanText(pick(values, ["rto","rtoname"])),
    rcStatus: cleanText(pick(values, ["status","rcstatus"]), 40),
    rcStatusAsOn: toIsoDate(pick(values, ["statusason","rcstatusason"])),
    ownerName: cleanText(pick(values, ["ownersname","ownername"])),
    ownerSerialNumber: cleanText(pick(values, ["ownersnumber","ownerserialnumber","ownerserialno"]), 20),
    fatherHusbandName: cleanText(pick(values, ["fathernamehusbandname","fatherhusbandname"])),
    permanentAddress: cleanText(pick(values, ["permanentaddress","splitpermanantaddress","permanantaddress"]), 300),
    permanentAddressCity: cleanText(pick(values, ["permanantaddresscity","permanentaddresscity"]), 80),
    permanentAddressDistrict: cleanText(pick(values, ["permanantaddressdistrict","permanentaddressdistrict"]), 80),
    permanentAddressState: cleanText(pick(values, ["permanantaddressstate","permanentaddressstate"]), 80),
    permanentAddressPincode: cleanText(pick(values, ["permanantaddresspincode","permanentaddresspincode"]), 20),
    permanentAddressCountry: cleanText(pick(values, ["permanantaddresscountry","permanentaddresscountry"]), 80),
    presentAddress: cleanText(pick(values, ["presentaddress","splitpresentaddress"]), 300),
    presentAddressCity: cleanText(pick(values, ["presentaddresscity"]), 80),
    presentAddressDistrict: cleanText(pick(values, ["presentaddressdistrict"]), 80),
    presentAddressState: cleanText(pick(values, ["presentaddressstate"]), 80),
    presentAddressPincode: cleanText(pick(values, ["presentaddresspincode"]), 20),
    presentAddressCountry: cleanText(pick(values, ["presentaddresscountry"]), 80),
    manufacturer: cleanText(pick(values, ["makermanufacturer","manufacturer","maker","vehiclemanufacturer","vehiclemaker"])),
    model: cleanText(pick(values, ["modelmakersclass","model","modelname","vehiclemodel","variant"])),
    manufactureDate: cleanText(pick(values, ["manufacturedate","manufacturingdate"]), 20),
    manufacturingYear: cleanText(pick(values, ["manufacturingyear","manufactureyear","mfgyear","yearofmanufacture"]), 4),
    vehicleClass: cleanText(pick(values, ["vehicleclass","vehicleclassdesc","classofvehicle","vehicletype"]), 80),
    vehicleCategory: cleanText(pick(values, ["vehiclecategory"]), 40),
    bodyType: cleanText(pick(values, ["bodytype"]), 80),
    color: cleanText(pick(values, ["color","colour"]), 40),
    fuelType: cleanText(pick(values, ["fueltype","fuel","fueldescription"]), 40),
    normsType: cleanText(pick(values, ["normstype","emissionnorms","bharatstage"]), 80),
    engineNumber: cleanCode(pick(values, ["enginenumber","engineno"])),
    engineCapacityCc: cleanText(pick(values, ["enginecapacity","enginecapacitycc","cubiccapacity","cubiccapacitycc","enginecc","cc"]), 40),
    cylinderCount: cleanText(pick(values, ["noofcylinder","numberofcylinders","cylindercount"]), 20),
    seatingCapacity: cleanText(pick(values, ["seatingcapacity","seatcapacity","numberofseats","totalseats"]), 20),
    standingCapacity: cleanText(pick(values, ["vehiclestandingcapacity","standingcapacity"]), 20),
    sleeperCapacity: cleanText(pick(values, ["sleepercapacity"]), 20),
    wheelBaseMm: cleanText(pick(values, ["wheelbase"]), 40),
    gvwKg: cleanText(pick(values, ["grossweight","gvw","gvwkg","grossvehicleweight"]), 40),
    unladenWeightKg: cleanText(pick(values, ["unloadingweight","unladenweight","kerbweight"]), 40),
    commercial: cleanText(pick(values, ["iscommercial","commercial"]), 20),
    chassisNumber: cleanCode(pick(values, ["chassisnumber","chassisno","chassis"])),
    fitnessExpiryDate: toIsoDate(pick(values, ["fitnessdatercexpirydate","fitnessexpirydate","fitnessupto","fitnessvalidupto"])),
    roadTaxExpiryDate: toIsoDate(pick(values, ["taxupto","roadtaxexpirydate","taxvalidupto","roadtaxupto"])),
    vehicleTaxUptoDate: toIsoDate(pick(values, ["vehicletaxupto"])),
    pucNumber: cleanText(pick(values, ["puccno","pucnumber"]), 80),
    pucExpiryDate: toIsoDate(pick(values, ["puccupto","pucexpirydate","pucupto","pucvalidupto","pollutionupto"])),
    permitNumber: cleanText(pick(values, ["permitnumber"]), 80),
    permitType: cleanText(pick(values, ["permittype"]), 80),
    permitIssueDate: toIsoDate(pick(values, ["permitissuedate"])),
    permitValidFrom: toIsoDate(pick(values, ["permitvaldfrom","permitvalidfrom"])),
    localPermitExpiryDate: toIsoDate(pick(values, ["permitvalidupto","localpermitexpirydate","localpermitupto","localpermitvalidupto"])),
    nationalPermitNumber: cleanText(pick(values, ["nationalpermitnumber"]), 80),
    nationalPermitIssuedBy: cleanText(pick(values, ["nationalpermitissuedby"]), 80),
    nationalPermitExpiryDate: toIsoDate(pick(values, ["nationalpermitupto","nationalpermitexpirydate","nationalpermitvalidupto"])),
    financed: cleanText(pick(values, ["financed"]), 20),
    financerName: cleanText(pick(values, ["financername","financiername"])),
    insuranceCompany: cleanText(pick(values, ["insurancecompany","insurer","insurername"])),
    policyNumber: cleanPolicyNumber(pick(values, ["policynumber","policyno","insurancepolicynumber"])),
    policyExpiryDate: toIsoDate(pick(values, ["insurancetodateinsuranceupto","insurancetodate","insuranceupto","policyexpirydate","insuranceexpirydate"])),
    blacklistStatus: cleanText(pick(values, ["blackliststatus"]), 80),
    nocDetails: cleanText(pick(values, ["nocdetails"]), 80),
  };
}
function mergeDetails(
  preferred: ExternalRenewalRcDetails,
  fallback: ExternalRenewalRcDetails,
): ExternalRenewalRcDetails {
  const result = { ...preferred } as Record<string, unknown>;
  for (const [key, value] of Object.entries(fallback)) {
    if (result[key] == null || result[key] === "") result[key] = value;
  }
  return result as ExternalRenewalRcDetails;
}
function usefulFieldCount(details: ExternalRenewalRcDetails) {
  return Object.entries(details)
    .filter(([key, value]) => key !== "registrationNumber" && value != null && value !== "")
    .length;
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
    .select("id,registration_no,is_active,ai_profile_overrides")
    .eq("id", opportunityId)
    .maybeSingle<OpportunityRow>();

  if (opportunityError || !opportunity || !opportunity.is_active) throw new Error("External renewal opportunity is unavailable.");

  const overrideRegistration =
    opportunity.ai_profile_overrides && typeof opportunity.ai_profile_overrides.registrationNumber === "string"
      ? opportunity.ai_profile_overrides.registrationNumber
      : null;
  const registrationNumber = normalizeVehicleRegistrationNumber(overrideRegistration ?? opportunity.registration_no ?? "");
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
    const rawDetails = fromRaw(cached.raw_response, registrationNumber);
    const details = mergeDetails(normalized, rawDetails);

    await admin
      .from("vehicle_rc_lookup_cache")
      .update({
        normalized_details: details,
        mapper_version: EXTERNAL_MAPPER_VERSION,
        last_served_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
      })
      .eq("registration_number_normalized", registrationNumber);

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
      const rawDetails = fromRaw(cached.raw_response, registrationNumber);
      const details = mergeDetails(normalized, rawDetails);
      if (usefulFieldCount(details) > 0) {
        await persistOpportunityResult(opportunity.id, "ready", details, "stale_cache", null);
        return { status: "ready" as const, source: "stale_cache" as const, details };
      }
    }

    await persistOpportunityResult(opportunity.id, "failed", null, null, "provider_unavailable");
    throw new Error("RC details could not be fetched right now.");
  }
}
