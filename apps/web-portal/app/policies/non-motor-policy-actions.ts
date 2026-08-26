"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { resolvePolicyIntermediarySource } from "@/lib/policy-intermediary-source";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type NonMotorCommercialBasis = "NET_PREMIUM_PERCENT" | "FIXED_AMOUNT";

type NonMotorCommercialPayload = {
  payinBasis: NonMotorCommercialBasis;
  payinPercent: string;
  payinFixedAmount: string;
  insurerSchemeAmount: string;
  payoutBasis: NonMotorCommercialBasis;
  payoutPercent: string;
  payoutFixedAmount: string;
};

export type NonMotorPolicyPayload = {
  source: { issuanceDate: string; intermediaryType: string; intermediaryCode: string; leadSource: string; rmName: string };
  customerId?: string;
  customer: { customerType: "Individual" | "Organisation"; insuredName: string; contactName?: string; phone: string; email?: string; address?: string };
  policy: { policyNumber: string; insurerId: string; productName: string; category: string; status: string; startDate: string; endDate: string; sumInsured: string; netPremium: string; gstAmount: string; grossPremium: string; deductible?: string };
  commercial?: NonMotorCommercialPayload;
  risk: Record<string, string>;
  additional: Record<string, string>;
};

export type NonMotorPolicyResult = { ok: true; policyId: string; policyCode: string } | { ok: false; error: string };

const EMPTY_COMMERCIAL: NonMotorCommercialPayload = {
  payinBasis: "NET_PREMIUM_PERCENT", payinPercent: "", payinFixedAmount: "", insurerSchemeAmount: "",
  payoutBasis: "NET_PREMIUM_PERCENT", payoutPercent: "", payoutFixedAmount: "",
};

