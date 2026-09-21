import "server-only";

import { lookupAuthbridgeRc, normalizeVehicleRegistrationNumber } from "@/lib/authbridge-rc-api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeFetchedVehicleManufacturer } from "@/lib/vehicle-manufacturer-resolution";

const RC_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EXTERNAL_MAPPER_VERSION = "external-renewal-2026-09-21-v3";

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
  customer_name: string | null;
  contact_name: string | null;
  account_name: string | null;
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

function exactProviderValue(raw: unknown, path: string[]) {
  let current: unknown = raw;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return primitive(current);
}

function providerValue(raw: unknown, values: Map<string, string>, path: string[], aliases: string[]) {
  const exact = exactProviderValue(raw, path)?.trim();
  if (exact && !/^(null|undefined|na|n\/a)$/i.test(exact)) return exact;
  return pick(values, aliases);
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
    manufacturer: normalizeFetchedVehicleManufacturer(cleanText(value.manufacturer)),
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
  const p = (section: string, key: string, aliases: string[]) =>
    providerValue(raw, values, ["msg", section, key], aliases);

  return {
    registrationNumber,
    registrationDate: toIsoDate(p("Registration Details", "Registration Date", ["registrationdate","regdate","dateofregistration"])),
    rto: cleanText(p("Registration Details", "RTO", ["rto","rtoname"])),
    rcStatus: cleanText(p("Registration Details", "Status", ["rcstatus","registrationstatus"]), 40),
    rcStatusAsOn: toIsoDate(p("Registration Details", "Status As On", ["statusason","rcstatusason"])),
    ownerName: cleanText(p("Owners Details", "Owners Name", ["ownersname","ownername"])),
    ownerSerialNumber: cleanText(
      p("Owners Details", "Owners Number", ["ownersnumber","ownerserialnumber","ownerserialno"]) ??
      p("Vehicle Details", "Owner Serial Number", ["ownerserialnumber","ownerserialno"]),
      20,
    ),
    fatherHusbandName: cleanText(p("Owners Details", "Father Name/Husband Name", ["fathernamehusbandname","fatherhusbandname"])),
    permanentAddress: cleanText(
      p("Owners Details", "Permanent Address", ["permanentaddress","permanantaddress"]) ??
      p("Owners Details", "Split Permanant Address", ["splitpermanantaddress"]),
      300,
    ),
    permanentAddressCity: cleanText(p("Owners Details", "Permanant Address City", ["permanantaddresscity","permanentaddresscity"]), 80),
    permanentAddressDistrict: cleanText(p("Owners Details", "Permanant Address District", ["permanantaddressdistrict","permanentaddressdistrict"]), 80),
    permanentAddressState: cleanText(p("Owners Details", "Permanant Address State", ["permanantaddressstate","permanentaddressstate"]), 80),
    permanentAddressPincode: cleanText(p("Owners Details", "Permanant Address Pincode", ["permanantaddresspincode","permanentaddresspincode"]), 20),
    permanentAddressCountry: cleanText(p("Owners Details", "Permanant Address Country", ["permanantaddresscountry","permanentaddresscountry"]), 80),
    presentAddress: cleanText(
      p("Owners Details", "Present Address", ["presentaddress"]) ??
      p("Owners Details", "Split Present Address", ["splitpresentaddress"]),
      300,
    ),
    presentAddressCity: cleanText(p("Owners Details", "Present Address City", ["presentaddresscity"]), 80),
    presentAddressDistrict: cleanText(p("Owners Details", "Present Address District", ["presentaddressdistrict"]), 80),
    presentAddressState: cleanText(p("Owners Details", "Present Address State", ["presentaddressstate"]), 80),
    presentAddressPincode: cleanText(p("Owners Details", "Present Address Pincode", ["presentaddresspincode"]), 20),
    presentAddressCountry: cleanText(p("Owners Details", "Present Address Country", ["presentaddresscountry"]), 80),
    manufacturer: normalizeFetchedVehicleManufacturer(cleanText(p("Vehicle Details", "Maker/Manufacturer", ["makermanufacturer","manufacturer","maker","vehiclemanufacturer","vehiclemaker"]))),
    model: cleanText(p("Vehicle Details", "Model / Makers Class", ["modelmakersclass","model","modelname","vehiclemodel","variant"])),
    manufactureDate: cleanText(p("Vehicle Details", "Manufacture Date", ["manufacturedate","manufacturingdate"]), 20),
    manufacturingYear: cleanText(
      p("Vehicle Details", "Manufacturing Year", ["manufacturingyear","manufactureyear","mfgyear","yearofmanufacture"]) ??
      (p("Vehicle Details", "Manufacture Date", ["manufacturedate"])?.match(/(\d{4})/)?.[1] ?? null),
      4,
    ),
    vehicleClass: cleanText(p("Vehicle Details", "Vehicle Class", ["vehicleclass","vehicleclassdesc","classofvehicle","vehicletype"]), 80),
    vehicleCategory: cleanText(p("Vehicle Details", "Vehicle Category", ["vehiclecategory"]), 40),
    bodyType: cleanText(p("Vehicle Details", "Body Type", ["bodytype"]), 80),
    color: cleanText(p("Vehicle Details", "Color", ["color","colour"]), 40),
    fuelType: cleanText(p("Vehicle Details", "Fuel Type", ["fueltype","fuel","fueldescription"]), 40),
    normsType: cleanText(p("Vehicle Details", "Norms Type", ["normstype","emissionnorms","bharatstage"]), 80),
    engineNumber: cleanCode(p("Vehicle Details", "Engine Number", ["enginenumber","engineno"])),
    engineCapacityCc: cleanText(p("Vehicle Details", "Engine Capacity", ["enginecapacity","enginecapacitycc","cubiccapacity","cubiccapacitycc","enginecc","cc"]), 40),
    cylinderCount: cleanText(p("Vehicle Details", "No of cylinder", ["noofcylinder","numberofcylinders","cylindercount"]), 20),
    seatingCapacity: cleanText(p("Vehicle Details", "Seating Capacity", ["seatingcapacity","seatcapacity","numberofseats","totalseats"]), 20),
    standingCapacity: cleanText(p("Vehicle Details", "Vehicle Standing Capacity", ["vehiclestandingcapacity","standingcapacity"]), 20),
    sleeperCapacity: cleanText(p("Vehicle Details", "sleeper Capacity", ["sleepercapacity"]), 20),
    wheelBaseMm: cleanText(p("Vehicle Details", "Wheel Base", ["wheelbase"]), 40),
    gvwKg: cleanText(p("Vehicle Details", "Gross Weight", ["grossweight","gvw","gvwkg","grossvehicleweight"]), 40),
    unladenWeightKg: cleanText(p("Vehicle Details", "Unloading Weight", ["unloadingweight","unladenweight","kerbweight"]), 40),
    commercial: cleanText(p("Vehicle Details", "Is Commercial", ["iscommercial","commercial"]), 20),
    chassisNumber: cleanCode(p("Vehicle Details", "Chassis Number", ["chassisnumber","chassisno","chassis"])),
    fitnessExpiryDate: toIsoDate(p("Registration Details", "Fitness Date/RC Expiry Date", ["fitnessdatercexpirydate","fitnessexpirydate","fitnessupto","fitnessvalidupto"])),
    roadTaxExpiryDate: toIsoDate(p("Registration Details", "Tax Upto", ["taxupto","roadtaxexpirydate","taxvalidupto","roadtaxupto"])),
    vehicleTaxUptoDate: toIsoDate(p("Registration Details", "Vehicle Tax Up to", ["vehicletaxupto"])),
    pucNumber: cleanText(p("RC Status", "PUCC NO", ["puccno","pucnumber"]), 80),
    pucExpiryDate: toIsoDate(p("RC Status", "PUCC Upto", ["puccupto","pucexpirydate","pucupto","pucvalidupto","pollutionupto"])),
    permitNumber: cleanText(p("RC Status", "Permit Number", ["permitnumber"]), 80),
    permitType: cleanText(p("RC Status", "Permit Type", ["permittype"]), 80),
    permitIssueDate: toIsoDate(p("RC Status", "Permit Issue Date", ["permitissuedate"])),
    permitValidFrom: toIsoDate(p("RC Status", "Permit Vald From", ["permitvaldfrom","permitvalidfrom"])),
    localPermitExpiryDate: toIsoDate(p("RC Status", "Permit Valid Upto", ["permitvalidupto","localpermitexpirydate","localpermitupto","localpermitvalidupto"])),
    nationalPermitNumber: cleanText(p("RC Status", "National Permit Number", ["nationalpermitnumber"]), 80),
    nationalPermitIssuedBy: cleanText(p("RC Status", "National Permit Issued By", ["nationalpermitissuedby"]), 80),
    nationalPermitExpiryDate: toIsoDate(p("RC Status", "National Permit Upto", ["nationalpermitupto","nationalpermitexpirydate","nationalpermitvalidupto"])),
    financed: cleanText(p("Hypothecation Details", "Financed", ["financed"]), 20),
    financerName: cleanText(p("Hypothecation Details", "Financer Name", ["financername","financiername"])),
    insuranceCompany: cleanText(p("Insurance Details", "Insurance Company", ["insurancecompany","insurer","insurername"])),
    policyNumber: cleanPolicyNumber(p("Insurance Details", "Policy Number", ["policynumber","policyno","insurancepolicynumber"])),
    policyExpiryDate: toIsoDate(p("Insurance Details", "Insurance To Date/Insurance Upto", ["insurancetodateinsuranceupto","insurancetodate","insuranceupto","policyexpirydate","insuranceexpirydate"])),
    blacklistStatus: cleanText(p("Vehicle Details", "Blacklist Status", ["blackliststatus"]), 80),
    nocDetails: cleanText(p("Vehicle Details", "Noc Details", ["nocdetails"]), 80),
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

function nonBlank(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

async function applyRcOwnerNameFallback(
  opportunityId: string,
  details: ExternalRenewalRcDetails,
) {
  const ownerName = cleanText(details.ownerName);
  if (!ownerName) return false;

  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin
    .from("external_renewal_opportunities")
    .select("customer_name,contact_name,account_name,ai_profile_overrides")
    .eq("id", opportunityId)
    .maybeSingle<{
      customer_name: string | null;
      contact_name: string | null;
      account_name: string | null;
      ai_profile_overrides: Record<string, unknown> | null;
    }>();

  if (currentError || !current) {
    throw new Error("Could not verify the current customer name before applying RC owner fallback.");
  }

  const overrideName =
    current.ai_profile_overrides &&
    typeof current.ai_profile_overrides.customerName === "string"
      ? current.ai_profile_overrides.customerName
      : null;

  if (
    nonBlank(overrideName) ||
    nonBlank(current.customer_name) ||
    nonBlank(current.contact_name) ||
    nonBlank(current.account_name)
  ) {
    return false;
  }

  const { error: updateError } = await admin
    .from("external_renewal_opportunities")
    .update({
      customer_name: ownerName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opportunityId);

  if (updateError) {
    throw new Error("Could not apply RC owner name as the customer / insured name.");
  }

  return true;
}

export async function enrichExternalRenewalOpportunity(opportunityId: string) {
  const admin = createSupabaseAdminClient();
  const { data: opportunity, error: opportunityError } = await admin
    .from("external_renewal_opportunities")
    .select("id,registration_no,is_active,customer_name,contact_name,account_name,ai_profile_overrides")
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
      const ownerNameApplied = await applyRcOwnerNameFallback(opportunity.id, details);
      return { status: "ready" as const, source: "local_cache" as const, details, ownerNameApplied };
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
    const ownerNameApplied = await applyRcOwnerNameFallback(opportunity.id, details);
    return { status: "ready" as const, source: "authbridge" as const, details, ownerNameApplied };
  } catch {
    if (cached) {
      const normalized = fromNormalized(cached.normalized_details, registrationNumber);
      const rawDetails = fromRaw(cached.raw_response, registrationNumber);
      const details = mergeDetails(normalized, rawDetails);
      if (usefulFieldCount(details) > 0) {
        await persistOpportunityResult(opportunity.id, "ready", details, "stale_cache", null);
        const ownerNameApplied = await applyRcOwnerNameFallback(opportunity.id, details);
        return { status: "ready" as const, source: "stale_cache" as const, details, ownerNameApplied };
      }
    }

    await persistOpportunityResult(opportunity.id, "failed", null, null, "provider_unavailable");
    throw new Error("RC details could not be fetched right now.");
  }
}
