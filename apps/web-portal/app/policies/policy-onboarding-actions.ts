"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolvePolicyIntermediarySource } from "@/lib/policy-intermediary-source";
import { recordVehicleActivity, VEHICLE_ACTIVITY_ACTIONS } from "@/lib/vehicle-activity";
import { findPolicyOnboardingBusinessConflict, type PolicyBusinessConflict } from "./policy-onboarding-conflicts";

export type PolicyCustomerCandidate = { id: string; name: string; phone: string; city: string | null; state: string | null; phoneMatch: boolean; nameMatch: boolean };
export type PolicyOwnershipConflict = { vehicleId: string; registrationNumber: string; customerId: string; customerName: string; customerPhone: string; canTransfer: boolean };
export type PolicyOnboardingPayload = {
  customer: { name: string; phone: string; type?: string; email?: string; address?: string; city?: string; district?: string; state?: string; pincode?: string; country?: string; source?: string };
  vehicle: Record<string, string | boolean | null | undefined>;
  policy: Record<string, string | null | undefined>;
  premium: Record<string, string | number | boolean | null | undefined>;
  payin: Record<string, string | number | null | undefined>;
  billing: Record<string, string | number | null | undefined>;
  payout: Record<string, string | number | null | undefined>;
  authbridge: Record<string, string | boolean | null | undefined>;
  resolution?: { selectedCustomerId?: string | null; createNewCustomer?: boolean; ownershipDecision?: "keep_existing" | "transfer" | null; transferReason?: string; acceptCoverageGap?: boolean };
};
export type PolicyOnboardingResult =
  | { ok: true; policyId: string; policyCode: string; customerId: string; vehicleId: string; status: "active" }
  | { ok: false; kind: "validation" | "database" | "permission"; error: string }
  | { ok: false; kind: "customer_match"; candidates: PolicyCustomerCandidate[] }
  | { ok: false; kind: "ownership_conflict"; conflict: PolicyOwnershipConflict }
  | { ok: false; kind: "business_conflict"; conflict: PolicyBusinessConflict };

type CustomerRow = { id: string; contact_name: string; phone: string; city: string | null; state: string | null };
type VehicleOwnerRow = { id: string; vehicle_no: string; vehicle_no_normalized: string | null; customer_id: string; customers: { contact_name: string; phone: string } | null };

function normalizedPhone(value: string) { return value.replace(/\D/g, "").slice(-10); }
function normalizedRegistration(value: string) { return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function normalizedVehicleIdentity(value: unknown) { return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function isTemporaryVehicleNumber(value: string | null | undefined) { return /^(?:NEW|PENDING)-/i.test(value?.trim() ?? ""); }
function registrationMode(payload: PolicyOnboardingPayload) { return payload.vehicle.registrationMode === "unregistered" ? "unregistered" : "registered"; }
function cleanName(value: string) { return value.trim().replace(/\s+/g, " "); }
function canTransferVehicle(role: string | null | undefined) { return role === "manager" || role === "admin" || role === "super_admin" || role === "it_super_user"; }
function validDate(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value); }

function numericPayloadValue(value: unknown, integer = false, emptyValue = "") {
  if (value === null || value === undefined || value === "") return emptyValue;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return emptyValue;
    return String(integer ? Math.trunc(value) : value);
  }
  const text = String(value).trim();
  if (!text || /^(na|n\/a|null|undefined|nil|not available)$/i.test(text)) return emptyValue;
  const normalized = text.replace(/,/g, "");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return emptyValue;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return emptyValue;
  return String(integer ? Math.trunc(parsed) : parsed);
}