const clean = (value: unknown) => String(value ?? "").trim();
function numberOrNull(value: unknown) { const normalized = clean(value).replace(/,/g, ""); if (!normalized) return null; const parsed = Number(normalized); return Number.isFinite(parsed) ? parsed : null; }
const moneyOrZero = (value: unknown) => numberOrNull(value) ?? 0;
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const normalizePhone = (value: string) => value.replace(/\D/g, "").slice(-10);
const normalizePolicyNumber = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");
function policyCode() { const now = new Date(); return `POL-${[now.getUTCFullYear(),String(now.getUTCMonth()+1).padStart(2,"0"),String(now.getUTCDate()).padStart(2,"0"),String(now.getUTCHours()).padStart(2,"0"),String(now.getUTCMinutes()).padStart(2,"0"),String(now.getUTCSeconds()).padStart(2,"0"),String(now.getUTCMilliseconds()).padStart(3,"0")].join("")}`; }
const customerCode = () => `CUS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

export async function createNonMotorPolicy(payload: NonMotorPolicyPayload): Promise<NonMotorPolicyResult> {
  const profile = await requirePolicyCreator();
  const admin = createSupabaseAdminClient();
  // Keep the server as the source of truth for the same restricted commercial access used by Motor onboarding.
  const commercial = canAccessPolicyCommercials(profile) ? (payload.commercial ?? EMPTY_COMMERCIAL) : EMPTY_COMMERCIAL;

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

  const payinPercentEntered = clean(commercial.payinPercent) !== "";
  const payinFixedEntered = clean(commercial.payinFixedAmount) !== "";
  const schemeEntered = clean(commercial.insurerSchemeAmount) !== "";
  const payoutPercentEntered = clean(commercial.payoutPercent) !== "";
  const payoutFixedEntered = clean(commercial.payoutFixedAmount) !== "";
  const payinEntered = payinPercentEntered || payinFixedEntered || schemeEntered;
  const payoutEntered = payoutPercentEntered || payoutFixedEntered;
  const payinPercent = moneyOrZero(commercial.payinPercent);
  const payinFixedAmount = moneyOrZero(commercial.payinFixedAmount);
  const schemeAmount = moneyOrZero(commercial.insurerSchemeAmount);
  const payoutPercent = moneyOrZero(commercial.payoutPercent);
  const payoutFixedAmount = moneyOrZero(commercial.payoutFixedAmount);

  if (!policyNumber) return { ok:false, error:"Enter the policy number." };
  if (!insurerId) return { ok:false, error:"Select an insurance company." };
  if (!productName) return { ok:false, error:"Enter the product or policy name." };
  if (!category) return { ok:false, error:"Select the Non-Motor category." };
  if (!validDate(issuanceDate) || !validDate(startDate) || !validDate(endDate)) return { ok:false, error:"Enter valid issuance and policy validity dates." };
  if (endDate < startDate) return { ok:false, error:"Policy expiry cannot be before the start date." };
  if (sumInsured === null || sumInsured <= 0) return { ok:false, error:"Enter a valid sum insured or liability limit." };
  if (grossPremium === null || grossPremium < 0) return { ok:false, error:"Enter a valid gross premium." };
  if (netPremium < 0 || gstAmount < 0) return { ok:false, error:"Premium values cannot be negative." };
  if (payinPercent < 0 || payinPercent > 100 || payoutPercent < 0 || payoutPercent > 100) return { ok:false, error:"Pay-in and payout percentages must be between 0 and 100." };
  if (payinFixedAmount < 0 || schemeAmount < 0 || payoutFixedAmount < 0) return { ok:false, error:"Commercial amounts cannot be negative." };

  const payinBaseAmount = commercial.payinBasis === "FIXED_AMOUNT" ? payinFixedAmount : netPremium * payinPercent / 100;
  const totalProjectedPayin = payinBaseAmount + schemeAmount;
  const tdsPercent = 10;
  const tdsAmount = totalProjectedPayin * tdsPercent / 100;
  const payinAfterTds = totalProjectedPayin - tdsAmount;
  const partnerPayoutAmount = commercial.payoutBasis === "FIXED_AMOUNT" ? payoutFixedAmount : netPremium * payoutPercent / 100;
  const retentionAmount = payinAfterTds - partnerPayoutAmount;

  const sourceResolution = await resolvePolicyIntermediarySource(payload.source);
  if (!sourceResolution.ok) return { ok:false, error:sourceResolution.error };

  const duplicate = await admin.from("policies").select("id").eq("policy_no_normalized", normalizedPolicy).limit(1).maybeSingle<{id:string}>();
  if (duplicate.error) return { ok:false, error:"Policy validation is temporarily unavailable. Please try again." };
  if (duplicate.data) return { ok:false, error:"This policy number already exists in the Policy Register." };

  let customerId = clean(payload.customerId);
  let createdCustomerId: string | null = null;
  let createdPolicyId: string | null = null;

  try {
    if (customerId) {
      const { data: existingCustomer, error } = await admin.from("customers").select("id").eq("id", customerId).maybeSingle<{id:string}>();
      if (error || !existingCustomer) return { ok:false, error:"The selected customer is no longer available. Refresh and try again." };
    } else {
      const insuredName = clean(payload.customer.insuredName);
      const phone = normalizePhone(payload.customer.phone);
      if (!insuredName) return { ok:false, error:"Enter the insured/customer name." };
      if (!/^[6-9][0-9]{9}$/.test(phone)) return { ok:false, error:"Enter a valid 10 digit Indian mobile number." };
      const { data: phoneMatch, error: phoneError } = await admin.from("customers").select("id,contact_name,company_name").eq("phone", phone).limit(2).returns<Array<{id:string;contact_name:string;company_name:string|null}>>();
      if (phoneError) return { ok:false, error:"Customer validation is temporarily unavailable. Please try again." };
      if ((phoneMatch ?? []).length === 1) customerId = phoneMatch![0].id;
      else if ((phoneMatch ?? []).length > 1) return { ok:false, error:"More than one customer uses this mobile number. Select the existing customer instead of creating a new one." };
      else {
        const isOrganisation = payload.customer.customerType === "Organisation";
        const { data: createdCustomer, error } = await admin.from("customers").insert({
          customer_code:customerCode(), company_name:isOrganisation?insuredName:null, contact_name:clean(payload.customer.contactName)||insuredName,
          phone, email:clean(payload.customer.email)||null, address:clean(payload.customer.address)||null, customer_type:isOrganisation?"corporate":"individual",
          source:sourceResolution.source.leadSource, creation_channel:"policy_onboarding", created_by:profile.id,
        }).select("id").single<{id:string}>();
        if (error || !createdCustomer) return { ok:false, error:"We couldn't create the customer record. Review the customer details and try again." };
        customerId = createdCustomer.id; createdCustomerId = createdCustomer.id;
      }
    }

    const generatedPolicyCode = policyCode();
    const { data: policy, error: policyError } = await admin.from("policies").insert({
      customer_id:customerId, vehicle_id:null, insurance_company_id:insurerId, policy_no:policyNumber, policy_no_normalized:normalizedPolicy,
      policy_code:generatedPolicyCode, policy_type:category, policy_product:productName, business_line:"Non Motor", issuance_date:issuanceDate,
      start_date:startDate, end_date:endDate, premium_amount:grossPremium, insured_declared_value:sumInsured,
      status:clean(payload.policy.status).toLowerCase()||"active", intermediary_type:sourceResolution.source.intermediaryType,
      intermediary_code:sourceResolution.source.intermediaryCode, lead_source:sourceResolution.source.leadSource, rm_name:clean(payload.source.rmName)||null,
      remarks:clean(payload.additional.remarks)||null, calculation_version:"non_motor_commercial_v1", created_by:profile.id,
    }).select("id").single<{id:string}>();
    if (policyError || !policy) { if (createdCustomerId) await admin.from("customers").delete().eq("id",createdCustomerId); return { ok:false, error:"We couldn't create the Non-Motor policy. Your form is still intact; review the details and try again." }; }
    createdPolicyId = policy.id;

    const risk = payload.risk ?? {}, additional = payload.additional ?? {};
    const { error: detailsError } = await admin.from("non_motor_policy_details").insert({
      policy_id:policy.id, category,
      risk_title:clean(risk.riskTitle)||clean(risk.cargoDescription)||clean(risk.projectName)||clean(risk.businessName)||null,
      risk_location:clean(risk.riskLocation)||null, occupancy_type:clean(risk.occupancyType)||null, transit_from:clean(risk.transitFrom)||null,
      transit_to:clean(risk.transitTo)||null, transit_mode:clean(risk.transitMode)||null, nature_of_business:clean(risk.natureOfBusiness)||null,
      liability_type:clean(risk.liabilityType)||null, employee_count:numberOrNull(risk.employeeCount), annual_wages:numberOrNull(risk.annualWages),
      annual_turnover:numberOrNull(risk.annualTurnover), sum_insured:sumInsured, deductible:numberOrNull(payload.policy.deductible),
      proposal_number:clean(additional.proposalNumber)||null, previous_insurer:clean(additional.previousInsurer)||null,
      previous_policy_number:clean(additional.previousPolicyNumber)||null, previous_claims:clean(additional.previousClaims)||null,
      add_ons:clean(additional.addOns)||null, warranties:clean(additional.warranties)||null, special_conditions:clean(additional.specialConditions)||null,
      endorsements:clean(additional.endorsements)||null, remarks:clean(additional.remarks)||null, risk_details:risk, additional_details:additional,
    });
    if (detailsError) throw new Error(detailsError.message);

    const { error: premiumError } = await admin.from("policy_premium_details").insert({
      policy_id:policy.id, od_premium:0, tp_premium:0, cpa_opted:false, cpa_amount:0, net_premium:netPremium, gst_amount:gstAmount,
      gross_premium:grossPremium, gst_rule:"Manual Non-Motor entry", calculation_version:"non_motor_commercial_v1", calculation_overridden:false,
    });
    if (premiumError) throw new Error(premiumError.message);

    const { error: payinError } = await admin.from("policy_payin_details").insert({
      policy_id:policy.id, payout_basis:null, projected_od_percent:0, projected_od_amount:0, projected_tp_percent:0, projected_tp_amount:0,
      commercial_basis:payinEntered?commercial.payinBasis:null,
      projected_commission_percent:payinEntered&&commercial.payinBasis==="NET_PREMIUM_PERCENT"?payinPercent:null,
      projected_commission_amount:payinEntered?payinBaseAmount:null, insurer_scheme_amount:schemeAmount, total_projected_payin:totalProjectedPayin,
      tds_percent:tdsPercent, tds_amount:tdsAmount, payin_after_tds:payinAfterTds, calculation_version:"non_motor_commercial_v1",
      commercial_status:payinEntered?"entered":"needs_review",
    });
    if (payinError) throw new Error(payinError.message);

    const { error: billError } = await admin.from("policy_payin_bills").insert({ policy_id:policy.id, bill_number:null, billed_amount:0, bill_date:null, status:"Unbilled", short_payout_amount:totalProjectedPayin });
    if (billError) throw new Error(billError.message);

    const { error: payoutError } = await admin.from("policy_intermediary_payouts").insert({
      policy_id:policy.id, intermediary_type:sourceResolution.source.intermediaryType, intermediary_code:sourceResolution.source.intermediaryCode,
      payout_basis:payoutEntered?commercial.payoutBasis:null,
      partner_payout_percent:payoutEntered&&commercial.payoutBasis==="NET_PREMIUM_PERCENT"?payoutPercent:null,
      partner_payout_amount:payoutEntered?partnerPayoutAmount:null, retention_amount:retentionAmount,
      od_payout_percent:0, od_payout_amount:0, tp_payout_percent:0, tp_payout_amount:0, gross_payout:partnerPayoutAmount,
      status:"Pending", payout_date:null, voucher_number:null, remarks:clean(payload.additional.remarks)||null,
      calculation_version:"non_motor_commercial_v1", commercial_status:payoutEntered?"entered":"needs_review",
    });
    if (payoutError) throw new Error(payoutError.message);

    revalidatePath("/policies"); revalidatePath("/customers");
    return { ok:true, policyId:policy.id, policyCode:generatedPolicyCode };
  } catch {
    if (createdPolicyId) await admin.from("policies").delete().eq("id",createdPolicyId);
    if (createdCustomerId) await admin.from("customers").delete().eq("id",createdCustomerId);
    return { ok:false, error:"We couldn't complete the Non-Motor policy onboarding. Your form is still intact; please try again." };
  }
}
