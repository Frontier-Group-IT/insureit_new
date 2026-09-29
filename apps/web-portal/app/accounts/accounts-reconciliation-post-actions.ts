"use server";

import { requireCapability } from "@/lib/master-data-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  loadAccountsPolicyReconciliationDetailAction,
  loadAccountsPolicyReconciliationDetailForRowAction,
  type AccountsPolicyReconciliationDetail,
  type AccountsPolicyReconciliationLookup,
} from "./accounts-reconciliation-detail-actions";

export type DirectPayinInput = {
  lookup: AccountsPolicyReconciliationLookup;
  billNumber: string;
  billAmount: number;
  billDate: string;
  actualTds?: number;
  remarks?: string;
};

export type DirectPayoutInput = {
  lookup: AccountsPolicyReconciliationLookup;
  paidAmount: number;
  paidDate: string;
  reference: string;
  remarks?: string;
};

export type DirectPayoutResult =
  | { ok: true; detail: AccountsPolicyReconciliationDetail }
  | { ok: false; error: string };

export async function postAccountsDirectPayinAction(input: DirectPayinInput): Promise<AccountsPolicyReconciliationDetail> {
  const profile = await requireAccountsPostingAccess();
  const resolved = await loadAccountsPolicyReconciliationDetailForRowAction(input.lookup);
  const billNumber = text(input.billNumber);
  const billDate = isoDate(input.billDate);
  const billAmount = money(input.billAmount);
  const actualTds = money(input.actualTds ?? 0);

  if (!billNumber) throw new Error("Bill Number is required.");
  if (!billDate) throw new Error("Choose a valid Bill Date.");
  if (billAmount <= 0) throw new Error("Bill Amount must be greater than zero.");
  if (actualTds < 0 || actualTds > billAmount) throw new Error("TDS must be between zero and the Bill Amount.");

  const db = createSupabaseAdminClient();
  const { error } = await db.rpc("post_accounts_policy_reconciliation_entry", {
    p_actor: profile.id,
    p_policy_id: resolved.policyId,
    p_entry_type: "payin",
    p_payload: {
      billNumber,
      billDate,
      billAmount,
      actualTds,
      remarks: optionalText(input.remarks),
    },
  });
  if (error) throw new Error(publicPostingError(error.message, "Pay-In"));

  return loadAccountsPolicyReconciliationDetailAction(resolved.policyId);
}

export async function postAccountsDirectPayoutAction(input: DirectPayoutInput): Promise<DirectPayoutResult> {
  const profile = await requireAccountsPostingAccess();
  const resolved = await loadAccountsPolicyReconciliationDetailForRowAction(input.lookup);
  const paidDate = isoDate(input.paidDate);
  const reference = text(input.reference);
  const paidAmount = money(input.paidAmount);

  if (!paidDate) return { ok: false, error: "Choose a valid Paid Date." };
  if (!reference) return { ok: false, error: "UTR / reference is required." };
  if (paidAmount <= 0) return { ok: false, error: "Paid Amount must be greater than zero." };

  const db = createSupabaseAdminClient();
  const { error } = await db.rpc("post_accounts_policy_reconciliation_entry", {
    p_actor: profile.id,
    p_policy_id: resolved.policyId,
    p_entry_type: "payout",
    p_payload: {
      paidDate,
      reference,
      paidAmount,
      remarks: optionalText(input.remarks),
    },
  });
  if (error) return { ok: false, error: publicPostingError(error.message, "Payout") };

  return { ok: true, detail: await loadAccountsPolicyReconciliationDetailAction(resolved.policyId) };
}

async function requireAccountsPostingAccess() {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) throw new Error("Commercial details restricted");
  return profile;
}

function publicPostingError(message: string | null | undefined, kind: "Pay-In" | "Payout") {
  const value = String(message ?? "");

  if (
    value.includes("No partner payout is configured for this policy") ||
    value.includes("Payout is not available for payment") ||
    value.includes("Zero agreed payout does not create a payable")
  ) {
    return "No payout amount is currently payable for this policy.";
  }

  if (value.includes("Partner commercial must be entered/reviewed before payment")) {
    return "Partner commercial must be entered/reviewed before payment.";
  }

  if (value.includes("This UTR/reference is already recorded for the intermediary")) {
    return "This UTR / reference has already been used for this intermediary.";
  }

  if (value.includes("Paid Amount exceeds the remaining payable balance")) {
    return "Paid Amount exceeds the remaining payable balance.";
  }

  if (value.includes("Historical/non-pending payout cannot be converted automatically")) {
    return "This payout is not available for direct payment posting.";
  }

  const known = [
    "This Pay-In entry is already recorded for the policy",
    "TDS must be between zero and the Bill Amount",
    "Policy insurer is required for Pay-In reconciliation",
    "This policy has multiple payout records",
    "Intermediary code is required before posting payout",
  ];
  const matched = known.find((candidate) => value.includes(candidate));
  if (matched) return matched.endsWith(".") ? matched : `${matched}.`;
  return `${kind} could not be posted. No accounting entry was saved.`;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function optionalText(value: unknown) {
  return text(value) || null;
}

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function isoDate(value: unknown) {
  const normalized = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}