function sanitizeVehicleNumbers(vehicle: PolicyOnboardingPayload["vehicle"]) {
  return {
    ...vehicle,
    manufacturingYear: numericPayloadValue(vehicle.manufacturingYear, true),
    engineCapacity: numericPayloadValue(vehicle.engineCapacity),
    seatingCapacity: numericPayloadValue(vehicle.seatingCapacity, true),
    standingCapacity: numericPayloadValue(vehicle.standingCapacity, true),
    sleeperCapacity: numericPayloadValue(vehicle.sleeperCapacity, true),
    grossWeight: numericPayloadValue(vehicle.grossWeight),
    unladenWeight: numericPayloadValue(vehicle.unladenWeight),
    wheelBase: numericPayloadValue(vehicle.wheelBase),
    cylinders: numericPayloadValue(vehicle.cylinders, true),
  };
}

function sanitizeFinancialNumbers(payload: PolicyOnboardingPayload) {
  const numberOrZero = (value: unknown) => numericPayloadValue(value, false, "0");
  return {
    policy: { ...payload.policy, idv: numberOrZero(payload.policy.idv) },
    premium: {
      ...payload.premium,
      od: numberOrZero(payload.premium.od),
      tp: numberOrZero(payload.premium.tp),
      cpa: numberOrZero(payload.premium.cpa),
    },
    payin: {
      ...payload.payin,
      odPercent: numberOrZero(payload.payin.odPercent),
      tpPercent: numberOrZero(payload.payin.tpPercent),
      scheme: numberOrZero(payload.payin.scheme),
    },
    billing: { ...payload.billing, billedAmount: numberOrZero(payload.billing.billedAmount) },
    payout: {
      ...payload.payout,
      retention: numberOrZero(payload.payout.retention),
      odPercent: numberOrZero(payload.payout.odPercent),
      tpPercent: numberOrZero(payload.payout.tpPercent),
    },
  };
}

function operationalEntryPayload(payload: PolicyOnboardingPayload, role: string | null | undefined): PolicyOnboardingPayload {
  if (role !== "backoffice_executive") return payload;
  return {
    ...payload,
    payin: { basis: "NET", odPercent: "0", tpPercent: "0", scheme: "0" },
    billing: { billNumber: "", billedAmount: "0", billDate: "", status: "Unbilled" },
    payout: { retention: "0", odPercent: "0", tpPercent: "0", status: "Pending", date: "", voucherNumber: "" },
  };
}

