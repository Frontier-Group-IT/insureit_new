"use server";

import { requireClaimWorkflowAccess } from "@/lib/claim-workflow-access";
import { normalizeVehicleRegistrationNumber } from "@/lib/authbridge-rc-api";
import { isValidVehicleRegistrationNumber } from "@/lib/vehicle-registration";

type RcDates = Record<"fitness_valid_upto" | "tax_valid_upto" | "insurance_valid_upto" | "pucc_valid_upto" | "local_permit_valid_upto" | "national_permit_valid_upto", string>;
type RcResult = { ok: true; dates: Partial<RcDates>; source: "vehicle_register" | "rc_cache" | "authbridge" | "none"; fetchedAt?: string | null; registrationNumber: string } | { ok: false; message: string };

const fields = {
  fitness_valid_upto: "fitnessExpiryDate",
  tax_valid_upto: "roadTaxExpiryDate",
  insurance_valid_upto: "policyExpiryDate",
  pucc_valid_upto: "pucExpiryDate",
  local_permit_valid_upto: "localPermitExpiryDate",
  national_permit_valid_upto: "nationalPermitExpiryDate",
} as const;

function isoDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const input = value.trim();
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(input);
  const parts = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : (() => {
    match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(input);
    return match ? [Number(match[3]), Number(match[2]), Number(match[1])] : null;
  })();
  if (!parts) return "";
  const [y,m,d] = parts;
  const checked = new Date(Date.UTC(y,m-1,d));
  if (checked.getUTCFullYear() !== y || checked.getUTCMonth() !== m-1 || checked.getUTCDate() !== d) return "";
  return `${String(y).padStart(4,"0")}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}
function normalized(raw: unknown): Record<string,string> {
  const output: Record<string,string> = {};
  function walk(obj: unknown, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 7) return;
    if (Array.isArray(obj)) { for (const entry of obj.slice(0,20)) walk(entry,depth+1); return; }
    for (const [key,value] of Object.entries(obj)) {
      if (typeof value === "string" || typeof value === "number") {
        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g,"");
        if (!(normalizedKey in output)) output[normalizedKey] = String(value);
      } else walk(value,depth+1);
    }
  }
  walk(raw);
  return output;
}
const aliases: Record<keyof RcDates,string[]> = {
  fitness_valid_upto: ["fitnessExpiryDate","Fitness Upto","Fitness Expiry Date","Fitness Valid Upto","Fitness Validity"],
  tax_valid_upto: ["roadTaxExpiryDate","Tax Upto","Road Tax Upto","Tax Valid Upto"],
  insurance_valid_upto: ["policyExpiryDate","Insurance Upto","Insurance To Date","Insurance To Date/Insurance Upto","Insurance Valid Upto","Policy Expiry Date","Insurance Expiry"],
  pucc_valid_upto: ["pucExpiryDate","PUCC Upto","PUC Upto","PUC Expiry Date","Pollution Upto","PUC Valid Upto"],
  local_permit_valid_upto: ["localPermitExpiryDate","Local Permit Upto","Local Permit Valid Upto","Permit Upto","Permit Expiry Date"],
  national_permit_valid_upto: ["nationalPermitExpiryDate","National Permit Upto","National Permit Valid Upto","National Permit Expiry Date"],
};
function mapProvider(raw: unknown): Partial<RcDates> {
  const map = normalized(raw);
  const out: Partial<RcDates> = {};
  for (const field of Object.keys(aliases) as (keyof RcDates)[]) {
    for (const name of aliases[field]) {
      const date = isoDate(map[name.toLowerCase().replace(/[^a-z0-9]/g,"")]);
      if (date) { out[field] = date; break; }
    }
  }
  return out;
}

export async function getClaimRcVerificationDates(claimId: string): Promise<RcResult> {
  try {
    if (!claimId || typeof claimId !== "string") return { ok: false, message: "Missing claim." };
    const { claim, supabase } = await requireClaimWorkflowAccess(claimId, "Not permitted to verify RC for this claim.");
    if (claim.claim_service_mode !== "broker_managed") return { ok: false, message: "This claim is not in the operations verification workflow." };
    const { data: linked, error: claimError } = await supabase.from("claims").select("vehicle_id,customer_id,policy_id,external_policy_id").eq("id",claimId).single();
    if (claimError || !linked?.vehicle_id || linked.customer_id !== claim.customer_id) return { ok: false, message: "Linked claim vehicle could not be confirmed." };
    const { data: vehicle, error: vehicleError } = await supabase.from("vehicles").select("id,customer_id,vehicle_no,fitness_expiry_date,road_tax_expiry_date,puc_expiry_date,local_permit_expiry_date,national_permit_expiry_date").eq("id",linked.vehicle_id).eq("customer_id",claim.customer_id).single();
    if (vehicleError || !vehicle) return { ok: false, message: "Vehicle record was not found." };
    const registrationNumber = normalizeVehicleRegistrationNumber(vehicle.vehicle_no ?? "");
    const dates: Partial<RcDates> = {
      fitness_valid_upto: isoDate(vehicle.fitness_expiry_date),
      tax_valid_upto: isoDate(vehicle.road_tax_expiry_date),
      pucc_valid_upto: isoDate(vehicle.puc_expiry_date),
      local_permit_valid_upto: isoDate(vehicle.local_permit_expiry_date),
      national_permit_valid_upto: isoDate(vehicle.national_permit_expiry_date),
    };
    if (linked.policy_id) {
      const { data: policy } = await supabase.from("policies").select("end_date").eq("id",linked.policy_id).eq("vehicle_id",vehicle.id).eq("customer_id",claim.customer_id).maybeSingle();
      if (policy?.end_date) dates.insurance_valid_upto = isoDate(policy.end_date);
    } else if (linked.external_policy_id) {
      const { data: policy } = await supabase.from("external_policies").select("end_date").eq("id",linked.external_policy_id).eq("vehicle_id",vehicle.id).eq("customer_id",claim.customer_id).maybeSingle();
      if (policy?.end_date) dates.insurance_valid_upto = isoDate(policy.end_date);
    }
    const hasVehicleDates = Object.values(dates).some(Boolean);
    if (!isValidVehicleRegistrationNumber(registrationNumber)) return { ok: true, dates, source: hasVehicleDates ? "vehicle_register" : "none", registrationNumber };
    const { data: cached } = await supabase.from("vehicle_rc_lookup_cache").select("normalized_details,raw_response,fetched_at,expires_at").eq("registration_number_normalized",registrationNumber).maybeSingle();
    // Local vehicle records take priority; cached RC data fills gaps without a charge.
    const cacheDates = mapProvider(cached?.normalized_details ?? cached?.raw_response);
    for (const key of Object.keys(fields) as (keyof RcDates)[]) if (!dates[key] && cacheDates[key]) dates[key] = cacheDates[key];
    return { ok: true, dates, source: hasVehicleDates ? "vehicle_register" : cached ? "rc_cache" : "none", fetchedAt: cached?.fetched_at, registrationNumber };
  } catch (error) {
    console.error("claim_rc_verification_lookup_failed", { reason: error instanceof Error ? error.message.replace(/[A-Z]{2}[0-9A-Z]{6,12}/g,"[redacted]") : "lookup_failed" });
    return { ok: false, message: "RC data could not be retrieved. You can still enter the expiry dates manually." };
  }
}
