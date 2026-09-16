"use server";

import { requireCapability } from "@/lib/master-data-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { previewAccountsReconciliationUpload } from "./reconciliation-upload-actions";

export type AccountsImportResult = {
  success: boolean;
  invoices: number;
  tdsEntries: number;
  receipts: number;
  partnerPayments: number;
  message: string;
};

type PolicyRef = { id: string; insurance_company_id: string | null };
type InvoiceLine = { policyId: string; policyNumber: string; projectedPayin: number; billAmount: number };

type InvoiceGroup = {
  insurerId: string;
  billNumber: string;
  billDate: string;
  actualTds: number;
  tdsDate: string;
  lines: InvoiceLine[];
};

type ReceiptGroup = {
  insurerId: string;
  receiptDate: string;
  reference: string;
  allocations: Array<{ billNumber: string; amount: number }>;
};

type PayoutGroup = {
  intermediaryCode: string;
  intermediaryType: string;
  paidDate: string;
  reference: string;
  allocations: Array<{ payoutId: string; amount: number }>;
};

export async function confirmAccountsReconciliationUpload(formData: FormData): Promise<AccountsImportResult> {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) throw new Error("Commercial details restricted");

  // Always validate the exact uploaded bytes again immediately before posting. A stale UI
  // preview can never bypass live access, commercial-value or duplicate-reference checks.
  const preview = await previewAccountsReconciliationUpload(formData);
  if (!preview.totalRows) throw new Error(preview.message || "There are no transactions to import.");
  if (preview.errorRows > 0) throw new Error(`Import blocked. Resolve ${preview.errorRows} validation error${preview.errorRows === 1 ? "" : "s"} and preview the workbook again.`);

  const db = createSupabaseAdminClient();
  const policyIds = [...new Set(preview.payinRows.map((row) => row.policyId))];
  const { data: policyData, error: policyError } = policyIds.length
    ? await db.from("policies").select("id,insurance_company_id").in("id", policyIds)
    : { data: [] as PolicyRef[], error: null };
  if (policyError) throw new Error(policyError.message);
  const insurerByPolicy = new Map(((policyData ?? []) as PolicyRef[]).map((row) => [row.id, row.insurance_company_id]));

  const invoices = new Map<string, InvoiceGroup>();
  const tdsByBillPolicy = new Map<string, number | null>();
  for (const row of preview.payinRows) {
    if (row.billAmount === null) throw new Error(`Pay-In row ${row.rowNumber} is missing Bill Amount.`);
    const insurerId = insurerByPolicy.get(row.policyId);
    if (!insurerId) throw new Error(`Pay-In row ${row.rowNumber} has no insurer.`);
    const key = `${insurerId}|${normalize(row.billNumber)}`;
    const existing = invoices.get(key);
    if (existing && existing.billDate !== row.billDate) throw new Error(`Bill ${row.billNumber} is used with different Bill Dates.`);
    const group = existing ?? { insurerId, billNumber: row.billNumber, billDate: row.billDate, actualTds: 0, tdsDate: row.receiptDate || row.billDate, lines: [] };

    // A policy row may be repeated in the workbook solely to record multiple receipt
    // installments. It must still create exactly one policy line on the insurer bill.
    const existingLine = group.lines.find((line) => line.policyId === row.policyId);
    if (existingLine) {
      if (Math.abs(existingLine.billAmount - row.billAmount) > 0.01) throw new Error(`Policy ${row.policyNumber} repeats under bill ${row.billNumber} with different Bill Amounts.`);
      if (Math.abs(existingLine.projectedPayin - row.projectedPayin) > 0.01) throw new Error(`Policy ${row.policyNumber} repeats under bill ${row.billNumber} with inconsistent projected Pay-In.`);
    } else {
      group.lines.push({ policyId: row.policyId, policyNumber: row.policyNumber, projectedPayin: row.projectedPayin, billAmount: row.billAmount });
    }

    // TDS is bill-policy accounting data, not receipt-installment data. Repeating the same
    // policy must not multiply TDS. A conflicting non-blank value is rejected.
    const tdsKey = `${key}|${row.policyId}`;
    const incomingTds = row.actualTds;
    if (tdsByBillPolicy.has(tdsKey)) {
      const previous = tdsByBillPolicy.get(tdsKey);
      if (previous != null && incomingTds !== null && Math.abs(previous - incomingTds) > 0.01) throw new Error(`Policy ${row.policyNumber} repeats under bill ${row.billNumber} with different Actual TDS values.`);
      if (previous == null && incomingTds !== null) {
        tdsByBillPolicy.set(tdsKey, incomingTds);
        group.actualTds = money(group.actualTds + incomingTds);
      }
    } else {
      tdsByBillPolicy.set(tdsKey, incomingTds);
      group.actualTds = money(group.actualTds + (incomingTds ?? 0));
    }
    if (row.receiptDate) group.tdsDate = row.receiptDate;
    invoices.set(key, group);
  }

  const receipts = new Map<string, ReceiptGroup>();
  for (const row of preview.payinRows) {
    if (row.amountReceived === null || row.amountReceived <= 0) continue;
    const insurerId = insurerByPolicy.get(row.policyId);
    if (!insurerId) throw new Error(`Pay-In row ${row.rowNumber} has no insurer.`);
    const key = `${insurerId}|${normalize(row.reference)}`;
    const existing = receipts.get(key);
    if (existing && existing.receiptDate !== row.receiptDate) throw new Error(`Receipt ${row.reference} is used with different dates.`);
    const group = existing ?? { insurerId, receiptDate: row.receiptDate, reference: row.reference, allocations: [] };

    // One UTR can cover several policy rows on the same consolidated bill. The underlying
    // receipt RPC allocates at invoice level, so combine those policy amounts into one
    // invoice allocation before posting.
    const billAllocation = group.allocations.find((allocation) => normalize(allocation.billNumber) === normalize(row.billNumber));
    if (billAllocation) billAllocation.amount = money(billAllocation.amount + row.amountReceived);
    else group.allocations.push({ billNumber: row.billNumber, amount: row.amountReceived });
    receipts.set(key, group);
  }

  const payouts = new Map<string, PayoutGroup>();
  for (const row of preview.payoutRows) {
    if (row.paidAmount === null || row.paidAmount <= 0) continue;
    const key = `${normalize(row.intermediaryCode)}|${normalize(row.reference)}`;
    const existing = payouts.get(key);
    if (existing && existing.paidDate !== row.paidDate) throw new Error(`Partner payment ${row.reference} is used with different dates.`);
    const group = existing ?? { intermediaryCode: row.intermediaryCode, intermediaryType: row.intermediaryType, paidDate: row.paidDate, reference: row.reference, allocations: [] };
    const payoutAllocation = group.allocations.find((allocation) => allocation.payoutId === row.payoutId);
    if (payoutAllocation) payoutAllocation.amount = money(payoutAllocation.amount + row.paidAmount);
    else group.allocations.push({ payoutId: row.payoutId, amount: row.paidAmount });
    payouts.set(key, group);
  }

  const { data, error } = await db.rpc("post_accounts_excel_reconciliation", {
    p_actor: profile.id,
    p_invoice_groups: [...invoices.values()],
    p_receipt_groups: [...receipts.values()],
    p_payout_groups: [...payouts.values()],
  });
  if (error) throw new Error(error.message);

  const result = (data ?? {}) as Record<string, unknown>;
  const invoiceCount = integer(result.invoices);
  const tdsCount = integer(result.tdsEntries);
  const receiptCount = integer(result.receipts);
  const paymentCount = integer(result.partnerPayments);
  return {
    success: true,
    invoices: invoiceCount,
    tdsEntries: tdsCount,
    receipts: receiptCount,
    partnerPayments: paymentCount,
    message: `Imported successfully: ${invoiceCount} bill${invoiceCount === 1 ? "" : "s"}, ${receiptCount} receipt${receiptCount === 1 ? "" : "s"}, ${tdsCount} TDS entr${tdsCount === 1 ? "y" : "ies"}, ${paymentCount} partner payment${paymentCount === 1 ? "" : "s"}.`,
  };
}

function normalize(value: string) { return value.replace(/\s+/g, "").trim().toUpperCase(); }
function money(value: number) { return Math.round(value * 100) / 100; }
function integer(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? Math.trunc(parsed) : 0; }