function validatePayload(payload: PolicyOnboardingPayload) {
  const phone = normalizedPhone(payload.customer.phone ?? "");
  const rawRegistration = String(payload.vehicle.registrationNumber ?? "").trim().toUpperCase();
  const registration = normalizedRegistration(rawRegistration);
  const mode = registrationMode(payload);
  const chassis = normalizedVehicleIdentity(payload.vehicle.chassisNumber);
  const engine = normalizedVehicleIdentity(payload.vehicle.engineNumber);
  const name = cleanName(payload.customer.name ?? "");
  const vehicleClass = String(payload.vehicle.classCode ?? "").trim().toUpperCase();
  const make = String(payload.vehicle.make ?? "").trim();
  const model = String(payload.vehicle.model ?? "").trim();
  const fuelType = String(payload.vehicle.fuelType ?? "").trim();
  const manufacturingYear = String(payload.vehicle.manufacturingYear ?? "").trim();
  const capacity = String(payload.vehicle.capacity ?? "").trim();
  const rtoState = String(payload.vehicle.rtoState ?? "").trim();
  const rtoName = String(payload.vehicle.rtoName ?? "").trim();
  const cpaAmount = Number(numericPayloadValue(payload.premium.cpa, false, "0"));
  if (!name) return "Enter the insured/customer name.";
  if (!/^[6-9][0-9]{9}$/.test(phone)) return "Enter a valid 10 digit Indian mobile number.";
  if (mode === "registered" && !/^[A-Z]{2}[A-Z0-9]*[0-9]{2}$/.test(rawRegistration)) return "Enter a valid vehicle registration number starting with 2 letters and ending with 2 digits.";
  if (!vehicleClass) return "Select the vehicle class.";
  if (!make) return "Select the vehicle make.";
  if (!model) return "Enter the vehicle model.";
  if (!fuelType) return "Select the fuel type.";
  if (!manufacturingYear) return "Select the year of manufacturing.";
  if (!capacity) return "Enter the vehicle capacity.";
  if (!chassis) return "Enter the chassis number.";
  if (!engine) return "Enter the engine number.";
  if (!rtoState || !rtoName) return "Enter the RTO state and RTO name/code.";
  if (vehicleClass === "GCV" && (!payload.premium.cpaOpted || !Number.isFinite(cpaAmount) || cpaAmount <= 0)) return "CPA amount is mandatory for GCV policies and must be greater than 0.";
  if (!payload.policy.insuranceCompanyId) return "Select an insurance company.";
  if (!payload.policy.policyNumber) return "Enter the policy number.";
  if (!payload.policy.policyType) return "Select the policy type.";
  if (!validDate(payload.policy.issuanceDate) || !validDate(payload.policy.validFrom) || !validDate(payload.policy.validUpto)) return "Enter valid policy issuance and validity dates.";
  if (String(payload.policy.validUpto) < String(payload.policy.validFrom)) return "Policy Valid Upto cannot be before Valid From.";
  return null;
}
async function findCustomerCandidates(name: string, phone: string) {
  const admin = createSupabaseAdminClient();
  const [phoneResult, nameResult] = await Promise.all([
    admin.from("customers").select("id, contact_name, phone, city, state").eq("phone", phone).limit(10).returns<CustomerRow[]>(),
    admin.from("customers").select("id, contact_name, phone, city, state").ilike("contact_name", name).limit(10).returns<CustomerRow[]>(),
  ]);
  if (phoneResult.error) throw new Error(phoneResult.error.message);
  if (nameResult.error) throw new Error(nameResult.error.message);
  const merged = new Map<string, CustomerRow>();
  for (const row of [...(phoneResult.data ?? []), ...(nameResult.data ?? [])]) merged.set(row.id, row);
  const normalizedName = cleanName(name).toLowerCase();
  return [...merged.values()].map((row) => ({ id: row.id, name: row.contact_name, phone: row.phone, city: row.city, state: row.state, phoneMatch: normalizedPhone(row.phone) === phone, nameMatch: cleanName(row.contact_name).toLowerCase() === normalizedName }));
}
async function findCustomerById(id: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("customers").select("id, contact_name, phone, city, state").eq("id", id).maybeSingle<CustomerRow>();
  if (error) throw new Error(error.message);
  return data;
}
async function findVehicleOwner(registration: string) {
  if (!registration) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("vehicles").select("id, vehicle_no, vehicle_no_normalized, customer_id, customers(contact_name, phone)").eq("vehicle_no_normalized", registration).maybeSingle<VehicleOwnerRow>();
  if (error) throw new Error(error.message);
  return data;
}
async function findVehicleOwnerByChassis(chassis: string) {
  if (!chassis) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("vehicles").select("id, vehicle_no, vehicle_no_normalized, customer_id, customers(contact_name, phone)").eq("chassis_no", chassis).maybeSingle<VehicleOwnerRow>();
  if (error) throw new Error(error.message);
  return data;
}

