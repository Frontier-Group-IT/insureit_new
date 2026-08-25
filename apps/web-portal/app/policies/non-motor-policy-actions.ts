"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { resolvePolicyIntermediarySource } from "@/lib/policy-intermediary-source";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type NonMotorPolicyPayload = {
  source: {
    issuanceDate: string;
    intermediaryType: string;
    intermediaryCode: string;
    leadSource: string;
    rmName: string;
  };
  customerId?: string;
  customer: {
    customerType: "Individual" | "Organisation";
    insuredName: string;
    contactName?: string;
    phone: string;
    email?: string;
    address?: string;
  };
  policy: {
    policyNumber: string;
    insurerId: string;
    productName: string;
    category: string;
    status: string;
    startDate: string;
    endDate: string;
    sumInsured: string;
    netPremium: string;
    gstAmount: string;
    grossPremium: string;
    deductible?: string;
  };
  risk: Record<string, string>;
  additional: Record<string, string>;
};

export type NonMotorPolicyResult =
  | { ok: true; policyId: string; policyCode: string }
  | { ok: false; error: string };

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function numberOrNull(value: unknown) {
  const normalized = clean(value).replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function normalizePolicyNumber(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function policyCode() {
  const now = new Date();
  const part = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
    String(now.getUTCMilliseconds()).padStart(3, "0"),
  ].join("");
  return `POL-${part}`;
}

function customerCode() {
  return `CUS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function createNonMotorPolicy(payload: NonMotorPolicyPayload): Promise<NonMotorPolicyResult> {
  const profile = await requirePolicyCreator();
  const admin = createSupabaseAdminClient();

  const policyNumber = clean(payload.policy.policyNumber).toUpperCase();
  const normalizedPolicy = normalizePolicyNumber(policyNumber);
  const insurerId = clean(payload.policy.insurerId);
  const productName = clean(payload.policy.productName);
  const category = clean(payload.policy.category);
  const startDate = clean(payload.policy.startDate);
  const endDate = clean(payload.policy.endDate);
  const issuanceDate = clean(payload.source.issuanceDate);
  const sumInsured = numberOrNull(payload.policy.sumInsured);
  const grossPremium = numberOrNull(payload.policy.grossPremium);
  const enteredNetPremium = numberOrNull(payload.policy.netPremium);
  const enteredGst = numberOrNull(payload.policy.gstAmount);
  const netPremium = enteredNetPremium ?? Math.max(0, (grossPremium ?? 0) - (enteredGst ?? 0));
  const gstAmount = enteredGst ?? Math.max(0, (grossPremium ?? 0) - netPremium);

  if (!policyNumber) return { ok: false, error: "Enter the policy number." };
  if (!insurerId) return { ok: false, error: "Select an insurance company." };
  if (!productName) return { ok: false, error: "Enter the product or policy name." };
  if (!category) return { ok: false, error: "Select the Non-Motor category." };
  if (!validDate(issuanceDate) || !validDate(startDate) || !validDate(endDate)) return { ok: false, error: "Enter valid issuance and policy validity dates." };
  if (endDate < startDate) return { ok: false, error: "Policy expiry cannot be before the start date." };
  if (sumInsured === null || sumInsured <= 0) return { ok: false, error: "Enter a valid sum insured or liability limit." };
  if (grossPremium === null || grossPremium < 0) return { ok: false, error: "Enter a valid gross premium." };

  const sourceResolution = await resolvePolicyIntermediarySource(payload.source);
  if (!sourceResolution.ok) return { ok: false, error: sourceResolution.error };

  const duplicate = await admin
    .from("policies")
    .select("id")
    .eq("policy_no_normalized", normalizedPolicy)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (duplicate.error) return { ok: false, error: "Policy validation is temporarily unavailable. Please try again." };
  if (duplicate.data) return { ok: false, error: "This policy number already exists in the Policy Register." };

  let customerId = clean(payload.customerId);
  let createdCustomerId: string | null = null;
  let createdPolicyId: string | null = null;

  try {
    if (customerId) {
      const { data: existingCustomer, error } = await admin.from("customers").select("id").eq("id", customerId).maybeSingle<{ id: string }>();
      if (error || !existingCustomer) return { ok: false, error: "The selected customer is no longer available. Refresh and try again." };
    } else {
      const insuredName = clean(payload.customer.insuredName);
      const phone = normalizePhone(payload.customer.phone);
      if (!insuredName) return { ok: false, error: "Enter the insured/customer name." };
      if (!/^[6-9][0-9]{9}$/.test(phone)) return { ok: false, error: "Enter a valid 10 digit Indian mobile number." };

      const { data: phoneMatch, error: phoneError } = await admin
        .from("customers")
        .select("id,contact_name,company_name")
        .eq("phone", phone)
        .limit(2)
        .returns<Array<{ id: string; contact_name: string; company_name: string | null }>>();
      if (phoneError) return { ok: false, error: "Customer validation is temporarily unavailable. Please try again." };
      if ((phoneMatch ?? []).length === 1) {
        customerId = phoneMatch![0].id;
      } else if ((phoneMatch ?? []).length > 1) {
        return { ok: false, error: "More than one customer uses this mobile number. Select the existing customer instead of creating a new one." };
      } else {
        const isOrganisation = payload.customer.customerType === "Organisation";
        const { data: createdCustomer, error } = await admin.from("customers").insert({
          customer_code: customerCode(),
          company_name: isOrganisation ? insuredName : null,
          contact_name: clean(payload.customer.contactName) || insuredName,
          phone,
          email: clean(payload.customer.email) || null,
          address: clean(payload.customer.address) || null,
          customer_type: isOrganisation ? "corporate" : "individual",
          source: sourceResolution.source.leadSource,
          creation_channel: "policy_onboarding",
          created_by: profile.id,
        }).select("id").single<{ id: string }>();
        if (error || !createdCustomer) return { ok: false, error: "We couldn't create the customer record. Review the customer details and try again." };
        customerId = createdCustomer.id;
        createdCustomerId = createdCustomer.id;
      }
    }

    const generatedPolicyCode = policyCode();
    const { data: policy, error: policyError } = await admin.from("policies").insert({
      customer_id: customerId,
      vehicle_id: null,
      insurance_company_id: insurerId,
      policy_no: policyNumber,
      policy_no_normalized: normalizedPolicy,
      policy_code: generatedPolicyCode,
      policy_type: category,
      policy_product: productName,
      business_line: "Non Motor",
      issuance_date: issuanceDate,
      start_date: startDate,
      end_date: endDate,
      premium_amount: grossPremium,
      insured_declared_value: sumInsured,
      status: clean(payload.policy.status).toLowerCase() || "active",
      intermediary_type: sourceResolution.source.intermediaryType,
      intermediary_code: sourceResolution.source.intermediaryCode,
      lead_source: sourceResolution.source.leadSource,
      rm_name: clean(payload.source.rmName) || null,
      remarks: clean(payload.additional.remarks) || null,
      calculation_version: "non_motor_manual_v1",
      created_by: profile.id,
    }).select("id").single<{ id: string }>();

    if (policyError || !policy) {
      if (createdCustomerId) await admin.from("customers").delete().eq("id", createdCustomerId);
      return { ok: false, error: "We couldn't create the Non-Motor policy. Your form is still intact; review the details and try again." };
    }
    createdPolicyId = policy.id;

    const risk = payload.risk ?? {};
    const additional = payload.additional ?? {};
    const { error: detailsError } = await admin.from("non_motor_policy_details").insert({
      policy_id: policy.id,
      category,
      risk_title: clean(risk.riskTitle) || clean(risk.cargoDescription) || clean(risk.projectName) || clean(risk.businessName) || null,
      risk_location: clean(risk.riskLocation) || null,
      occupancy_type: clean(risk.occupancyType) || null,
      transit_from: clean(risk.transitFrom) || null,
      transit_to: clean(risk.transitTo) || null,
      transit_mode: clean(risk.transitMode) || null,
      nature_of_business: clean(risk.natureOfBusiness) || null,
      liability_type: clean(risk.liabilityType) || null,
      employee_count: numberOrNull(risk.employeeCount),
      annual_wages: numberOrNull(risk.annualWages),
      annual_turnover: numberOrNull(risk.annualTurnover),
      sum_insured: sumInsured,
      deductible: numberOrNull(payload.policy.deductible),
      proposal_number: clean(additional.proposalNumber) || null,
      previous_insurer: clean(additional.previousInsurer) || null,
      previous_policy_number: clean(additional.previousPolicyNumber) || null,
      previous_claims: clean(additional.previousClaims) || null,
      add_ons: clean(additional.addOns) || null,
      warranties: clean(additional.warranties) || null,
      special_conditions: clean(additional.specialConditions) || null,
      endorsements: clean(additional.endorsements) || null,
      remarks: clean(additional.remarks) || null,
      risk_details: risk,
      additional_details: additional,
    });
    if (detailsError) throw new Error(detailsError.message);

    const { error: premiumError } = await admin.from("policy_premium_details").insert({
      policy_id: policy.id,
      od_premium: 0,
      tp_premium: 0,
      cpa_opted: false,
      cpa_amount: 0,
      net_premium: netPremium,
      gst_amount: gstAmount,
      gross_premium: grossPremium,
      gst_rule: "Manual Non-Motor entry",
      calculation_version: "non_motor_manual_v1",
      calculation_overridden: false,
    });
    if (premiumError) throw new Error(premiumError.message);

    revalidatePath("/policies");
    revalidatePath("/customers");
    return { ok: true, policyId: policy.id, policyCode: generatedPolicyCode };
  } catch {
    if (createdPolicyId) await admin.from("policies").delete().eq("id", createdPolicyId);
    if (createdCustomerId) await admin.from("customers").delete().eq("id", createdCustomerId);
    return { ok: false, error: "We couldn't complete the Non-Motor policy onboarding. Your form is still intact; please try again." };
  }
}
