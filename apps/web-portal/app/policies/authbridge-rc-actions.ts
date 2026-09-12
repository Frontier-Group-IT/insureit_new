"use server";

import { requirePolicyCreator } from "@/lib/policy-access-server";
import { lookupAuthbridgeRc, normalizeVehicleRegistrationNumber } from "@/lib/authbridge-rc-api";
import { classifyAuthbridgeResponse } from "@/lib/authbridge-rc-bulk";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isValidVehicleRegistrationNumber } from "@/lib/vehicle-registration";

type UnknownRecord = Record<string, unknown>;

type PolicyRcCacheRow = {
  raw_response: unknown;
  transaction_id: string | null;
  fetched_at: string;
  expires_at: string;
};

const RC_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const POLICY_RC_CACHE_MAPPER_VERSION = "2026-09-13-policy-v1";

export type PolicyRcReview = {
  registrationNumber: string;
  registrationDate: string | null;
  registrationStatus: string | null;
  statusAsOn: string | null;
  fitnessExpiryDate: string | null;
  taxUpto: string | null;
  rtoName: string | null;
  rtoState: string | null;
  ownerName: string | null;
  ownerSerialNumber: string | null;
  ownerCity: string | null;
  ownerDistrict: string | null;
  ownerState: string | null;
  ownerPincode: string | null;
  permanentAddress: string | null;
  presentAddress: string | null;
  mobileNumber: string | null;
  vehicleClass: string | null;
  vehicleCategory: string | null;
  bodyType: string | null;
  make: string | null;
  model: string | null;
  fuelType: string | null;
  manufactureDate: string | null;
  manufacturingYear: string | null;
  engineCapacity: string | null;
  seatingCapacity: string | null;
  standingCapacity: string | null;
  sleeperCapacity: string | null;
  grossWeight: string | null;
  unladenWeight: string | null;
  wheelBase: string | null;
  cylinders: string | null;
  color: string | null;
  normsType: string | null;
  isCommercial: string | null;
  chassisNumber: string | null;
  engineNumber: string | null;
  financed: string | null;
  financerName: string | null;
  insuranceCompany: string | null;
  insurancePolicyNumber: string | null;
  insuranceUpto: string | null;
  permitIssueDate: string | null;
  permitNumber: string | null;
  permitType: string | null;
  permitValidFrom: string | null;
  permitValidUpto: string | null;
  nationalPermitIssuedBy: string | null;
  nationalPermitNumber: string | null;
  nationalPermitUpto: string | null;
  pucNumber: string | null;
  pucUpto: string | null;
  nonUseStatus: string | null;
  nonUseFrom: string | null;
  nonUseTo: string | null;
  blacklistStatus: string | null;
  transactionId: string | null;
  providerTransactionId: string | null;
  lookedUpAt: string | null;
};

