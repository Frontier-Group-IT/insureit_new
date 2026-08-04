"use server";

import { lookupAuthbridgeRc, normalizeVehicleRegistrationNumber } from "@/lib/authbridge-rc-api";

type UnknownRecord = Record<string, unknown>;

export type PolicyRcReview = {
  registrationNumber: string;
  vehicleClass: string | null;
  make: string | null;
  model: string | null;
  fuelType: string | null;
  manufacturingYear: string | null;
  registrationDate: string | null;
  rtoState: string | null;
  rtoName: string | null;
  chassisMasked: string | null;
  engineMasked: string | null;
  transactionId: string | null;
  lookedUpAt: string | null;
};

export type PolicyRcLookupResult =
  | { ok: true; review: PolicyRcReview }
  | { ok: false; error: string };

const aliases = {
  registrationNumber: ["registration_no", "registration_number", "reg_no", "regn_no", "rc_number", "vehicle_number"],
  vehicleClass: ["vehicle_class", "vehicle_class_desc", "vehicle_type", "class_of_vehicle", "body_type"],
  make: ["maker", "maker_description", "manufacturer", "manufacturer_name", "make"],
  model: ["maker_model", "model", "model_name", "vehicle_model"],
  fuelType: ["fuel_type", "fuel", "fuel_description"],
  manufacturingYear: ["manufacturing_date", "manufacturing_month_year", "manufacturing_year", "mfg_year", "year_of_manufacture"],
  registrationDate: ["registration_date", "reg_date", "registered_at"],
  rtoState: ["state", "rto_state", "registration_state"],
  rtoName: ["rto", "rto_name", "registered_at_rto", "registering_authority"],
  chassis: ["chassis_no", "chassis_number", "chassis"],
  engine: ["engine_no", "engine_number", "engine"],
} as const;

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
    if (!output.has(normalized) && (typeof nested === "string" || typeof nested === "number")) output.set(normalized, nested);
    if (nested && typeof nested === "object") flatten(nested, output);
  }
  return output;
}

function pick(map: Map<string, unknown>, candidates: readonly string[]) {
  for (const candidate of candidates) {
    const value = map.get(normalizeKey(candidate));
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function maskSensitive(value: string | null) {
  if (!value) return null;
  const compact = value.replace(/\s/g, "");
  if (compact.length <= 6) return compact.replace(/.(?=.{2})/g, "•");
  return `${compact.slice(0, 3)}${"•".repeat(Math.min(8, compact.length - 6))}${compact.slice(-3)}`;
}

function yearOnly(value: string | null) {
  if (!value) return null;
  const match = value.match(/(?:19|20)\d{2}/);
  return match?.[0] ?? value;
}

export async function lookupPolicyRegistrationRc(registrationNumber: string): Promise<PolicyRcLookupResult> {
  try {
    const response = await lookupAuthbridgeRc(registrationNumber);
    const fields = flatten(response.data);
    const normalizedRegistration = normalizeVehicleRegistrationNumber(
      pick(fields, aliases.registrationNumber) ?? response.registrationNumber ?? registrationNumber,
    );

    return {
      ok: true,
      review: {
        registrationNumber: normalizedRegistration,
        vehicleClass: pick(fields, aliases.vehicleClass),
        make: pick(fields, aliases.make),
        model: pick(fields, aliases.model),
        fuelType: pick(fields, aliases.fuelType),
        manufacturingYear: yearOnly(pick(fields, aliases.manufacturingYear)),
        registrationDate: pick(fields, aliases.registrationDate),
        rtoState: pick(fields, aliases.rtoState),
        rtoName: pick(fields, aliases.rtoName),
        chassisMasked: maskSensitive(pick(fields, aliases.chassis)),
        engineMasked: maskSensitive(pick(fields, aliases.engine)),
        transactionId: response.transactionId ?? null,
        lookedUpAt: response.lookedUpAt ?? null,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to fetch RC details." };
  }
}
