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
  billing: { billNumber: string; billedAmount: string; billDate: string; status: string };
  payout: { retention: string; odPercent: string; tpPercent: string; status: string; date: string; voucherNumber: string };
};

export type PolicyEditResult =
  | { ok: true; policyId: string; policyCode: string }
  | { ok: false; error: string };

type PayinBillRow = {
  id: string;
  status: string;
  received_amount: number | null;
  received_date: string | null;
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

function numberValue(value: string) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function automaticBillingStatus(payload: PolicyEditPayload["billing"]) {
  const billNumber = payload.billNumber.trim();
  const billDate = payload.billDate.trim();
  const amount = numberValue(payload.billedAmount);
  if (!billNumber && !billDate) return "Unbilled";
  if (amount > 0 && billNumber && validDate(billDate)) return "Billed";
  return "Billing details incomplete";
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
  if (payload.billing.billDate && !validDate(payload.billing.billDate)) return { ok: false, error: "Enter a valid PayIn Bill Date." };

  const monetaryValues = [
    payload.policy.idv,
    payload.premium.od,
    payload.premium.tp,
    payload.premium.cpa,
    payload.payin.scheme,
    payload.billing.billedAmount,
  ];
  if (monetaryValues.some((value) => !validNumber(value))) return { ok: false, error: "Review the premium, pay-in and billing values." };

  const percentageValues = [
    payload.payin.odPercent,
    payload.payin.tpPercent,
    payload.payout.odPercent,
    payload.payout.tpPercent,
  ];
  if (percentageValues.some((value) => !validPercent(value))) return { ok: false, error: "Pay-in and payout percentages must be between 0 and 100." };

  const allowedBillingStatuses = new Set(["Unbilled", "Billing details incomplete", "Billed", "Received"]);
  if (!allowedBillingStatuses.has(payload.billing.status)) return { ok: false, error: "Select a valid PayIn status." };
  if (payload.billing.status === "Received" && automaticBillingStatus(payload.billing) !== "Billed") {
    return { ok: false, error: "Complete the PayIn billed amount, bill number and bill date before marking the pay-in as Received." };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("update_motor_policy", {
      p_policy_id: policyId,
      p_payload: payload,
    });
    if (error) return { ok: false, error: error.message };

    const result = data as { ok?: boolean; policyId?: string; policyCode?: string } | null;
    if (!result?.ok || !result.policyId) return { ok: false, error: "Policy update completed without a valid result." };

    const { data: existingBill, error: existingBillError } = await admin
      .from("policy_payin_bills")
      .select("id,status,received_amount,received_date")
      .eq("policy_id", policyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<PayinBillRow>();
    if (existingBillError) return { ok: false, error: existingBillError.message };

    const billedAmount = numberValue(payload.billing.billedAmount);
    const totalProjectedPayin =
      numberValue(payload.premium.od) * numberValue(payload.payin.odPercent) / 100
      + numberValue(payload.premium.tp) * numberValue(payload.payin.tpPercent) / 100
      + numberValue(payload.payin.scheme);
    const shortPayoutAmount = Math.max(totalProjectedPayin - billedAmount, 0);
    const isAlreadyReceived = existingBill?.status === "Received";
    const effectiveStatus = isAlreadyReceived || payload.billing.status === "Received"
      ? "Received"
      : automaticBillingStatus(payload.billing);
    const receivedDate = effectiveStatus === "Received"
      ? existingBill?.received_date || new Date().toISOString().slice(0, 10)
      : null;
    const receivedAmount = effectiveStatus === "Received"
      ? billedAmount
      : existingBill?.received_amount ?? 0;

    const billingRecord = {
      policy_id: policyId,
      bill_number: payload.billing.billNumber.trim() || null,
      billed_amount: billedAmount,
      bill_date: payload.billing.billDate || null,
      status: effectiveStatus,
      short_payout_amount: shortPayoutAmount,
      received_amount: receivedAmount,
      received_date: receivedDate,
      updated_at: new Date().toISOString(),
    };

    const billingWrite = existingBill
      ? await admin.from("policy_payin_bills").update(billingRecord).eq("id", existingBill.id)
      : await admin.from("policy_payin_bills").insert(billingRecord);
    if (billingWrite.error) return { ok: false, error: billingWrite.error.message };

    revalidatePath("/policies");
    revalidatePath(`/policies/${policyId}/edit`);
    return { ok: true, policyId: result.policyId, policyCode: result.policyCode ?? "" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Policy could not be updated." };
  }
}
