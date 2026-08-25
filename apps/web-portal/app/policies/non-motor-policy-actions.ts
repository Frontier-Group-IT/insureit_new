"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type NonMotorPolicyPayload = {
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
  commercials?: { insurerPayin?: string; partnerPayout?: string };
};

export type NonMotorPolicyResult =
  | { ok: true; policyId: string; policyCode: string }
  | { ok: false; error: string };

function text(value: unknown) {
  return String(value ?? "").trim();
}

function numberOrNull(value: unknown) {
  const normalized = text(value).replace(/,/g, "");
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

function customerCode() {
  return `NMC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function createNonMotorPolicy(payload: NonMotorPolicyPayload): Promise<NonMotorPolicyResult> {
  const profile = await requirePolicyCreator();
  const admin = createSupabaseAdminClient();

  const insuredName = text(payload.customer.insuredName);
  const phone = normalizePhone(payload.customer.phone);
  const policyNumber = text(payload.policy.policyNumber).toUpperCase();
  const insurerId = text(payload.policy.insurerId);
  const productName = text(payload.policy.productName);
  const category = text(payload.policy.category);
  const startDate = text(payload.policy.startDate);
  const endDate = text(payload.policy.endDate);
  const sumInsured = numberOrNull(payload.policy.sumInsured);
  const grossPremium = numberOrNull(payload.policy.grossPremium);

  if (!insuredName) return { ok: false, error: "Enter the insured/customer name." };
  if (!payload.customerId && !/^[6-9][0-9]{9}$/.test(phone)) return { ok: false, error: "Enter a valid 10 digit Indian mobile number." };
  if (!policyNumber) return { ok: false, error: "Enter the policy number." };
  if (!insurerId) return { ok: false, error: "Select an insurance company." };
  if (!productName) return { ok: false, error: "Enter the product or policy name." };
  if (!category) return { ok: false, error: "Select the Non-Motor category." };
  if (!validDate(startDate) || !validDate(endDate)) return { ok: false, error: "Enter valid policy start and end dates." };
  if (endDate < startDate) return { ok: false, error: "Policy end date cannot be before the start date." };
  if (sumInsured === null || sumInsured < 0) return { ok: false, error: "Enter a valid sum insured or liability limit." };
  if (grossPremium === null || grossPremium < 0) return { ok: false, error: "Enter a valid gross premium." };

  const duplicate = await admin.from("policies").select("id").eq("policy_no", policyNumber).maybeSingle<{ id: string }>();
  if (duplicate.error) return { ok: false, error: "Policy validation is temporarily unavailable. Please try again." };
  if (duplicate.data) return { ok: false, error: "This policy number already exists in the Policy Register." };

  let customerId = text(payload.customerId);
  let createdCustomerId: string | null = null;

  try {
    if (customerId) {
      const { data: existingCustomer, error } = await admin.from("customers").select("id").eq("id", customerId).maybeSingle<{ id: string }>();
      if (error || !existingCustomer) return { ok: false, error: "The selected customer is no longer available. Refresh and try again." };
    } else {
      const { data: createdCustomer, error } = await admin.from("customers").insert({
        customer_code: customerCode(),
        company_name: payload.customer.customerType === "Organisation" ? insuredName : null,
        contact_name: text(payload.customer.contactName) || insuredName,
        phone,
        email: text(payload.customer.email) || null,
        address: text(payload.customer.address) || null,
        created_by: profile.id,
      }).select("id").single<{ id: string }>();
      if (error || !createdCustomer) return { ok: false, error: "We couldn't create the customer record. Review the customer details and try again." };
      customerId = createdCustomer.id;
      createdCustomerId = createdCustomer.id;
    }

    const policyRow = {
      customer_id: customerId,
      vehicle_id: null,
      insurance_company_id: insurerId,
      policy_no: policyNumber,
      policy_type: category,
      business_line: "Non Motor",
      policy_product: productName,
      policy_status: text(payload.policy.status) || "Active",
      start_date: startDate,
      end_date: endDate,
      premium_amount: grossPremium,
      insured_declared_value: sumInsured,
    };

    const { data: policy, error: policyError } = await admin.from("policies").insert(policyRow).select("id").single<{ id: string }>();
    if (policyError || !policy) {
      if (createdCustomerId) await admin.from("customers").delete().eq("id", createdCustomerId);
      return { ok: false, error: "We couldn't create the Non-Motor policy. Your form is still intact; review the details and try again." };
    }

    const risk = payload.risk ?? {};
    const additional = payload.additional ?? {};
    const detailsRow = {
      policy_id: policy.id,
      category,
      risk_title: text(risk.riskTitle) || text(risk.cargoDescription) || text(risk.projectName) || text(risk.businessName) || null,
      risk_location: text(risk.riskLocation) || null,
      occupancy_type: text(risk.occupancyType) || null,
      transit_from: text(risk.transitFrom) || null,
      transit_to: text(risk.transitTo) || null,
      transit_mode: text(risk.transitMode) || null,
      nature_of_business: text(risk.natureOfBusiness) || null,
      liability_type: text(risk.liabilityType) || null,
      employee_count: numberOrNull(risk.employeeCount),
      annual_wages: numberOrNull(risk.annualWages),
      annual_turnover: numberOrNull(risk.annualTurnover),
      sum_insured: sumInsured,
      deductible: numberOrNull(payload.policy.deductible),
      net_premium: numberOrNull(payload.policy.netPremium),
      gst_amount: numberOrNull(payload.policy.gstAmount),
      gross_premium: grossPremium,
      proposal_number: text(additional.proposalNumber) || null,
      previous_insurer: text(additional.previousInsurer) || null,
      previous_policy_number: text(additional.previousPolicyNumber) || null,
      previous_claims: text(additional.previousClaims) || null,
      add_ons: text(additional.addOns) || null,
      warranties: text(additional.warranties) || null,
      special_conditions: text(additional.specialConditions) || null,
      endorsements: text(additional.endorsements) || null,
      remarks: text(additional.remarks) || null,
      risk_details: risk,
      additional_details: { ...additional, commercials: payload.commercials ?? {} },
    };

    const { error: detailsError } = await admin.from("non_motor_policy_details").insert(detailsRow);
    if (detailsError) {
      await admin.from("policies").delete().eq("id", policy.id);
      if (createdCustomerId) await admin.from("customers").delete().eq("id", createdCustomerId);
      return { ok: false, error: "We couldn't save the Non-Motor risk details. Your form is still intact; please try again." };
    }

    revalidatePath("/policies");
    revalidatePath("/customers");
    return { ok: true, policyId: policy.id, policyCode: policyNumber };
  } catch {
    if (createdCustomerId) await admin.from("customers").delete().eq("id", createdCustomerId);
    return { ok: false, error: "We couldn't complete the Non-Motor policy onboarding. Your form is still intact; please try again." };
  }
}
