"use server";

import { lookupAuthbridgeRc, normalizeVehicleRegistrationNumber } from "@/lib/authbridge-rc-api";

type UnknownRecord = Record<string, unknown>;

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
  permitNumber: string | null;
  permitType: string | null;
  permitValidFrom: string | null;
  permitValidUpto: string | null;
  nationalPermitNumber: string | null;
  nationalPermitUpto: string | null;
  pucNumber: string | null;
  pucUpto: string | null;
  blacklistStatus: string | null;
  transactionId: string | null;
  providerTransactionId: string | null;
  lookedUpAt: string | null;
};

export type PolicyRcLookupResult =
  | { ok: true; review: PolicyRcReview }
  | { ok: false; error: string };

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function flatten(value: unknown, output = new Map<string, unknown>()) {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const item of value) flatten(item, output);
    return output;
  }
  for (const [key, nested] of Object.entries(value as UnknownRecord)) {
    const normalized = normalizeKey(key);
    if (!output.has(normalized) && (typeof nested === "string" || typeof nested === "number" || typeof nested === "boolean")) output.set(normalized, nested);
    if (nested && typeof nested === "object") flatten(nested, output);
  }
  return output;
}

function pick(map: Map<string, unknown>, ...candidates: string[]) {
  for (const candidate of candidates) {
    const value = map.get(normalizeKey(candidate));
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return null;
}

function yearOnly(value: string | null) {
  if (!value) return null;
  const match = value.match(/(?:19|20)\d{2}/);
  return match?.[0] ?? null;
}

function stateFromRto(value: string | null) {
  if (!value) return null;
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.at(-1) ?? null : null;
}

export async function lookupPolicyRegistrationRc(registrationNumber: string): Promise<PolicyRcLookupResult> {
  try {
    const response = await lookupAuthbridgeRc(registrationNumber);
    const fields = flatten(response.data);
    const rtoName = pick(fields, "RTO", "rto_name", "registering_authority");
    const manufactureDate = pick(fields, "Manufacture Date", "manufacturing_date", "manufacturing_month_year");
    const normalizedRegistration = normalizeVehicleRegistrationNumber(
      pick(fields, "Registration Number", "Vehicle Number", "registration_no", "vehicle_number") ?? response.registrationNumber ?? registrationNumber,
    );

    return {
      ok: true,
      review: {
        registrationNumber: normalizedRegistration,
        registrationDate: pick(fields, "Registration Date", "reg_date"),
        registrationStatus: pick(fields, "Status", "rc_status"),
        statusAsOn: pick(fields, "Status As On", "status_date"),
        fitnessExpiryDate: pick(fields, "Fitness Date/RC Expiry Date", "fitness_upto", "rc_expiry_date"),
        taxUpto: pick(fields, "Vehicle Tax Up to", "Tax Upto", "tax_upto"),
        rtoName,
        rtoState: stateFromRto(rtoName) ?? pick(fields, "Present Address State", "Permanant Address State", "rto_state"),
        ownerName: pick(fields, "Owners Name", "Owner Name"),
        ownerSerialNumber: pick(fields, "Owners Number", "Owner Serial Number"),
        vehicleClass: pick(fields, "Vehicle Class", "vehicle_class"),
        vehicleCategory: pick(fields, "Vehicle Category", "vehicle_category"),
        bodyType: pick(fields, "Body Type", "body_type"),
        make: pick(fields, "Maker/Manufacturer", "manufacturer", "maker"),
        model: pick(fields, "Model / Makers Class", "maker_model", "model"),
        fuelType: pick(fields, "Fuel Type", "fuel_type"),
        manufactureDate,
        manufacturingYear: yearOnly(manufactureDate),
        engineCapacity: pick(fields, "Engine Capacity", "cubic_capacity", "cc"),
        seatingCapacity: pick(fields, "Seating Capacity", "seating_capacity"),
        standingCapacity: pick(fields, "Vehicle Standing Capacity", "standing_capacity"),
        sleeperCapacity: pick(fields, "sleeper Capacity", "sleeper_capacity"),
        grossWeight: pick(fields, "Gross Weight", "gross_vehicle_weight", "gvw"),
        unladenWeight: pick(fields, "Unloading Weight", "Unladen Weight", "unladen_weight"),
        wheelBase: pick(fields, "Wheel Base", "wheel_base"),
        cylinders: pick(fields, "No of cylinder", "number_of_cylinders"),
        color: pick(fields, "Color", "vehicle_color"),
        normsType: pick(fields, "Norms Type", "emission_norms"),
        isCommercial: pick(fields, "Is Commercial", "is_commercial"),
        chassisNumber: pick(fields, "Chassis Number", "chassis_no", "chassis_number"),
        engineNumber: pick(fields, "Engine Number", "engine_no", "engine_number"),
        financed: pick(fields, "Financed", "is_financed"),
        financerName: pick(fields, "Financer Name", "financier_name"),
        insuranceCompany: pick(fields, "Insurance Company", "insurance_company"),
        insurancePolicyNumber: pick(fields, "Policy Number", "insurance_policy_number"),
        insuranceUpto: pick(fields, "Insurance To Date/Insurance Upto", "insurance_upto"),
        permitNumber: pick(fields, "Permit Number", "permit_number"),
        permitType: pick(fields, "Permit Type", "permit_type"),
        permitValidFrom: pick(fields, "Permit Vald From", "Permit Valid From", "permit_valid_from"),
        permitValidUpto: pick(fields, "Permit Valid Upto", "permit_valid_upto"),
        nationalPermitNumber: pick(fields, "National Permit Number", "national_permit_number"),
        nationalPermitUpto: pick(fields, "National Permit Upto", "national_permit_upto"),
        pucNumber: pick(fields, "PUCC NO", "puc_number"),
        pucUpto: pick(fields, "PUCC Upto", "puc_upto"),
        blacklistStatus: pick(fields, "Blacklist Status", "blacklist_status"),
        transactionId: response.transactionId ?? null,
        providerTransactionId: pick(fields, "ts_transaction_id"),
        lookedUpAt: response.lookedUpAt ?? null,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to fetch RC details." };
  }
}
