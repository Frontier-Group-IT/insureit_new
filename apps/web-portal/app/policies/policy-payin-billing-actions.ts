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
  receiptReference: string;
};

export type PolicyPayinReceipt = {
  receivedAmount: string;
  receivedDate: string;
  receiptReference: string;
};

type PayinBillRow = {
  id: string;
  bill_number: string | null;
  billed_amount: number | null;
  bill_date: string | null;
  status: string | null;
  received_amount: number | null;
  received_date: string | null;
  receipt_reference: string | null;
  received_by: string | null;
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
    .select("id,bill_number,billed_amount,bill_date,status,received_amount,received_date,receipt_reference,received_by")
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
      receiptReference: data?.receipt_reference ?? "",
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
    .select("id,status,received_amount,received_date,receipt_reference,received_by")
    .eq("policy_id", policyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; status: string | null; received_amount: number | null; received_date: string | null; receipt_reference: string | null; received_by: string | null }>();
  if (lookupError) return { ok: false, error: lookupError.message };

  const alreadyReceived = existing?.status === "Received";
  if (billing.status === "Received" && !alreadyReceived) {
    return { ok: false, error: "Use Mark as Received to record insurer receipt details." };
  }
  const values = {
    bill_number: billing.billNumber.trim() || null,
    billed_amount: billedAmount,
    bill_date: billing.billDate || null,
    status: alreadyReceived ? "Received" : billing.status,
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


export async function markPolicyPayinReceived(
  policyId: string,
  receipt: PolicyPayinReceipt,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await requirePolicyEditor();
  if (!validPolicyId(policyId)) return { ok: false, error: "Invalid policy reference." };
  const receivedAmount = amount(receipt.receivedAmount);
  if (receivedAmount === null || receivedAmount <= 0) return { ok: false, error: "Received Amount must be greater than zero." };
  if (!receipt.receivedDate || !validDate(receipt.receivedDate)) return { ok: false, error: "Enter a valid Received Date." };

  const admin = createSupabaseAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("policy_payin_bills")
    .select("id,bill_number,billed_amount,bill_date,status,received_amount,received_date,receipt_reference,received_by")
    .eq("policy_id", policyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PayinBillRow>();
  if (lookupError) return { ok: false, error: lookupError.message };
  if (!existing) return { ok: false, error: "Save the PayIn bill before marking it as received." };
  if (!existing.bill_number || !existing.bill_date || Number(existing.billed_amount ?? 0) <= 0) {
    return { ok: false, error: "Complete PayIn Billed Amt, Bill No. and Bill Date before marking the pay-in as received." };
  }
  if (existing.status === "Received") return { ok: true };

  const now = new Date().toISOString();
  const receiptReference = receipt.receiptReference.trim() || null;
  const { error: updateError } = await admin
    .from("policy_payin_bills")
    .update({
      status: "Received",
      received_amount: receivedAmount,
      received_date: receipt.receivedDate,
      receipt_reference: receiptReference,
      received_by: profile.id,
      updated_at: now,
    })
    .eq("id", existing.id);
  if (updateError) return { ok: false, error: updateError.message };

  await admin.from("audit_logs").insert({
    actor_id: profile.id,
    action: "policy_payin_received",
    table_name: "policy_payin_bills",
    record_id: existing.id,
    old_data: existing,
    new_data: {
      ...existing,
      status: "Received",
      received_amount: receivedAmount,
      received_date: receipt.receivedDate,
      receipt_reference: receiptReference,
      received_by: profile.id,
      updated_at: now,
    },
  });

  revalidatePath("/policies");
  revalidatePath(`/policies/${policyId}/edit`);
  return { ok: true };
}
