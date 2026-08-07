"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PolicyEditPayload = {
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

export async function updatePolicyOnboarding(policyId: string, payload: PolicyEditPayload): Promise<PolicyEditResult> {
  await requirePolicyEditor();

  if (!/^[0-9a-f-]{36}$/i.test(policyId)) return { ok: false, error: "Invalid policy reference." };
  if (!payload.policy.policyNumber.trim()) return { ok: false, error: "Enter the policy number." };
  if (!payload.policy.policyType.trim()) return { ok: false, error: "Select the policy product." };
  if (!payload.policy.insuranceCompanyId.trim()) return { ok: false, error: "Select an insurance company." };
  if (!validDate(payload.policy.issuanceDate) || !validDate(payload.policy.validFrom) || !validDate(payload.policy.validUpto)) {
    return { ok: false, error: "Enter valid policy issuance and validity dates." };
  }
  if (payload.policy.validUpto < payload.policy.validFrom) return { ok: false, error: "Policy Valid Upto cannot be before Valid From." };

  const numericValues = [
    payload.policy.idv,
    payload.premium.od,
    payload.premium.tp,
    payload.premium.cpa,
    payload.payin.odPercent,
    payload.payin.tpPercent,
    payload.payin.scheme,
    payload.payout.retention,
    payload.payout.odPercent,
    payload.payout.tpPercent,
  ];
  if (numericValues.some((value) => !validNumber(value))) return { ok: false, error: "Review the premium, pay-in and payout numeric values." };

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("update_motor_policy", {
      p_policy_id: policyId,
      p_payload: payload,
    });
    if (error) return { ok: false, error: error.message };

    const result = data as { ok?: boolean; policyId?: string; policyCode?: string } | null;
    if (!result?.ok || !result.policyId) return { ok: false, error: "Policy update completed without a valid result." };

    revalidatePath("/policies");
    revalidatePath(`/policies/${policyId}/edit`);
    return { ok: true, policyId: result.policyId, policyCode: result.policyCode ?? "" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Policy could not be updated." };
  }
}
