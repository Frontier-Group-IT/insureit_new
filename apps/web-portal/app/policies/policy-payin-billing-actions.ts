"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PolicyPayinStatus = "Unbilled" | "Billing details incomplete" | "Billed" | "Received";

export type PolicyPayinBilling = {
  billNumber: string;
  billedAmount: string;
  billDate: string;
  status: PolicyPayinStatus;
  receivedAmount: string;
  receivedDate: string;
};

type PayinBillRow = {
  id: string;
  bill_number: string | null;
  billed_amount: number | null;
  bill_date: string | null;
  status: string | null;
  received_amount: number | null;
  received_date: string | null;
};

const allowedStatuses = new Set<PolicyPayinStatus>([
  "Unbilled",
  "Billing details incomplete",
  "Billed",
  "Received",
]);

function validPolicyId(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

function validDate(value: string) {
  return value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function amount(value: string) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizedStatus(value: string | null): PolicyPayinStatus {
  return allowedStatuses.has(value as PolicyPayinStatus) ? (value as PolicyPayinStatus) : "Unbilled";
}

export async function loadPolicyPayinBilling(policyId: string): Promise<{ ok: true; billing: PolicyPayinBilling } | { ok: false; error: string }> {
  await requirePolicyEditor();
  if (!validPolicyId(policyId)) return { ok: false, error: "Invalid policy reference." };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("policy_payin_bills")
    .select("id,bill_number,billed_amount,bill_date,status,received_amount,received_date")
    .eq("policy_id", policyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PayinBillRow>();

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    billing: {
      billNumber: data?.bill_number ?? "",
      billedAmount: data?.billed_amount === null || data?.billed_amount === undefined ? "" : String(data.billed_amount),
      billDate: data?.bill_date ?? "",
      status: normalizedStatus(data?.status ?? null),
      receivedAmount: data?.received_amount === null || data?.received_amount === undefined ? "" : String(data.received_amount),
      receivedDate: data?.received_date ?? "",
    },
  };
}

export async function savePolicyPayinBilling(
  policyId: string,
  billing: Pick<PolicyPayinBilling, "billNumber" | "billedAmount" | "billDate" | "status">,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePolicyEditor();
  if (!validPolicyId(policyId)) return { ok: false, error: "Invalid policy reference." };
  const billedAmount = amount(billing.billedAmount);
  if (billedAmount === null) return { ok: false, error: "PayIn Billed Amt Rs. must be zero or a positive amount." };
  if (!validDate(billing.billDate)) return { ok: false, error: "Enter a valid PayIn Bill Date." };
  if (!allowedStatuses.has(billing.status)) return { ok: false, error: "Invalid PayIn Status." };

  const admin = createSupabaseAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("policy_payin_bills")
    .select("id")
    .eq("policy_id", policyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (lookupError) return { ok: false, error: lookupError.message };

  const received = billing.status === "Received";
  const values = {
    bill_number: billing.billNumber.trim() || null,
    billed_amount: billedAmount,
    bill_date: billing.billDate || null,
    status: billing.status,
    received_amount: received ? billedAmount : 0,
    received_date: received ? new Date().toISOString().slice(0, 10) : null,
    short_payout_amount: 0,
    updated_at: new Date().toISOString(),
  };

  const result = existing?.id
    ? await admin.from("policy_payin_bills").update(values).eq("id", existing.id)
    : await admin.from("policy_payin_bills").insert({ policy_id: policyId, ...values });
  if (result.error) return { ok: false, error: result.error.message };

  revalidatePath("/policies");
  revalidatePath(`/policies/${policyId}/edit`);
  return { ok: true };
}
