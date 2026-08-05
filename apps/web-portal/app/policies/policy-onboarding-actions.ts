"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PolicyCustomerCandidate = {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  state: string | null;
};

export type PolicyOwnershipConflict = {
  vehicleId: string;
  registrationNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  canTransfer: boolean;
};

export type PolicyOnboardingPayload = {
  customer: {
    name: string;
    phone: string;
    type?: string;
    email?: string;
    address?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
    country?: string;
    source?: string;
  };
  vehicle: Record<string, string | boolean | null | undefined>;
  policy: Record<string, string | null | undefined>;
  premium: Record<string, string | number | boolean | null | undefined>;
  payin: Record<string, string | number | null | undefined>;
  billing: Record<string, string | number | null | undefined>;
  payout: Record<string, string | number | null | undefined>;
  authbridge: Record<string, string | boolean | null | undefined>;
  resolution?: {
    selectedCustomerId?: string | null;
    createNewCustomer?: boolean;
    ownershipDecision?: "keep_existing" | "transfer" | null;
    transferReason?: string;
  };
};

export type PolicyOnboardingResult =
  | { ok: true; policyId: string; policyCode: string; customerId: string; vehicleId: string; status: "active" }
  | { ok: false; kind: "validation" | "database" | "permission"; error: string }
  | { ok: false; kind: "customer_match"; candidates: PolicyCustomerCandidate[] }
  | { ok: false; kind: "ownership_conflict"; conflict: PolicyOwnershipConflict };

type CustomerRow = {
  id: string;
  contact_name: string;
  phone: string;
  city: string | null;
  state: string | null;
};

type VehicleOwnerRow = {
  id: string;
  vehicle_no: string;
  vehicle_no_normalized: string | null;
  customer_id: string;
  customers: { contact_name: string; phone: string } | null;
};

function normalizedPhone(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function normalizedRegistration(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function canTransferVehicle(role: string | null | undefined) {
  return role === "manager" || role === "admin" || role === "super_admin" || role === "it_super_user";
}

function validDate(value: unknown) {
  if (typeof value !== "string" || !value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validatePayload(payload: PolicyOnboardingPayload) {
  const phone = normalizedPhone(payload.customer.phone ?? "");
  const registration = normalizedRegistration(String(payload.vehicle.registrationNumber ?? ""));
  const name = cleanName(payload.customer.name ?? "");
  if (!name) return "Enter the insured/customer name.";
  if (!/^[6-9][0-9]{9}$/.test(phone)) return "Enter a valid 10 digit Indian mobile number.";
  if (!registration) return "Enter the vehicle registration number.";
  if (!payload.vehicle.classCode) return "Select the vehicle class.";
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
  return [...merged.values()].map((row) => ({ id: row.id, name: row.contact_name, phone: row.phone, city: row.city, state: row.state }));
}

async function findVehicleOwner(registration: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("vehicles")
    .select("id, vehicle_no, vehicle_no_normalized, customer_id, customers(contact_name, phone)")
    .eq("vehicle_no_normalized", registration)
    .maybeSingle<VehicleOwnerRow>();
  if (error) throw new Error(error.message);
  return data;
}

export async function onboardPolicy(payload: PolicyOnboardingPayload): Promise<PolicyOnboardingResult> {
  const profile = await requirePolicyEditor();
  const validationError = validatePayload(payload);
  if (validationError) return { ok: false, kind: "validation", error: validationError };

  const phone = normalizedPhone(payload.customer.phone);
  const name = cleanName(payload.customer.name);
  const registration = normalizedRegistration(String(payload.vehicle.registrationNumber));
  const selectedCustomerId = payload.resolution?.selectedCustomerId?.trim() || null;
  const createNewCustomer = payload.resolution?.createNewCustomer === true;

  try {
    if (!selectedCustomerId && !createNewCustomer) {
      const candidates = await findCustomerCandidates(name, phone);
      if (candidates.length) return { ok: false, kind: "customer_match", candidates };
    }

    const vehicle = await findVehicleOwner(registration);
    let effectiveCustomerId = selectedCustomerId;
    const ownershipDecision = payload.resolution?.ownershipDecision ?? null;

    if (vehicle && effectiveCustomerId && vehicle.customer_id !== effectiveCustomerId && !ownershipDecision) {
      return {
        ok: false,
        kind: "ownership_conflict",
        conflict: {
          vehicleId: vehicle.id,
          registrationNumber: vehicle.vehicle_no,
          customerId: vehicle.customer_id,
          customerName: vehicle.customers?.contact_name ?? "Existing customer",
          customerPhone: vehicle.customers?.phone ?? "",
          canTransfer: canTransferVehicle(profile.role),
        },
      };
    }

    if (vehicle && !effectiveCustomerId && createNewCustomer && !ownershipDecision) {
      return {
        ok: false,
        kind: "ownership_conflict",
        conflict: {
          vehicleId: vehicle.id,
          registrationNumber: vehicle.vehicle_no,
          customerId: vehicle.customer_id,
          customerName: vehicle.customers?.contact_name ?? "Existing customer",
          customerPhone: vehicle.customers?.phone ?? "",
          canTransfer: canTransferVehicle(profile.role),
        },
      };
    }

    if (vehicle && ownershipDecision === "keep_existing") {
      effectiveCustomerId = vehicle.customer_id;
    }

    if (ownershipDecision === "transfer" && !canTransferVehicle(profile.role)) {
      return { ok: false, kind: "permission", error: "Only a Manager or Administrator can transfer vehicle ownership." };
    }

    const rpcPayload = {
      ...payload,
      customer: { ...payload.customer, name, phone },
      vehicle: { ...payload.vehicle, registrationNumber: registration },
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
      if (error.message.includes("OWNERSHIP_CONFLICT")) return { ok: false, kind: "database", error: "Vehicle ownership changed while this form was open. Refresh and review the customer again." };
      return { ok: false, kind: "database", error: error.message };
    }

    const result = data as { ok?: boolean; policyId?: string; policyCode?: string; customerId?: string; vehicleId?: string; status?: string } | null;
    if (!result?.ok || !result.policyId || !result.policyCode || !result.customerId || !result.vehicleId) {
      return { ok: false, kind: "database", error: "Policy onboarding completed without a valid result." };
    }

    revalidatePath("/policies");
    revalidatePath("/customers");
    revalidatePath("/vehicles");
    return { ok: true, policyId: result.policyId, policyCode: result.policyCode, customerId: result.customerId, vehicleId: result.vehicleId, status: "active" };
  } catch (error) {
    return { ok: false, kind: "database", error: error instanceof Error ? error.message : "Policy could not be onboarded." };
  }
}
