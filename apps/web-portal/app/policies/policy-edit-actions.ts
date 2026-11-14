"use server";

import { isBundledMotorCover, motorBundledExpiry } from "@/lib/motor-bundled-validity";
import { policyDateDecision } from "@/lib/policy-date-rule";

import { revalidatePath } from "next/cache";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolvePolicyIntermediarySource } from "@/lib/policy-intermediary-source";
import { POLICY_ACTIVITY_ACTIONS, recordPolicyActivity, capturePolicyEditSnapshot, describePolicyEditChanges } from "@/lib/policy-activity";

export type PolicyEditPayload = {
  vehicleClass: string;
  dateApprovalId?: string | null;
  policy: {
    issuanceDate: string;
    rmName: string;
    intermediaryType: string;
    leadSource: string;
    intermediaryCode: string;
    businessLine: string;
    policyType: string;
    idv: string;
    policyNumber: string;
    insuranceCompanyId: string;
    validFrom: string;
    validUpto: string;
    odValidUpto?: string;
    tpValidUpto?: string;
    cpaValidUpto?: string;
    remarks: string;
  };
  premium: { od: string; tp: string; addOnPremium: string; cpaOpted: boolean; cpa: string };
  payin: { basis: string; odPercent: string; tpPercent: string; scheme: string; partialTp?: boolean; partialCpa?: boolean; provided: boolean };
  payout: { retention: string; odPercent: string; tpPercent: string; partialTp?: boolean; partialCpa?: boolean; flatAmount: string; status: string; date: string; voucherNumber: string; provided: boolean };
};

export type PolicyEditResult =
  | { ok: true; policyId: string; policyCode: string }
  | { ok: false; error: string };

