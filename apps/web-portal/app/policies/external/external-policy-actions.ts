"use server";

import { revalidatePath } from "next/cache";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type ExternalPolicyPayload = {
  customerId: string;
  vehicleId: string;
  insuranceCompanyId: string;
  policyNo: string;
  policyType: string;
  startDate: string;
  endDate: string;
  premiumAmount: string;
  insuredDeclaredValue: string;
};

export type ExternalPolicyResult =
  | { ok: true; policyId: string }
  | { ok: false; error: string };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function optionalMoney(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

async function validatePayload(payload: ExternalPolicyPayload) {
  const profile = await requirePolicyEditor();
  if (!isUuid(payload.customerId)) return { ok: false as const, error: "Select a valid customer." };
  if (!isUuid(payload.vehicleId)) return { ok: false as const, error: "Select an existing vehicle for the customer." };
  if (!isUuid(payload.insuranceCompanyId)) return { ok: false as const, error: "Select an insurance company." };
  if (!payload.policyNo.trim()) return { ok: false as const, error: "Enter the policy number." };
  if (!payload.policyType.trim()) return { ok: false as const, error: "Enter the policy type." };
  if (!validDate(payload.startDate) || !validDate(payload.endDate)) return { ok: false as const, error: "Enter valid policy dates." };
  if (payload.endDate < payload.startDate) return { ok: false as const, error: "Policy end date cannot be before the start date." };

  const premium = optionalMoney(payload.premiumAmount);
  const idv = optionalMoney(payload.insuredDeclaredValue);
  if (Number.isNaN(premium) || Number.isNaN(idv)) return { ok: false as const, error: "Premium and IDV must be valid non-negative amounts." };

  const accessibleCustomerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_policies");
  if (accessibleCustomerIds !== null && !accessibleCustomerIds.includes(payload.customerId)) {
    return { ok: false as const, error: "You do not have access to this customer." };
  }

  const admin = createSupabaseAdminClient();
  const { data: vehicle, error: vehicleError } = await admin
    .from("vehicles")
    .select("id,customer_id")
    .eq("id", payload.vehicleId)
    .eq("customer_id", payload.customerId)
    .maybeSingle<{ id: string; customer_id: string }>();
  if (vehicleError || !vehicle) return { ok: false as const, error: "The selected vehicle does not belong to this customer." };

  const { data: insurer, error: insurerError } = await admin
    .from("insurance_companies")
    .select("id")
    .eq("id", payload.insuranceCompanyId)
    .maybeSingle<{ id: string }>();
  if (insurerError || !insurer) return { ok: false as const, error: "The selected insurance company is not available." };

  return { ok: true as const, admin, premium, idv };
}

export async function createExternalPolicy(payload: ExternalPolicyPayload): Promise<ExternalPolicyResult> {
  const validation = await validatePayload(payload);
  if (!validation.ok) return validation;

  const { data, error } = await validation.admin
    .from("external_policies")
    .insert({
      customer_id: payload.customerId,
      vehicle_id: payload.vehicleId,
      insurance_company_id: payload.insuranceCompanyId,
      policy_no: payload.policyNo.trim().toUpperCase(),
      policy_type: payload.policyType.trim(),
      start_date: payload.startDate,
      end_date: payload.endDate,
      premium_amount: validation.premium,
      insured_declared_value: validation.idv,
      added_via: "web_portal",
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: error?.message ?? "External policy could not be created." };
  revalidatePath("/policies/external");
  return { ok: true, policyId: data.id };
}

export async function updateExternalPolicy(policyId: string, payload: ExternalPolicyPayload): Promise<ExternalPolicyResult> {
  if (!isUuid(policyId)) return { ok: false, error: "Invalid external policy reference." };
  const validation = await validatePayload(payload);
  if (!validation.ok) return validation;

  const { data: existing, error: existingError } = await validation.admin
    .from("external_policies")
    .select("id,customer_id")
    .eq("id", policyId)
    .maybeSingle<{ id: string; customer_id: string }>();
  if (existingError || !existing) return { ok: false, error: "External policy was not found." };

  const profile = await requirePolicyEditor();
  const accessibleCustomerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_policies");
  if (accessibleCustomerIds !== null && !accessibleCustomerIds.includes(existing.customer_id)) {
    return { ok: false, error: "You do not have access to edit this external policy." };
  }

  const { error } = await validation.admin
    .from("external_policies")
    .update({
      customer_id: payload.customerId,
      vehicle_id: payload.vehicleId,
      insurance_company_id: payload.insuranceCompanyId,
      policy_no: payload.policyNo.trim().toUpperCase(),
      policy_type: payload.policyType.trim(),
      start_date: payload.startDate,
      end_date: payload.endDate,
      premium_amount: validation.premium,
      insured_declared_value: validation.idv,
      updated_at: new Date().toISOString(),
    })
    .eq("id", policyId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/policies/external");
  revalidatePath(`/policies/external/${policyId}/edit`);
  return { ok: true, policyId };
}