export async function onboardPolicy(payload: PolicyOnboardingPayload): Promise<PolicyOnboardingResult> {
  const profile = await requirePolicyCreator();
  payload = operationalEntryPayload(payload, profile.role);
  const validationError = validatePayload(payload);
  if (validationError) return { ok: false, kind: "validation", error: validationError };
  const sourceResolution = await resolvePolicyIntermediarySource(payload.policy);
  if (!sourceResolution.ok) return { ok: false, kind: "validation", error: sourceResolution.error };
  payload = { ...payload, policy: { ...payload.policy, ...sourceResolution.source }, customer: { ...payload.customer, source: sourceResolution.source.leadSource } };

  const phone = normalizedPhone(payload.customer.phone);
  const name = cleanName(payload.customer.name);
  const registration = normalizedRegistration(String(payload.vehicle.registrationNumber));
  const mode = registrationMode(payload);
  const chassis = normalizedVehicleIdentity(payload.vehicle.chassisNumber);
  const engine = normalizedVehicleIdentity(payload.vehicle.engineNumber);
  const selectedCustomerId = payload.resolution?.selectedCustomerId?.trim() || null;
  const createNewCustomer = payload.resolution?.createNewCustomer === true;

  try {
    const customerCandidates = await findCustomerCandidates(name, phone);
    const phoneMatches = customerCandidates.filter((candidate) => candidate.phoneMatch);
    const exactNameMatches = customerCandidates.filter((candidate) => candidate.nameMatch);
    const exactCustomerMatches = customerCandidates.filter((candidate) => candidate.phoneMatch && candidate.nameMatch);

    if (!selectedCustomerId && !createNewCustomer && customerCandidates.length) {
      if (phoneMatches.length > 0 && exactNameMatches.length === 0) {
        return {
          ok: false,
          kind: "customer_match",
          candidates: customerCandidates.map((candidate) => candidate.phoneMatch ? { ...candidate, phoneMatch: false } : candidate),
        };
      }
      return { ok: false, kind: "customer_match", candidates: customerCandidates };
    }
    if (createNewCustomer && exactCustomerMatches.length) {
      return { ok: false, kind: "customer_match", candidates: exactCustomerMatches };
    }

    const vehicle = mode === "unregistered" ? await findVehicleOwnerByChassis(chassis) : await findVehicleOwner(registration);
    let effectiveCustomerId = selectedCustomerId;
    const ownershipDecision = payload.resolution?.ownershipDecision ?? null;
    const vehicleDisplay = isTemporaryVehicleNumber(vehicle?.vehicle_no) ? "Registration pending vehicle" : vehicle?.vehicle_no ?? "";

    if (vehicle && effectiveCustomerId && vehicle.customer_id !== effectiveCustomerId && !ownershipDecision) {
      return { ok: false, kind: "ownership_conflict", conflict: { vehicleId: vehicle.id, registrationNumber: vehicleDisplay, customerId: vehicle.customer_id, customerName: vehicle.customers?.contact_name ?? "Existing customer", customerPhone: vehicle.customers?.phone ?? "", canTransfer: canTransferVehicle(profile.role) } };
    }
    if (vehicle && !effectiveCustomerId && createNewCustomer && !ownershipDecision) {
      return { ok: false, kind: "ownership_conflict", conflict: { vehicleId: vehicle.id, registrationNumber: vehicleDisplay, customerId: vehicle.customer_id, customerName: vehicle.customers?.contact_name ?? "Existing customer", customerPhone: vehicle.customers?.phone ?? "", canTransfer: canTransferVehicle(profile.role) } };
    }
    if (vehicle && ownershipDecision === "keep_existing") effectiveCustomerId = vehicle.customer_id;
    if (ownershipDecision === "transfer" && !canTransferVehicle(profile.role)) return { ok: false, kind: "permission", error: "Only a Manager or Administrator can transfer vehicle ownership." };

    let rpcCustomer = { ...payload.customer, name, phone };
    if (effectiveCustomerId) {
      const existingCustomer = await findCustomerById(effectiveCustomerId);
      if (!existingCustomer) return { ok: false, kind: "database", error: "The selected customer is no longer available. Refresh and try again." };
      rpcCustomer = { ...rpcCustomer, name: existingCustomer.contact_name, phone: existingCustomer.phone, email: "", address: "", city: "", district: "", state: "", pincode: "", source: "" };
    }

    const businessConflict = await findPolicyOnboardingBusinessConflict({ payload, acceptCoverageGap: payload.resolution?.acceptCoverageGap === true });
    if (businessConflict) return { ok: false, kind: "business_conflict", conflict: businessConflict };

    const financials = sanitizeFinancialNumbers(payload);
    const rpcPayload = {
      ...payload,
      ...financials,
      customer: rpcCustomer,
      vehicle: { ...sanitizeVehicleNumbers(payload.vehicle), registrationMode: mode, registrationNumber: registration, chassisNumber: chassis, engineNumber: engine },
      resolution: {
        selectedCustomerId: effectiveCustomerId,
        confirmOwnershipTransfer: ownershipDecision === "transfer",
        canTransferOwnership: canTransferVehicle(profile.role),
        transferReason: payload.resolution?.transferReason || "Confirmed during policy onboarding",
      },
      meta: { requestedBy: profile.id, requestedRole: profile.role },
    };

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("onboard_motor_policy", { p_payload: rpcPayload });
    if (error) {
      const message = error.message ?? "";
      const lowerMessage = message.toLowerCase();
      if (message.includes("OWNERSHIP_CONFLICT")) {
        const latestVehicle = mode === "unregistered" ? await findVehicleOwnerByChassis(chassis) : await findVehicleOwner(registration);
        if (latestVehicle) return { ok: false, kind: "ownership_conflict", conflict: { vehicleId: latestVehicle.id, registrationNumber: isTemporaryVehicleNumber(latestVehicle.vehicle_no) ? "Registration pending vehicle" : latestVehicle.vehicle_no, customerId: latestVehicle.customer_id, customerName: latestVehicle.customers?.contact_name ?? "Existing customer", customerPhone: latestVehicle.customers?.phone ?? "", canTransfer: canTransferVehicle(profile.role) } };
        return { ok: false, kind: "database", error: "The vehicle record changed while this form was open. Keep your form open and review the customer and vehicle details." };
      }
      if (lowerMessage.includes("customers_phone_normalized_uidx") || lowerMessage.includes("customers_mobile_unique_idx")) {
        const candidates = await findCustomerCandidates(name, phone);
        if (candidates.length) return { ok: false, kind: "customer_match", candidates };
        return { ok: false, kind: "database", error: "This mobile number is already registered to an existing customer. Review the customer details and try again." };
      }
      if (message.includes("Unknown vehicle manufacturer:")) {
        return { ok: false, kind: "business_conflict", conflict: { type: "manufacturer_unknown", enteredMake: message.split("Unknown vehicle manufacturer:").slice(1).join(":").trim() || String(payload.vehicle.make ?? "") } };
      }
      if (message.includes("POLICY_COVERAGE_OVERLAP") || lowerMessage.includes("policies_policy_no_key") || lowerMessage.includes("policies_insurer_policy_no_uidx")) {
        const conflict = await findPolicyOnboardingBusinessConflict({ payload, acceptCoverageGap: true });
        if (conflict) return { ok: false, kind: "business_conflict", conflict };
      }
      if (lowerMessage.includes("invalid input syntax for type numeric") || lowerMessage.includes("invalid input syntax for type integer")) {
        return { ok: false, kind: "database", error: "Check the vehicle and premium amounts, then try again. Your entered details are still saved on this form." };
      }
      return { ok: false, kind: "database", error: "We couldn't complete the policy booking. Your form is still intact. Review the highlighted details or try again." };
    }

    const result = data as { ok?: boolean; policyId?: string; policyCode?: string; customerId?: string; vehicleId?: string } | null;
    if (!result?.ok || !result.policyId || !result.policyCode || !result.customerId || !result.vehicleId) return { ok: false, kind: "database", error: "We couldn't complete the policy booking. Please try again." };

    await recordVehicleActivity(
      admin,
      result.vehicleId,
      profile.id,
      vehicle ? VEHICLE_ACTIVITY_ACTIONS.VEHICLE_LINKED_TO_POLICY : VEHICLE_ACTIVITY_ACTIONS.VEHICLE_CREATED,
    );

    revalidatePath("/policies"); revalidatePath("/customers"); revalidatePath("/vehicles"); revalidatePath(`/vehicles/${result.vehicleId}/edit`);
    return { ok: true, policyId: result.policyId, policyCode: result.policyCode, customerId: result.customerId, vehicleId: result.vehicleId, status: "active" };
  } catch {
    return { ok: false, kind: "database", error: "We couldn't complete the policy booking. Your entered form details are still intact. Review the details and try again." };
  }
}
