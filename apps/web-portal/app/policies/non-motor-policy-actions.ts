"use server";

import { revalidatePath } from "next/cache";
import { createNonMotorPolicyForVerifiedActor } from "@/lib/non-motor-policy-creation-engine";
import { requirePolicyCreator, requirePolicyEditor } from "@/lib/policy-access-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { resolvePolicyIntermediarySource } from "@/lib/policy-intermediary-source";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { recordPolicyActivity, capturePolicyEditSnapshot, describePolicyEditChanges, POLICY_ACTIVITY_ACTIONS } from "@/lib/policy-activity";
import { consumePolicyDateApproval, recordPreviousMonthPolicyUpload, linkConsumedPolicyDateApproval } from "@/lib/policy-date-approval-server";

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
  sourceIntakeId?:string|null;
  dateApprovalId?: string | null;
  source: { issuanceDate: string; intermediaryType: string; intermediaryCode: string; leadSource: string; rmName: string };
  customerId?: string;
  customer: { customerType: "Individual" | "Organisation"; insuredName: string; contactName?: string; phone: string; email?: string; address?: string };
  policy: { policyNumber: string; insurerId: string; productName: string; category: string; status: string; startDate: string; endDate: string; sumInsured: string; odPremium: string; tpPremium: string; netPremium: string; gstAmount: string; grossPremium: string; deductible?: string };
  commercial?: NonMotorCommercialPayload;
  risk: Record<string, string>;
  additional: Record<string, string>;
};

export type NonMotorPolicyResult = { ok: true; policyId: string; policyCode: string } | { ok: false; error: string };

type CustomerIdentityRow = { id: string; contact_name: string; company_name: string | null };

const EMPTY_COMMERCIAL: NonMotorCommercialPayload = {
  payinBasis: "NET_PREMIUM_PERCENT", payinPercent: "", payinFixedAmount: "", insurerSchemeAmount: "",
  payoutBasis: "NET_PREMIUM_PERCENT", payoutPercent: "", payoutFixedAmount: "",
};

