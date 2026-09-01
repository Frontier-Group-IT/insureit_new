"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyIntakeFinalizer } from "@/lib/policy-intake-server";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolvePolicyIntermediarySource } from "@/lib/policy-intermediary-source";
import { recordVehicleActivity, VEHICLE_ACTIVITY_ACTIONS } from "@/lib/vehicle-activity";
import { isValidVehicleRegistrationNumber, normalizeVehicleRegistrationNumber } from "@/lib/vehicle-registration";
import { findPolicyOnboardingBusinessConflict, type PolicyBusinessConflict } from "./policy-onboarding-conflicts";

export type PolicyCustomerCandidate = { id: string; name: string; phone: string; city: string | null; state: string | null; phoneMatch: boolean; nameMatch: boolean };
export type PolicyOwnershipConflict = { vehicleId: string; registrationNumber: string; customerId: string; customerName: string; customerPhone: string; canTransfer: boolean };
export type PolicyExistingVehicleSelection = {
  vehicleId: string;
  customerId: string;
  registrationNo: string;
  insuredName: string;
  phoneNo: string;
  vehicleClass: string;
  make: string;
  model: string;
  fuelType: string;
  manufacturingYear: string;
  capacity: string;
  chassisNo: string;
  engineNo: string;
  rtoState: string;
  rtoName: string;
};
export type PolicyOnboardingPayload = {
  customer: { name: string; phone: string; type?: string; email?: string; address?: string; city?: string; district?: string; state?: string; pincode?: string; country?: string; source?: string };
  vehicle: Record<string, string | boolean | null | undefined>;
  policy: Record<string, string | null | undefined>;
  premium: Record<string, string | number | boolean | null | undefined>;
  payin: Record<string, string | number | boolean | null | undefined>;
  billing: Record<string, string | number | null | undefined>;
  payout: Record<string, string | number | boolean | null | undefined>;
  authbridge: Record<string, string | boolean | null | undefined>;
  resolution?: {
    selectedCustomerId?: string | null;
    selectedExistingVehicleId?: string | null;
    createNewCustomer?: boolean;
    ownershipDecision?: "keep_existing" | "transfer" | null;
    transferReason?: string;
    acceptCoverageGap?: boolean;
    acceptActivePolicyNotice?: boolean;
    acceptExpiredPolicyHistory?: boolean;
    confirmPolicyReplacement?: boolean;
    replacementPolicyId?: string | null;
    replacementReason?: string;
    replacementEffectiveDate?: string;
  };
  sourceIntakeId?: string;
  draftRevision?: number;
};
export type PolicyOnboardingResult =
  | { ok: true; policyId: string; policyCode: string; customerId: string; vehicleId: string; status: "active" }
  | { ok: false; kind: "validation" | "database" | "permission"; error: string }
  | { ok: false; kind: "customer_match"; candidates: PolicyCustomerCandidate[] }
  | { ok: false; kind: "ownership_conflict"; conflict: PolicyOwnershipConflict }
  | { ok: false; kind: "business_conflict"; conflict: PolicyBusinessConflict };

type CustomerRow = { id: string; contact_name: string; phone: string; city: string | null; state: string | null };
type VehicleOwnerRow = { id: string; vehicle_no: string; vehicle_no_normalized: string | null; customer_id: string; customers: { contact_name: string; phone: string } | null };
type ExistingVehicleRow = {
  id: string;
  customer_id: string;
  vehicle_no: string;
  vehicle_no_normalized: string | null;
  vehicle_type: string | null;
  vehicle_class_code: string | null;
  vehicle_class_description: string | null;
  vehicle_category: string | null;
  body_type: string | null;
  is_commercial: boolean | null;
  make: string | null;
  model: string | null;
  fuel_type: string | null;
  color: string | null;
  manufacture_date: string | null;
  year: number | null;
  engine_capacity_cc: number | null;
  seating_capacity: number | null;
  standing_capacity: number | null;
  sleeper_capacity: number | null;
  gvw_kg: number | null;
  unladen_weight_kg: number | null;
  wheel_base_mm: number | null;
  cylinders: number | null;
  chassis_no: string | null;
  engine_no: string | null;
  emission_norm: string | null;
  registration_date: string | null;
  registration_status: string | null;
  registration_status_as_on: string | null;
  rto_name: string | null;
  rto_state: string | null;
  fitness_expiry_date: string | null;
  road_tax_expiry_date: string | null;
  puc_no: string | null;
  puc_expiry_date: string | null;
  permit_no: string | null;
  permit_type: string | null;
  permit_valid_from: string | null;
  local_permit_expiry_date: string | null;
  national_permit_no: string | null;
  national_permit_expiry_date: string | null;
  financed: boolean | null;
  financer_name: string | null;
  blacklist_status: string | null;
  customers: {
    contact_name: string;
    phone: string;
    address: string | null;
    city: string | null;
    district: string | null;
    state: string | null;
    pincode: string | null;
    country: string | null;
    source: string | null;
  } | null;
};