export type PolicyRcLookupResult =
  | { ok: true; review: PolicyRcReview }
  | { ok: false; error: string };

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(source: UnknownRecord, key: string) {
  const value = source[key];
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function yearOnly(value: string | null) {
  return value?.match(/(?:19|20)\d{2}/)?.[0] ?? null;
}

function stateFromRto(value: string | null) {
  if (!value) return null;
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.at(-1) ?? null : null;
}

function normalizeTimestamp(value: string | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function buildPolicyRcReview(
  raw: unknown,
  fallbackRegistrationNumber: string,
  transactionId: string | null,
  lookedUpAt: string | null,
): PolicyRcReview | null {
  const root = record(raw);
  const msg = record(root.msg);
  const registration = record(msg["Registration Details"]);
  const vehicle = record(msg["Vehicle Details"]);
  const owner = record(msg["Owners Details"]);
  const insurance = record(msg["Insurance Details"]);
  const finance = record(msg["Hypothecation Details"]);
  const rcStatus = record(msg["RC Status"]);

  const hasUsablePayload = [registration, vehicle, owner, insurance, finance, rcStatus]
    .some((section) => Object.keys(section).length > 0);
  if (!hasUsablePayload) return null;

  const rtoName = text(registration, "RTO");
  const manufactureDate = text(vehicle, "Manufacture Date");
  const normalizedRegistration = normalizeVehicleRegistrationNumber(
    text(registration, "Registration Number") ?? text(vehicle, "Vehicle Number") ?? fallbackRegistrationNumber,
  );

  return {
    registrationNumber: normalizedRegistration,
    registrationDate: text(registration, "Registration Date"),
    registrationStatus: text(registration, "Status"),
    statusAsOn: text(registration, "Status As On"),
    fitnessExpiryDate: text(registration, "Fitness Date/RC Expiry Date"),
    taxUpto: text(registration, "Vehicle Tax Up to") ?? text(registration, "Tax Upto"),
    rtoName,
    rtoState: stateFromRto(rtoName) ?? text(owner, "Present Address State") ?? text(owner, "Permanant Address State"),
    ownerName: text(owner, "Owners Name"),
    ownerSerialNumber: text(owner, "Owners Number") ?? text(vehicle, "Owner Serial Number"),
    ownerCity: text(owner, "Present Address City") ?? text(owner, "Permanant Address City"),
    ownerDistrict: text(owner, "Present Address District") ?? text(owner, "Permanant Address District"),
    ownerState: text(owner, "Present Address State") ?? text(owner, "Permanant Address State"),
    ownerPincode: text(owner, "Present Address Pincode") ?? text(owner, "Permanant Address Pincode"),
    permanentAddress: text(owner, "Permanent Address") ?? text(owner, "Split Permanant Address"),
    presentAddress: text(owner, "Present Address") ?? text(owner, "Split Present Address"),
    mobileNumber: text(vehicle, "Mobile Number"),
    vehicleClass: text(vehicle, "Vehicle Class"),
    vehicleCategory: text(vehicle, "Vehicle Category"),
    bodyType: text(vehicle, "Body Type"),
    make: text(vehicle, "Maker/Manufacturer"),
    model: text(vehicle, "Model / Makers Class"),
    fuelType: text(vehicle, "Fuel Type"),
    manufactureDate,
    manufacturingYear: yearOnly(manufactureDate),
    engineCapacity: text(vehicle, "Engine Capacity"),
    seatingCapacity: text(vehicle, "Seating Capacity"),
    standingCapacity: text(vehicle, "Vehicle Standing Capacity"),
    sleeperCapacity: text(vehicle, "sleeper Capacity"),
    grossWeight: text(vehicle, "Gross Weight"),
    unladenWeight: text(vehicle, "Unloading Weight"),
    wheelBase: text(vehicle, "Wheel Base"),
    cylinders: text(vehicle, "No of cylinder"),
    color: text(vehicle, "Color"),
    normsType: text(vehicle, "Norms Type"),
    isCommercial: text(vehicle, "Is Commercial"),
    chassisNumber: text(vehicle, "Chassis Number"),
    engineNumber: text(vehicle, "Engine Number"),
    financed: text(finance, "Financed"),
    financerName: text(finance, "Financer Name"),
    insuranceCompany: text(insurance, "Insurance Company"),
    insurancePolicyNumber: text(insurance, "Policy Number"),
    insuranceUpto: text(insurance, "Insurance To Date/Insurance Upto"),
    permitIssueDate: text(rcStatus, "Permit Issue Date"),
    permitNumber: text(rcStatus, "Permit Number"),
    permitType: text(rcStatus, "Permit Type"),
    permitValidFrom: text(rcStatus, "Permit Vald From"),
    permitValidUpto: text(rcStatus, "Permit Valid Upto"),
    nationalPermitIssuedBy: text(rcStatus, "National Permit Issued By"),
    nationalPermitNumber: text(rcStatus, "National Permit Number"),
    nationalPermitUpto: text(rcStatus, "National Permit Upto"),
    pucNumber: text(rcStatus, "PUCC NO"),
    pucUpto: text(rcStatus, "PUCC Upto"),
    nonUseStatus: text(rcStatus, "Non Use Status"),
    nonUseFrom: text(rcStatus, "Non Use From"),
    nonUseTo: text(rcStatus, "Non Use To"),
    blacklistStatus: text(vehicle, "Blacklist Status"),
    transactionId,
    providerTransactionId: text(root, "ts_transaction_id"),
    lookedUpAt,
  };
}

export async function lookupPolicyRegistrationRc(registrationNumber: string): Promise<PolicyRcLookupResult> {
  await requirePolicyCreator();

  const normalizedRegistration = normalizeVehicleRegistrationNumber(registrationNumber);
  if (!isValidVehicleRegistrationNumber(normalizedRegistration)) {
    return { ok: false, error: "Please enter a valid registration number." };
  }

  const admin = createSupabaseAdminClient();
  const now = Date.now();
  let cached: PolicyRcCacheRow | null = null;

  try {
    const { data, error } = await admin
      .from("vehicle_rc_lookup_cache")
      .select("raw_response,transaction_id,fetched_at,expires_at")
      .eq("registration_number_normalized", normalizedRegistration)
      .maybeSingle<PolicyRcCacheRow>();
    if (error) {
      console.warn("policy_rc_cache_read_failed", { reason: "cache_read_failed" });
    } else {
      cached = data ?? null;
    }
  } catch {
    console.warn("policy_rc_cache_read_failed", { reason: "cache_read_failed" });
  }

  if (cached?.raw_response && Date.parse(cached.expires_at) > now) {
    const cachedOutcome = classifyAuthbridgeResponse(cached.raw_response);
    if (cachedOutcome === "no_data") {
      void admin
        .from("vehicle_rc_lookup_cache")
        .update({ last_served_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
        .eq("registration_number_normalized", normalizedRegistration);
      return { ok: false, error: "No RC details were found for this registration number." };
    }
    if (cachedOutcome === "success") {
      const review = buildPolicyRcReview(
        cached.raw_response,
        normalizedRegistration,
        cached.transaction_id,
        cached.fetched_at,
      );
      if (review) {
        void admin
          .from("vehicle_rc_lookup_cache")
          .update({ last_served_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
          .eq("registration_number_normalized", normalizedRegistration);
        return { ok: true, review };
      }
    }
  }

  try {
    const response = await lookupAuthbridgeRc(normalizedRegistration);
    const raw = response.data;
    const outcome = classifyAuthbridgeResponse(raw);
    const fetchedAt = normalizeTimestamp(response.lookedUpAt) ?? new Date(now).toISOString();
    const expiresAt = new Date(Date.parse(fetchedAt) + RC_CACHE_TTL_MS).toISOString();

    if (outcome === "success" || outcome === "no_data") {
      const { error: cacheError } = await admin.from("vehicle_rc_lookup_cache").upsert(
        {
          registration_number_normalized: normalizedRegistration,
          provider: "authbridge",
          service_code: "detailed_rc_372",
          raw_response: raw,
          normalized_details: {},
          transaction_id: response.transactionId ?? null,
          fetched_at: fetchedAt,
          last_served_at: new Date().toISOString(),
          expires_at: expiresAt,
          mapper_version: POLICY_RC_CACHE_MAPPER_VERSION,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "registration_number_normalized" },
      );
      if (cacheError) console.warn("policy_rc_cache_write_failed", { reason: "cache_write_failed" });
    }

    if (outcome === "no_data") {
      return { ok: false, error: "No RC details were found for this registration number." };
    }
    if (outcome !== "success") {
      return { ok: false, error: "Vehicle details could not be fetched right now. Please verify the registration number and try again." };
    }

    const review = buildPolicyRcReview(
      raw,
      normalizedRegistration,
      response.transactionId ?? null,
      fetchedAt,
    );
    if (!review) {
      return { ok: false, error: "Vehicle details were returned but could not be mapped safely. Please verify the registration number and try again." };
    }

    return { ok: true, review };
  } catch {
    return { ok: false, error: "Vehicle details could not be fetched right now. Please verify the registration number and try again." };
  }
}