const clean = (value: unknown) => String(value ?? "").trim();
function cleanCustomerName(value: unknown) { return clean(value).replace(/\s+/g, " "); }
function numberOrNull(value: unknown) { const normalized = clean(value).replace(/,/g, ""); if (!normalized) return null; const parsed = Number(normalized); return Number.isFinite(parsed) ? parsed : null; }
const moneyOrZero = (value: unknown) => numberOrNull(value) ?? 0;
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const normalizePhone = (value: string) => value.replace(/\D/g, "").slice(-10);
const normalizePolicyNumber = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");
function policyCode() { const now = new Date(); return `POL-${[now.getUTCFullYear(),String(now.getUTCMonth()+1).padStart(2,"0"),String(now.getUTCDate()).padStart(2,"0"),String(now.getUTCHours()).padStart(2,"0"),String(now.getUTCMinutes()).padStart(2,"0"),String(now.getUTCSeconds()).padStart(2,"0"),String(now.getUTCMilliseconds()).padStart(3,"0")].join("")}`; }
const customerCode = () => `CUS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
function customerIdentityName(row: CustomerIdentityRow) { return cleanCustomerName(row.company_name || row.contact_name).toLowerCase(); }


export async function updateNonMotorPolicy(policyId: string, payload: NonMotorPolicyPayload): Promise<NonMotorPolicyResult> {
  const profile = await requirePolicyEditor(policyId);
  const admin = createSupabaseAdminClient();
  const commercial = canAccessPolicyCommercials(profile, profile.role === "operations_head_life") ? (payload.commercial ?? EMPTY_COMMERCIAL) : EMPTY_COMMERCIAL;
  const id = clean(policyId);
  if (!id) return { ok:false, error:"Policy reference is missing." };

  const { data: existing, error: existingError } = await admin.from("policies")
    .select("id,customer_id,policy_code,business_line,issuance_date")
    .eq("id", id)
    .maybeSingle<{ id:string; customer_id:string; policy_code:string | null; business_line:string | null; issuance_date: string | null }>();
  if (existingError || !existing) return { ok:false, error:"This policy is no longer available. Refresh the Policy Register and try again." };
  if (existing.business_line !== "Non Motor") return { ok:false, error:"This edit action is only available for Non-Motor policies." };

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
  const odPremium = 0;
  const tpPremium = 0;
  const netPremium = moneyOrZero(payload.policy.netPremium);
  const enteredGst = numberOrNull(payload.policy.gstAmount);
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

  const selectedCustomerId = clean(payload.customerId);
  if (selectedCustomerId && selectedCustomerId !== existing.customer_id) {
    return { ok:false, error:"The linked customer cannot be changed from Policy Edit. Update the customer master separately if required." };
  }

  const sourceResolution = await resolvePolicyIntermediarySource(payload.source);
  if (!sourceResolution.ok) return { ok:false, error:sourceResolution.error };

  if (profile.role === "operations_head_life") {
    const { data: ownership } = await admin.from("policies")
      .select("intermediary_code,rm_name").eq("id", id)
      .maybeSingle<{ intermediary_code: string | null; rm_name: string | null }>();
    if (!ownership ||
        ownership.intermediary_code?.trim() !== sourceResolution.source.intermediaryCode ||
        (ownership.rm_name ?? "").trim().toLowerCase() !== payload.source.rmName.trim().toLowerCase()) {
      return { ok: false, error: "Changing the linked intermediary or RM is not permitted." };
    }
  }

  const duplicate = await admin.from("policies")
    .select("id")
    .eq("policy_no_normalized", normalizedPolicy)
    .neq("id", id)
    .limit(1)
    .maybeSingle<{id:string}>();
  if (duplicate.error) return { ok:false, error:"Policy validation is temporarily unavailable. Please try again." };
  if (duplicate.data) return { ok:false, error:"This policy number already exists in the Policy Register." };

  const payinBaseAmount = commercial.payinBasis === "FIXED_AMOUNT" ? payinFixedAmount : netPremium * payinPercent / 100;
  const totalProjectedPayin = payinBaseAmount + schemeAmount;
  const tdsPercent = 10;
  const tdsAmount = totalProjectedPayin * tdsPercent / 100;
  const payinAfterTds = totalProjectedPayin - tdsAmount;
  const partnerPayoutAmount = commercial.payoutBasis === "FIXED_AMOUNT" ? payoutFixedAmount : netPremium * payoutPercent / 100;
  const retentionAmount = payinAfterTds - partnerPayoutAmount;
  const risk = payload.risk ?? {};
  const additional = payload.additional ?? {};

  const dateGuard = await consumePolicyDateApproval(admin, { requesterId: profile.id, issuanceDate, policyNumber, operation: "edit", existingPolicyId: id, originalIssuanceDate: existing.issuance_date, approvalId: payload.dateApprovalId });
  if (!dateGuard.ok) return { ok:false, error:dateGuard.error };
  const activityBefore = await capturePolicyEditSnapshot(admin, id).catch(() => null);
  const { error: policyError } = await admin.from("policies").update({
    insurance_company_id:insurerId,
    policy_no:policyNumber,
    policy_no_normalized:normalizedPolicy,
    policy_type:category,
    policy_product:productName,
    business_line:"Non Motor",
    issuance_date:issuanceDate,
    start_date:startDate,
    end_date:endDate,
    premium_amount:grossPremium,
    insured_declared_value:sumInsured,
    status:clean(payload.policy.status).toLowerCase()||"active",
    intermediary_type:sourceResolution.source.intermediaryType,
    intermediary_code:sourceResolution.source.intermediaryCode,
    lead_source:sourceResolution.source.leadSource,
    rm_name:clean(payload.source.rmName)||null,
    remarks:clean(additional.remarks)||null,
    calculation_version:"non_motor_commercial_v1",
  }).eq("id", id);
  if (policyError) return { ok:false, error:"We couldn't update the Non-Motor policy. Review the details and try again." };

  const { error: detailsError } = await admin.from("non_motor_policy_details").upsert({
    policy_id:id,
    category,
    risk_title:clean(risk.riskTitle)||clean(risk.cargoDescription)||clean(risk.projectName)||clean(risk.businessName)||null,
    risk_location:clean(risk.riskLocation)||null,
    occupancy_type:clean(risk.occupancyType)||null,
    transit_from:clean(risk.transitFrom)||null,
    transit_to:clean(risk.transitTo)||null,
    transit_mode:clean(risk.transitMode)||null,
    nature_of_business:clean(risk.natureOfBusiness)||null,
    liability_type:clean(risk.liabilityType)||null,
    employee_count:numberOrNull(risk.employeeCount),
    annual_wages:numberOrNull(risk.annualWages),
    annual_turnover:numberOrNull(risk.annualTurnover),
    sum_insured:sumInsured,
    deductible:numberOrNull(payload.policy.deductible),
    proposal_number:clean(additional.proposalNumber)||null,
    previous_insurer:clean(additional.previousInsurer)||null,
    previous_policy_number:clean(additional.previousPolicyNumber)||null,
    previous_claims:clean(additional.previousClaims)||null,
    add_ons:clean(additional.addOns)||null,
    warranties:clean(additional.warranties)||null,
    special_conditions:clean(additional.specialConditions)||null,
    endorsements:clean(additional.endorsements)||null,
    remarks:clean(additional.remarks)||null,
    risk_details:risk,
    additional_details:additional,
  }, { onConflict:"policy_id" });
  if (detailsError) return { ok:false, error:"Policy details could not be updated. Please try again." };

  const { error: premiumError } = await admin.from("policy_premium_details").upsert({
    policy_id:id,
    od_premium:odPremium,
    tp_premium:tpPremium,
    cpa_opted:false,
    cpa_amount:0,
    net_premium:netPremium,
    gst_amount:gstAmount,
    gross_premium:grossPremium,
    gst_rule:"Manual Non-Motor entry",
    calculation_version:"non_motor_commercial_v1",
    calculation_overridden:false,
  }, { onConflict:"policy_id" });
  if (premiumError) return { ok:false, error:"Premium details could not be updated. Please try again." };

  const { error: payinError } = await admin.from("policy_payin_details").upsert({
    policy_id:id,
    payout_basis:null,
    projected_od_percent:0,
    projected_od_amount:0,
    projected_tp_percent:0,
    projected_tp_amount:0,
    commercial_basis:payinEntered?commercial.payinBasis:null,
    projected_commission_percent:payinEntered&&commercial.payinBasis==="NET_PREMIUM_PERCENT"?payinPercent:null,
    projected_commission_amount:payinEntered?payinBaseAmount:null,
    insurer_scheme_amount:schemeAmount,
    total_projected_payin:totalProjectedPayin,
    tds_percent:tdsPercent,
    tds_amount:tdsAmount,
    payin_after_tds:payinAfterTds,
    calculation_version:"non_motor_commercial_v1",
    commercial_status:payinEntered?"entered":"needs_review",
  }, { onConflict:"policy_id" });
  if (payinError) return { ok:false, error:"Projected pay-in details could not be updated. Please try again." };

  const { data: latestPayout, error: latestPayoutError } = await admin.from("policy_intermediary_payouts")
    .select("id")
    .eq("policy_id", id)
    .order("created_at", { ascending:false })
    .limit(1)
    .maybeSingle<{id:string}>();
  if (latestPayoutError) return { ok:false, error:"Partner payout details could not be loaded for update." };

  const payoutValues = {
    intermediary_type:sourceResolution.source.intermediaryType,
    intermediary_code:sourceResolution.source.intermediaryCode,
    payout_basis:payoutEntered?commercial.payoutBasis:null,
    partner_payout_percent:payoutEntered&&commercial.payoutBasis==="NET_PREMIUM_PERCENT"?payoutPercent:null,
    partner_payout_amount:payoutEntered?partnerPayoutAmount:null,
    retention_amount:retentionAmount,
    od_payout_percent:0,
    od_payout_amount:0,
    tp_payout_percent:0,
    tp_payout_amount:0,
    gross_payout:partnerPayoutAmount,
    remarks:clean(additional.remarks)||null,
    calculation_version:"non_motor_commercial_v1",
    commercial_status:payoutEntered?"entered":"needs_review",
  };
  const payoutMutation = latestPayout
    ? await admin.from("policy_intermediary_payouts").update(payoutValues).eq("id", latestPayout.id)
    : await admin.from("policy_intermediary_payouts").insert({ policy_id:id, ...payoutValues, status:"Pending", payout_date:null, voucher_number:null });
  if (payoutMutation.error) return { ok:false, error:"Partner payout details could not be updated. Please try again." };

  revalidatePath("/policies");
  revalidatePath(`/policies/${id}`);
  const activityAfter = await capturePolicyEditSnapshot(admin, id).catch(() => null);
  await recordPolicyActivity(admin, id, profile.id, POLICY_ACTIVITY_ACTIONS.POLICY_EDITED,
    describePolicyEditChanges(activityBefore, activityAfter));
  if (dateGuard.previousMonth) await recordPreviousMonthPolicyUpload(admin, id, profile.id, issuanceDate, dateGuard.approverName);
  if (dateGuard.approverName) await linkConsumedPolicyDateApproval(admin, payload.dateApprovalId, id, profile.id);
  revalidatePath(`/policies/${id}/edit`);
  return { ok:true, policyId:id, policyCode:existing.policy_code || policyNumber };
}

export async function createNonMotorPolicy(payload: NonMotorPolicyPayload): Promise<NonMotorPolicyResult> {
  const profile=await requirePolicyCreator(payload.source.intermediaryCode);
  return createNonMotorPolicyForVerifiedActor(payload,profile);
}