type ExistingPayin = {
  payout_basis: string | null;
  projected_od_percent: number | null;
  projected_tp_percent: number | null;
  insurer_scheme_amount: number | null;
};
type ExistingPayout = {
  retention_amount: number | null;
  od_payout_percent: number | null;
  tp_payout_percent: number | null;
  payout_basis: string | null;
  partner_payout_amount: number | null;
  status: string | null;
  payout_date: string | null;
  voucher_number: string | null;
};

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validNumber(value: string) {
  if (value.trim() === "") return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function validPercent(value: string) {
  if (value.trim() === "") return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
}

function textNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

export async function updatePolicyOnboarding(policyId: string, payload: PolicyEditPayload): Promise<PolicyEditResult> {
  if (isBundledMotorCover(payload.vehicleClass, payload.policy.policyType)) {
    payload = {...payload, policy:{...payload.policy,validUpto: String(payload.policy.odValidUpto || motorBundledExpiry(String(payload.policy.validFrom ?? ""),1))}};
  }
  const profile = await requirePolicyEditor(policyId);

  if (!/^[0-9a-f-]{36}$/i.test(policyId)) return { ok: false, error: "Invalid policy reference." };
  if (!payload.policy.policyNumber.trim()) return { ok: false, error: "Enter the policy number." };
  if (!payload.policy.policyType.trim()) return { ok: false, error: "Select the policy product." };
  if (!payload.policy.insuranceCompanyId.trim()) return { ok: false, error: "Select an insurance company." };
  if (!validDate(payload.policy.issuanceDate) || !validDate(payload.policy.validFrom) || !validDate(payload.policy.validUpto)) {
    return { ok: false, error: "Enter valid policy issuance and validity dates." };
  }
  if (payload.policy.validUpto < payload.policy.validFrom) return { ok: false, error: "Policy Valid Upto cannot be before Valid From." };
  const dateDecision = policyDateDecision(payload.policy.issuanceDate);
  if (dateDecision === "invalid" || dateDecision === "future") return { ok: false, error: "Choose a valid issuance date within the current or an earlier month." };
  const cpaAmount = Number(payload.premium.cpa);
  if (payload.vehicleClass.trim().toUpperCase() === "GCV" && (!payload.premium.cpaOpted || !Number.isFinite(cpaAmount) || cpaAmount <= 0)) {
    return { ok: false, error: "CPA amount is mandatory for GCV policies and must be greater than 0." };
  }

  const monetaryValues = [payload.policy.idv, payload.premium.od, payload.premium.tp, payload.premium.cpa, payload.premium.addOnPremium, payload.payin.scheme, payload.payout.flatAmount];
  if (monetaryValues.some((value) => !validNumber(value))) return { ok: false, error: "Review the premium and scheme values." };

  const percentageValues = [payload.payin.odPercent, payload.payin.tpPercent, payload.payout.odPercent, payload.payout.tpPercent];
  if (percentageValues.some((value) => !validPercent(value))) return { ok: false, error: "Pay-in and payout percentages must be between 0 and 100." };

  try {
    const sourceResolution = await resolvePolicyIntermediarySource(payload.policy);
    if (!sourceResolution.ok) return { ok: false, error: sourceResolution.error };

    const admin = createSupabaseAdminClient();
    const activityBefore = await capturePolicyEditSnapshot(admin, policyId).catch(() => null);
    const { data: existingDate, error: existingDateError } = await admin.from("policies").select("issuance_date").eq("id", policyId).maybeSingle<{issuance_date: string | null}>();
    if (existingDateError || !existingDate) return { ok: false, error: "Could not confirm the existing policy date." };
    if (existingDate.issuance_date !== payload.policy.issuanceDate && dateDecision === "otp_required" && !payload.dateApprovalId) return { ok: false, error: "Email OTP approval is required to change this policy to an earlier-month date." };
    if (profile.role === "operations_head_life") {
      const { data: original } = await admin.from("policies")
        .select("intermediary_code,rm_name").eq("id", policyId)
        .maybeSingle<{ intermediary_code: string | null; rm_name: string | null }>();
      if (!original ||
          original.intermediary_code?.trim() !== sourceResolution.source.intermediaryCode ||
          (original.rm_name ?? "").trim().toLowerCase() !== payload.policy.rmName.trim().toLowerCase()) {
        return { ok: false, error: "The assigned intermediary and RM cannot be changed by this role." };
      }
    }
    let protectedPayin = payload.payin;
    let protectedPayout = payload.payout;

    if (!canAccessPolicyCommercials(profile, profile.role === "operations_head_life")) {
      const [payinResult, payoutResult] = await Promise.all([
        admin.from("policy_payin_details").select("payout_basis,projected_od_percent,projected_tp_percent,insurer_scheme_amount").eq("policy_id", policyId).maybeSingle<ExistingPayin>(),
        admin.from("policy_intermediary_payouts").select("retention_amount,od_payout_percent,tp_payout_percent,payout_basis,partner_payout_amount,status,payout_date,voucher_number").eq("policy_id", policyId).order("created_at", { ascending: false }).limit(1).maybeSingle<ExistingPayout>(),
      ]);
      if (payinResult.error || payoutResult.error) return { ok: false, error: "We couldn't preserve the restricted commercial details. Please try again." };
      const payin = payinResult.data;
      const payout = payoutResult.data;
      protectedPayin = {
        basis: payin?.payout_basis ?? "NET",
        odPercent: textNumber(payin?.projected_od_percent),
        tpPercent: textNumber(payin?.projected_tp_percent),
        scheme: textNumber(payin?.insurer_scheme_amount),
        provided: false,
      };
      protectedPayout = {
        retention: textNumber(payout?.retention_amount),
        odPercent: textNumber(payout?.od_payout_percent),
        tpPercent: textNumber(payout?.tp_payout_percent),
        status: payout?.status ?? "Pending",
        date: payout?.payout_date ?? "",
        voucherNumber: payout?.voucher_number ?? "",
        flatAmount: payout?.payout_basis === "FIXED_AMOUNT" ? textNumber(payout?.partner_payout_amount) : "",
        provided: false,
      };
    }

    const addOnAmount = Number(payload.premium.addOnPremium || 0);
    if (!Number.isFinite(addOnAmount) || addOnAmount > 100000000 || addOnAmount < 0) {
      return { ok: false, error: "Add-on Premium must be a valid non-negative amount." };
    }
    const normalizedPayload = {
      ...payload,
      policy: { ...payload.policy, ...sourceResolution.source },
      payin: protectedPayin,
      payout: protectedPayout,
    };
    const { data, error } = await admin.rpc("save_motor_policy_with_date_approval_v1", { p_requester: profile.id, p_approval_id: payload.dateApprovalId ?? null, 
      p_operation: "edit",
      p_policy_id: policyId,
      p_payload: normalizedPayload,
    });
    if (error) {
      // Keep raw SQL/constraint details server-side. Give finance reconciliation
      // failures an actionable but non-sensitive message rather than generic retry.
      if (error.code === "23514" && error.message?.includes("policy_payin_details_after_tds_consistency_check")) {
        console.error("Policy edit failed Pay-in/TDS consistency validation", { policyId, code: error.code });
        return { ok: false, error: "The policy Pay-in and TDS amounts did not balance, so no changes were saved. Please contact support." };
      }
      return { ok: false, error: "We couldn't save the policy changes. Please try again." };
    }

    const result = data as { ok?: boolean; policyId?: string; policyCode?: string } | null;
    if (!result?.ok || !result.policyId) return { ok: false, error: "We couldn't complete the policy update. Please try again." };

    const activityAfter = await capturePolicyEditSnapshot(admin, result.policyId).catch(() => null);
    await recordPolicyActivity(admin, result.policyId, profile.id, POLICY_ACTIVITY_ACTIONS.POLICY_EDITED,
      describePolicyEditChanges(activityBefore, activityAfter));
    revalidatePath("/policies");
    revalidatePath(`/policies/${policyId}/edit`);
    return { ok: true, policyId: result.policyId, policyCode: result.policyCode ?? "" };
  } catch {
    return { ok: false, error: "We couldn't save the policy changes. Please try again." };
  }
}
