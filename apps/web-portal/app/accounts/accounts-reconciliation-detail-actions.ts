"use server";

import { loadBusinessMisRecordsByPolicyIds } from "@/lib/accounts-business-mis";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireCapability } from "@/lib/master-data-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";

export type AccountsPolicyReconciliationLookup = {
  policyNumber: string;
  registrationNumber?: string;
  insuredName?: string;
  insurerName?: string;
};

export type AccountsPayinHistoryItem = {
  id: string;
  invoiceId: string;
  billNumber: string;
  billAmount: number;
  billDate: string;
  status: "Posted" | "Edited" | "Reversed";
  correctionReason: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
};

export type AccountsPayoutHistoryItem = {
  id: string;
  paymentId: string;
  payoutId: string;
  paidAmount: number;
  paidDate: string;
  reference: string;
  status: "Posted" | "Edited" | "Reversed";
  correctionReason: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
};

export type AccountsPolicyReconciliationDetail = {
  policyId: string;
  payoutId: string;
  policyNumber: string;
  registrationNumber: string;
  insuredName: string;
  insurerName: string;
  projectedPayin: number;
  cumulativeBillAmount: number;
  payinDifference: number;
  tds: number;
  projectedPayout: number;
  cumulativePaidAmount: number;
  payoutDifference: number;
  payinHistory: AccountsPayinHistoryItem[];
  payoutHistory: AccountsPayoutHistoryItem[];
};

type InvoiceLineRow = {
  id: string;
  invoice_id: string;
  invoice_line_amount: number | string | null;
  created_at: string;
};

type InvoiceRow = {
  id: string;
  invoice_no: string | null;
  invoice_date: string | null;
  status: string | null;
  created_at: string;
  created_by: string | null;
};

type PayableRow = {
  id: string;
  policy_payout_id: string;
};

type AllocationRow = {
  id: string;
  payment_id: string;
  payable_id: string;
  allocated_amount: number | string | null;
  created_at: string;
};

type PaymentRow = {
  id: string;
  payment_date: string | null;
  payment_reference: string | null;
  payment_amount: number | string | null;
  created_at: string;
  created_by: string | null;
};

type CorrectionRow = {
  entry_type: "payin" | "payout";
  target_id: string;
  action: "edit" | "reverse";
  reason: string;
  before_payload: Record<string, unknown> | null;
  after_payload: Record<string, unknown> | null;
  created_at: string;
};

export async function loadAccountsPolicyReconciliationDetailForRowAction(
  lookup: AccountsPolicyReconciliationLookup,
): Promise<AccountsPolicyReconciliationDetail> {
  const policyNumber = String(lookup?.policyNumber ?? "").trim();
  if (!policyNumber) throw new Error("Policy number is required.");

  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) throw new Error("Commercial details restricted");

  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from("policies")
    .select("id")
    .eq("policy_no", policyNumber)
    .limit(25);

  if (error) throw new Error("Unable to resolve the selected policy.");
  const candidateIds = (data ?? []).map((item) => String(item.id ?? "")).filter(Boolean);
  if (!candidateIds.length) throw new Error("The selected policy is no longer available.");

  const scopedRecords = await loadBusinessMisRecordsByPolicyIds(profile, candidateIds);
  const normalizedRegistration = normalizeText(lookup.registrationNumber);
  const normalizedInsured = normalizeText(lookup.insuredName);
  const normalizedInsurer = normalizeText(lookup.insurerName);

  const matching = scopedRecords.filter((record) => {
    const row = record.row;
    if (normalizeText(row[12]) !== normalizeText(policyNumber)) return false;
    if (normalizedRegistration && normalizeText(row[6]) !== normalizedRegistration) return false;
    if (normalizedInsured && normalizeText(row[7]) !== normalizedInsured) return false;
    if (normalizedInsurer && normalizeText(row[13]) !== normalizedInsurer) return false;
    return true;
  });

  if (!matching.length) throw new Error("Policy is not available in your Accounts scope.");
  if (matching.length > 1) throw new Error("More than one policy matches this Business MIS row. Please narrow the selection before opening reconciliation history.");

  return loadAccountsPolicyReconciliationDetailAction(matching[0].policyId);
}