function normalizedPhone(value: string) { return value.replace(/\D/g, "").slice(-10); }
function normalizedRegistration(value: string) { return normalizeVehicleRegistrationNumber(value); }
function normalizedVehicleIdentity(value: unknown) { return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function isTemporaryVehicleNumber(value: string | null | undefined) { return /^(?:NEW|PENDING)-/i.test(value?.trim() ?? ""); }
function registrationMode(payload: PolicyOnboardingPayload) { return payload.vehicle.registrationMode === "unregistered" ? "unregistered" : "registered"; }
function cleanName(value: string) { return value.trim().replace(/\s+/g, " "); }
function canTransferVehicle(role: string | null | undefined) { return role === "manager" || role === "admin" || role === "super_admin" || role === "it_super_user"; }
function canReplaceActivePolicy(role: string | null | undefined) { return role === "manager" || role === "admin" || role === "super_admin" || role === "it_super_user"; }
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
  const isThirdParty = String(payload.policy.policyType ?? "").trim().toUpperCase() === "THIRD PARTY";
  return {
    policy: { ...payload.policy, idv: isThirdParty ? "0" : numberOrZero(payload.policy.idv) },
    premium: {
      ...payload.premium,
      od: isThirdParty ? "0" : numberOrZero(payload.premium.od),
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
    payin: { basis: "NET", odPercent: "0", tpPercent: "0", scheme: "0", provided: false },
    billing: { billNumber: "", billedAmount: "0", billDate: "", status: "Unbilled" },
    payout: { retention: "0", odPercent: "0", tpPercent: "0", status: "Pending", date: "", voucherNumber: "", provided: false },
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
  if (mode === "registered" && !isValidVehicleRegistrationNumber(rawRegistration)) return "Enter a valid vehicle registration number.";
  if (!vehicleClass) return "Select the vehicle class.";
  if (!make) return "Select the vehicle make.";
  if (!model) return "Enter the vehicle model.";
  if (!fuelType) return "Select the fuel type.";
  if (!manufacturingYear) return "Select the year of manufacturing.";
  if (!capacity) return "Enter the vehicle capacity.";
  if (!chassis) return "Enter the chassis number.";
  if (!engine) return "Enter the engine number.";
  if (vehicleClass !== "CPM" && (!rtoState || !rtoName)) return "Enter the RTO state and RTO name/code.";
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

const EXISTING_VEHICLE_SELECT = "id,customer_id,vehicle_no,vehicle_no_normalized,vehicle_type,vehicle_class_code,vehicle_class_description,vehicle_category,body_type,is_commercial,make,model,fuel_type,color,manufacture_date,year,engine_capacity_cc,seating_capacity,standing_capacity,sleeper_capacity,gvw_kg,unladen_weight_kg,wheel_base_mm,cylinders,chassis_no,engine_no,emission_norm,registration_date,registration_status,registration_status_as_on,rto_name,rto_state,fitness_expiry_date,road_tax_expiry_date,puc_no,puc_expiry_date,permit_no,permit_type,permit_valid_from,local_permit_expiry_date,national_permit_no,national_permit_expiry_date,financed,financer_name,blacklist_status,customers(contact_name,phone,address,city,district,state,pincode,country,source)";

async function findExistingVehicleById(vehicleId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("vehicles")
    .select(EXISTING_VEHICLE_SELECT)
    .eq("id", vehicleId)
    .maybeSingle<ExistingVehicleRow>();
  if (error) throw new Error(error.message);
  return data;
}

function existingVehicleCapacity(vehicle: ExistingVehicleRow) {
  const vehicleClass = String(vehicle.vehicle_class_code ?? vehicle.vehicle_type ?? "").trim().toUpperCase();
  if (vehicleClass === "PCP" || vehicleClass === "TWP") return vehicle.engine_capacity_cc == null ? "" : String(vehicle.engine_capacity_cc);
  if (vehicleClass === "PCV") return vehicle.seating_capacity == null ? "" : String(vehicle.seating_capacity);
  if (vehicleClass === "GCV" || vehicleClass === "CPM") return vehicle.gvw_kg == null ? "" : String(vehicle.gvw_kg);
  if (vehicle.engine_capacity_cc != null) return String(vehicle.engine_capacity_cc);
  if (vehicle.gvw_kg != null) return String(vehicle.gvw_kg);
  return "";
}

function existingVehicleSelection(vehicle: ExistingVehicleRow): PolicyExistingVehicleSelection {
  return {
    vehicleId: vehicle.id,
    customerId: vehicle.customer_id,
    registrationNo: vehicle.vehicle_no,
    insuredName: vehicle.customers?.contact_name ?? "",
    phoneNo: vehicle.customers?.phone ?? "",
    vehicleClass: String(vehicle.vehicle_class_code ?? vehicle.vehicle_type ?? "").trim().toUpperCase(),
    make: vehicle.make ?? "",
    model: vehicle.model ?? "",
    fuelType: vehicle.fuel_type ?? "",
    manufacturingYear: vehicle.year == null ? "" : String(vehicle.year),
    capacity: existingVehicleCapacity(vehicle),
    chassisNo: vehicle.chassis_no ?? "",
    engineNo: vehicle.engine_no ?? "",
    rtoState: vehicle.rto_state ?? "",
    rtoName: vehicle.rto_name ?? "",
  };
}

function applyCanonicalExistingVehicle(payload: PolicyOnboardingPayload, vehicle: ExistingVehicleRow): PolicyOnboardingPayload {
  const selection = existingVehicleSelection(vehicle);
  return {
    ...payload,
    customer: {
      ...payload.customer,
      name: selection.insuredName,
      phone: selection.phoneNo,
      address: vehicle.customers?.address ?? "",
      city: vehicle.customers?.city ?? "",
      district: vehicle.customers?.district ?? "",
      state: vehicle.customers?.state ?? "",
      pincode: vehicle.customers?.pincode ?? "",
      country: vehicle.customers?.country ?? "India",
      source: vehicle.customers?.source ?? payload.customer.source,
    },
    vehicle: {
      ...payload.vehicle,
      registrationMode: "registered",
      registrationNumber: vehicle.vehicle_no,
      classCode: selection.vehicleClass,
      classDescription: vehicle.vehicle_class_description ?? "",
      category: vehicle.vehicle_category ?? "",
      bodyType: vehicle.body_type ?? "",
      isCommercial: vehicle.is_commercial,
      make: selection.make,
      model: selection.model,
      fuelType: selection.fuelType,
      color: vehicle.color ?? "",
      manufactureDate: vehicle.manufacture_date ?? "",
      manufacturingYear: selection.manufacturingYear,
      capacity: selection.capacity,
      engineCapacity: vehicle.engine_capacity_cc == null ? "" : String(vehicle.engine_capacity_cc),
      seatingCapacity: vehicle.seating_capacity == null ? "" : String(vehicle.seating_capacity),
      standingCapacity: vehicle.standing_capacity == null ? "" : String(vehicle.standing_capacity),
      sleeperCapacity: vehicle.sleeper_capacity == null ? "" : String(vehicle.sleeper_capacity),
      grossWeight: vehicle.gvw_kg == null ? "" : String(vehicle.gvw_kg),
      unladenWeight: vehicle.unladen_weight_kg == null ? "" : String(vehicle.unladen_weight_kg),
      wheelBase: vehicle.wheel_base_mm == null ? "" : String(vehicle.wheel_base_mm),
      cylinders: vehicle.cylinders == null ? "" : String(vehicle.cylinders),
      chassisNumber: selection.chassisNo,
      engineNumber: selection.engineNo,
      normsType: vehicle.emission_norm ?? "",
      registrationDate: vehicle.registration_date ?? "",
      registrationStatus: vehicle.registration_status ?? "",
      statusAsOn: vehicle.registration_status_as_on ?? "",
      rtoName: selection.rtoName,
      rtoState: selection.rtoState,
      fitnessExpiryDate: vehicle.fitness_expiry_date ?? "",
      taxUpto: vehicle.road_tax_expiry_date ?? "",
      pucNumber: vehicle.puc_no ?? "",
      pucUpto: vehicle.puc_expiry_date ?? "",
      permitNumber: vehicle.permit_no ?? "",
      permitType: vehicle.permit_type ?? "",
      permitValidFrom: vehicle.permit_valid_from ?? "",
      permitValidUpto: vehicle.local_permit_expiry_date ?? "",
      nationalPermitNumber: vehicle.national_permit_no ?? "",
      nationalPermitUpto: vehicle.national_permit_expiry_date ?? "",
      financed: vehicle.financed,
      financerName: vehicle.financer_name ?? "",
      blacklistStatus: vehicle.blacklist_status ?? "",
    },
    authbridge: { applied: false },
    resolution: {
      ...payload.resolution,
      selectedCustomerId: vehicle.customer_id,
      selectedExistingVehicleId: vehicle.id,
      createNewCustomer: false,
      ownershipDecision: "keep_existing",
    },
  };
}

export async function loadExistingVehicleForPolicyOnboarding(vehicleId: string): Promise<
  | { ok: true; selection: PolicyExistingVehicleSelection }
  | { ok: false; error: string }
> {
  await requirePolicyCreator();
  try {
    const vehicle = await findExistingVehicleById(vehicleId);
    if (!vehicle) return { ok: false, error: "The existing vehicle is no longer available. Refresh and try again." };
    return { ok: true, selection: existingVehicleSelection(vehicle) };
  } catch {
    return { ok: false, error: "We couldn't load the existing vehicle. Your form has not been changed." };
  }
}

export async function onboardPolicy(payload: PolicyOnboardingPayload): Promise<PolicyOnboardingResult> {
  const profile = await requirePolicyCreator();
  const selectedExistingVehicleId = payload.resolution?.selectedExistingVehicleId?.trim() || null;
  if (selectedExistingVehicleId) {
    try {
      const selectedVehicle = await findExistingVehicleById(selectedExistingVehicleId);
      if (!selectedVehicle) return { ok: false, kind: "database", error: "The selected existing vehicle is no longer available. Refresh and try again." };
      payload = applyCanonicalExistingVehicle(payload, selectedVehicle);
    } catch {
      return { ok: false, kind: "database", error: "We couldn't verify the selected existing vehicle. Your form has not been submitted." };
    }
  }

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

    const replacementRequested = payload.resolution?.confirmPolicyReplacement === true;
    const replacementPolicyId = payload.resolution?.replacementPolicyId?.trim() || null;
    const replacementReason = payload.resolution?.replacementReason?.trim() || "";
    const replacementEffectiveDate = payload.resolution?.replacementEffectiveDate?.trim() || "";
    if (replacementRequested) {
      if (!canReplaceActivePolicy(profile.role)) return { ok: false, kind: "permission", error: "Only a Manager or Administrator can replace an active policy." };
      if (payload.sourceIntakeId) return { ok: false, kind: "validation", error: "Active-policy replacement must be completed from direct Policy Onboarding, not from a Policy Intake handoff." };
      if (!replacementPolicyId || !replacementReason || !validDate(replacementEffectiveDate)) return { ok: false, kind: "validation", error: "Select a replacement reason and valid effective date." };
      if (replacementEffectiveDate !== String(payload.policy.validFrom ?? "")) return { ok: false, kind: "validation", error: "The replacement effective date must match the new policy Valid From date." };
    }

    const businessConflict = await findPolicyOnboardingBusinessConflict({
      payload,
      acceptCoverageGap: payload.resolution?.acceptCoverageGap === true,
      acceptActivePolicyNotice: payload.resolution?.acceptActivePolicyNotice === true,
      acceptExpiredPolicyHistory: payload.resolution?.acceptExpiredPolicyHistory === true,
      canReplacePolicy: canReplaceActivePolicy(profile.role) && !payload.sourceIntakeId,
      ignoreManagedPolicyId: replacementRequested ? replacementPolicyId : null,
    });
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
    let rpcResult;
    if (replacementRequested && replacementPolicyId) {
      rpcResult = await admin.rpc("replace_active_motor_policy_v1", {
        p_existing_policy_id: replacementPolicyId,
        p_payload: rpcPayload,
        p_reason: replacementReason,
        p_effective_date: replacementEffectiveDate,
      });
    } else if (payload.sourceIntakeId) {
      await requirePolicyIntakeFinalizer();
      if (!Number.isInteger(payload.draftRevision) || (payload.draftRevision ?? 0) < 1) return { ok:false, kind:"validation", error:"The Policy Intake draft version is missing. Reload the intake and try again." };
      rpcResult = await admin.rpc("finalize_policy_intake_motor_v1", { p_intake_id:payload.sourceIntakeId, p_payload:rpcPayload, p_expected_revision:payload.draftRevision });
    } else {
      rpcResult = await admin.rpc("onboard_motor_policy_commercial_status_v2", { p_payload: rpcPayload });
    }
    const { data, error } = rpcResult;
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
        const conflict = await findPolicyOnboardingBusinessConflict({
          payload,
          acceptCoverageGap: true,
          acceptActivePolicyNotice: true,
          acceptExpiredPolicyHistory: true,
          canReplacePolicy: canReplaceActivePolicy(profile.role) && !payload.sourceIntakeId,
          ignoreManagedPolicyId: replacementRequested ? replacementPolicyId : null,
        });
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

    revalidatePath("/policies"); revalidatePath("/customers"); revalidatePath("/vehicles"); revalidatePath(`/vehicles/${result.vehicleId}/edit`); if(payload.sourceIntakeId){revalidatePath("/policy-intakes");revalidatePath(`/policy-intakes/${payload.sourceIntakeId}`);}
    return { ok: true, policyId: result.policyId, policyCode: result.policyCode, customerId: result.customerId, vehicleId: result.vehicleId, status: "active" };
  } catch {
    return { ok: false, kind: "database", error: "We couldn't complete the policy booking. Your entered form details are still intact. Review the details and try again." };
  }
}
