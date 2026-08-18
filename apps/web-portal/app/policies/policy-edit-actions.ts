"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolvePolicyIntermediarySource } from "@/lib/policy-intermediary-source";
import { POLICY_ACTIVITY_ACTIONS, recordPolicyActivity } from "@/lib/policy-activity";

export type PolicyEditPayload = {
  vehicleClass: string;
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
    remarks: string;
  };
  premium: { od: string; tp: string; cpaOpted: boolean; cpa: string };
  payin: { basis: string; odPercent: string; tpPercent: string; scheme: string };
  payout: { retention: string; odPercent: string; tpPercent: string; status: string; date: string; voucherNumber: string };
};

export type PolicyEditResult =
  | { ok: true; policyId: string; policyCode: string }
  | { ok: false; error: string };

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

export async function updatePolicyOnboarding(policyId: string, payload: PolicyEditPayload): Promise<PolicyEditResult> {
  const profile = await requirePolicyEditor();

  if (!/^[0-9a-f-]{36}$/i.test(policyId)) return { ok: false, error: "Invalid policy reference." };
  if (!payload.policy.policyNumber.trim()) return { ok: false, error: "Enter the policy number." };
  if (!payload.policy.policyType.trim()) return { ok: false, error: "Select the policy product." };
  if (!payload.policy.insuranceCompanyId.trim()) return { ok: false, error: "Select an insurance company." };
  if (!validDate(payload.policy.issuanceDate) || !validDate(payload.policy.validFrom) || !validDate(payload.policy.validUpto)) {
    return { ok: false, error: "Enter valid policy issuance and validity dates." };
  }
  if (payload.policy.validUpto < payload.policy.validFrom) return { ok: false, error: "Policy Valid Upto cannot be before Valid From." };
  const cpaAmount = Number(payload.premium.cpa);
  if (payload.vehicleClass.trim().toUpperCase() === "GCV" && (!payload.premium.cpaOpted || !Number.isFinite(cpaAmount) || cpaAmount <= 0)) {
    return { ok: false, error: "CPA amount is mandatory for GCV policies and must be greater than 0." };
  }

  const monetaryValues = [
    payload.policy.idv,
    payload.premium.od,
    payload.premium.tp,
    payload.premium.cpa,
    payload.payin.scheme,
  ];
  if (monetaryValues.some((value) => !validNumber(value))) return { ok: false, error: "Review the premium, scheme and retention values." };

  const percentageValues = [
    payload.payin.odPercent,
    payload.payin.tpPercent,
    payload.payout.odPercent,
    payload.payout.tpPercent,
  ];
  if (percentageValues.some((value) => !validPercent(value))) return { ok: false, error: "Pay-in and payout percentages must be between 0 and 100." };

  try {
    const sourceResolution = await resolvePolicyIntermediarySource(payload.policy);
    if (!sourceResolution.ok) return { ok: false, error: sourceResolution.error };
    const normalizedPayload = { ...payload, policy: { ...payload.policy, ...sourceResolution.source } };
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("update_motor_policy", {
      p_policy_id: policyId,
      p_payload: normalizedPayload,
    });
    if (error) return { ok: false, error: "We couldn't save the policy changes. Please try again." };

    const result = data as { ok?: boolean; policyId?: string; policyCode?: string } | null;
    if (!result?.ok || !result.policyId) return { ok: false, error: "We couldn't complete the policy update. Please try again." };

    await recordPolicyActivity(admin, result.policyId, profile.id, POLICY_ACTIVITY_ACTIONS.POLICY_EDITED);
    revalidatePath("/policies");
    revalidatePath(`/policies/${policyId}/edit`);
    return { ok: true, policyId: result.policyId, policyCode: result.policyCode ?? "" };
  } catch {
    return { ok: false, error: "We couldn't save the policy changes. Please try again." };
  }
}