export async function loadAccountsPolicyReconciliationDetailAction(
  policyId: string,
): Promise<AccountsPolicyReconciliationDetail> {
  const normalizedPolicyId = String(policyId ?? "").trim();
  if (!normalizedPolicyId) throw new Error("Policy is required.");

  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) throw new Error("Commercial details restricted");

  const scopedRecords = await loadBusinessMisRecordsByPolicyIds(profile, [normalizedPolicyId]);
  const record = scopedRecords[0];
  if (!record || record.policyId !== normalizedPolicyId) throw new Error("Policy is not available in your Accounts scope.");

  const row = record.row;
  const db = createSupabaseAdminClient();

  const [invoiceLinesResult, payablesResult, correctionsResult] = await Promise.all([
    db
      .from("accounts_invoice_lines")
      .select("id,invoice_id,invoice_line_amount,created_at")
      .eq("policy_id", normalizedPolicyId)
      .order("created_at", { ascending: true }),
    db
      .from("partner_payables")
      .select("id,policy_payout_id")
      .eq("policy_id", normalizedPolicyId),
    db
      .from("accounts_reconciliation_corrections")
      .select("entry_type,target_id,action,reason,before_payload,after_payload,created_at")
      .eq("policy_id", normalizedPolicyId)
      .order("created_at", { ascending: true }),
  ]);

  if (invoiceLinesResult.error) throw new Error("Unable to load Pay-In reconciliation history.");
  if (payablesResult.error) throw new Error("Unable to load Payout reconciliation history.");
  if (correctionsResult.error && correctionsResult.error.code !== "42P01") throw new Error("Unable to load reconciliation audit history.");

  const corrections = ((correctionsResult.data ?? []) as CorrectionRow[]);
  const latestCorrection = new Map<string, CorrectionRow>();
  for (const correction of corrections) latestCorrection.set(`${correction.entry_type}:${correction.target_id}`, correction);

  const invoiceLines = (invoiceLinesResult.data ?? []) as InvoiceLineRow[];
  const invoiceIds = [...new Set(invoiceLines.map((item) => item.invoice_id).filter(Boolean))];
  const invoiceResult = invoiceIds.length
    ? await db
        .from("accounts_invoices")
        .select("id,invoice_no,invoice_date,status,created_at,created_by")
        .in("id", invoiceIds)
    : { data: [], error: null };

  if (invoiceResult.error) throw new Error("Unable to load Pay-In reconciliation history.");

  const invoices = new Map(
    ((invoiceResult.data ?? []) as InvoiceRow[]).map((item) => [item.id, item]),
  );

  const payinHistory = invoiceLines
    .map((line): AccountsPayinHistoryItem | null => {
      const invoice = invoices.get(line.invoice_id);
      if (!invoice) return null;
      const correction = latestCorrection.get(`payin:${invoice.id}`);
      const reversed = correction?.action === "reverse" || invoice.status === "Cancelled";
      return {
        id: line.id,
        invoiceId: line.invoice_id,
        billNumber: invoice.invoice_no ?? "",
        billAmount: amount(line.invoice_line_amount),
        billDate: invoice.invoice_date ?? "",
        status: correction?.action === "reverse" ? "Reversed" : correction?.action === "edit" ? "Edited" : "Posted",
        correctionReason: correction?.reason ?? "",
        isActive: !reversed,
        createdAt: line.created_at || invoice.created_at,
        createdBy: invoice.created_by,
      };
    })
    .filter((item): item is AccountsPayinHistoryItem => item !== null)
    .sort((a, b) => `${a.billDate}|${a.createdAt}`.localeCompare(`${b.billDate}|${b.createdAt}`));

  const payables = (payablesResult.data ?? []) as PayableRow[];
  const payableIds = payables.map((item) => item.id);
  const payoutIdByPayable = new Map(payables.map((item) => [item.id, item.policy_payout_id]));

  const allocationsResult = payableIds.length
    ? await db
        .from("partner_payment_allocations")
        .select("id,payment_id,payable_id,allocated_amount,created_at")
        .in("payable_id", payableIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (allocationsResult.error) throw new Error("Unable to load Payout reconciliation history.");

  const allocations = (allocationsResult.data ?? []) as AllocationRow[];
  const paymentIds = [...new Set(allocations.map((item) => item.payment_id).filter(Boolean))];
  const paymentsResult = paymentIds.length
    ? await db
        .from("partner_payments")
        .select("id,payment_date,payment_reference,payment_amount,created_at,created_by")
        .in("id", paymentIds)
    : { data: [], error: null };

  if (paymentsResult.error) throw new Error("Unable to load Payout reconciliation history.");

  const payments = new Map(
    ((paymentsResult.data ?? []) as PaymentRow[]).map((item) => [item.id, item]),
  );

  const payoutHistory = allocations
    .map((allocation): AccountsPayoutHistoryItem | null => {
      const payment = payments.get(allocation.payment_id);
      const payoutId = payoutIdByPayable.get(allocation.payable_id);
      if (!payment || !payoutId) return null;
      const correction = latestCorrection.get(`payout:${payment.id}`);
      const reversed = correction?.action === "reverse" || amount(allocation.allocated_amount) <= 0;
      const originalAmount = amount(correction?.before_payload?.paidAmount);
      return {
        id: allocation.id,
        paymentId: allocation.payment_id,
        payoutId,
        paidAmount: reversed && originalAmount > 0 ? originalAmount : amount(allocation.allocated_amount),
        paidDate: payment.payment_date ?? "",
        reference: payment.payment_reference ?? "",
        status: correction?.action === "reverse" ? "Reversed" : correction?.action === "edit" ? "Edited" : "Posted",
        correctionReason: correction?.reason ?? "",
        isActive: !reversed,
        createdAt: allocation.created_at || payment.created_at,
        createdBy: payment.created_by,
      };
    })
    .filter((item): item is AccountsPayoutHistoryItem => item !== null)
    .sort((a, b) => `${a.paidDate}|${a.createdAt}`.localeCompare(`${b.paidDate}|${b.createdAt}`));

  const projectedPayin = amount(row[19]);
  const cumulativeBillAmount = payinHistory.filter((item) => item.isActive).reduce((sum, item) => sum + item.billAmount, 0);
  const projectedPayout = amount(row[27]);
  const cumulativePaidAmount = payoutHistory.filter((item) => item.isActive).reduce((sum, item) => sum + item.paidAmount, 0);

  return {
    policyId: record.policyId,
    payoutId: record.payoutId,
    policyNumber: String(row[12] ?? ""),
    registrationNumber: String(row[6] ?? ""),
    insuredName: String(row[7] ?? ""),
    insurerName: String(row[13] ?? ""),
    projectedPayin,
    cumulativeBillAmount,
    payinDifference: roundMoney(projectedPayin - cumulativeBillAmount),
    tds: amount(row[24]),
    projectedPayout,
    cumulativePaidAmount,
    payoutDifference: roundMoney(projectedPayout - cumulativePaidAmount),
    payinHistory,
    payoutHistory,
  };
}

function amount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN");
}
