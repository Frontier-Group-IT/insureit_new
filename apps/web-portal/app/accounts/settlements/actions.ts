"use server";

import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

async function requireAccountsUser() {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) throw new Error("Commercial details restricted");
  return profile;
}
const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;
function one<T>(v: T | T[] | null | undefined): T | null { return Array.isArray(v) ? (v[0] ?? null) : (v ?? null); }

export async function listSettlementWorkbench() {
  await requireAccountsUser();
  const db = createSupabaseAdminClient();
  const [{ data: invoices, error: invoiceError }, { data: receipts, error: receiptError }, { data: tds, error: tdsError }] = await Promise.all([
    db.from("accounts_invoices").select("id,insurer_id,invoice_no,invoice_date,due_date,status,gross_invoice_amount,outstanding_amount,insurance_companies(name)").in("status", ["Raised","Partially Received"]).gt("outstanding_amount", 0).order("invoice_date", { ascending: true }).limit(1000),
    db.from("accounts_receipts").select("id,insurer_id,receipt_date,bank_reference,bank_amount,created_at,insurance_companies(name),accounts_receipt_allocations(id,invoice_id,allocated_amount,accounts_invoices(invoice_no))").order("receipt_date", { ascending: false }).limit(500),
    db.from("accounts_tds_entries").select("id,insurer_id,invoice_id,tds_date,tds_amount,certificate_period,certificate_reference,matched_status,accounts_invoices(invoice_no),insurance_companies(name)").order("tds_date", { ascending: false }).limit(500),
  ]);
  if (invoiceError) throw new Error(invoiceError.message);
  if (receiptError) throw new Error(receiptError.message);
  if (tdsError) throw new Error(tdsError.message);
  return {
    invoices: (invoices ?? []).map((r) => ({ ...r, insurerName: one(r.insurance_companies)?.name ?? "" })),
    receipts: receipts ?? [],
    tds: tds ?? [],
  };
}

export async function recordReceipt(input: { insurerId: string; receiptDate: string; bankReference: string; bankAmount: number; notes?: string; allocations: Array<{ invoiceId: string; amount: number }> }) {
  const profile = await requireAccountsUser();
  const db = createSupabaseAdminClient();
  const bankAmount = money(input.bankAmount);
  if (!input.insurerId || !/^\d{4}-\d{2}-\d{2}$/.test(input.receiptDate) || !input.bankReference.trim() || bankAmount <= 0) throw new Error("Insurer, receipt date, bank reference and a positive bank amount are required.");
  const allocations = input.allocations.map((a) => ({ invoiceId: a.invoiceId, amount: money(a.amount) })).filter((a) => a.invoiceId && a.amount > 0);
  const allocatedTotal = money(allocations.reduce((s, a) => s + a.amount, 0));
  if (!allocations.length || allocatedTotal !== bankAmount) throw new Error("Invoice allocations must equal the bank receipt amount.");
  const { data, error } = await db.rpc("post_accounts_receipt", {
    p_insurer_id: input.insurerId,
    p_receipt_date: input.receiptDate,
    p_bank_reference: input.bankReference.trim(),
    p_bank_amount: bankAmount,
    p_notes: input.notes?.trim() || null,
    p_created_by: profile.id,
    p_allocations: allocations,
  });
  if (error) throw new Error(error.message);
  return { receiptId: String(data) };
}

export async function recordTds(input: { invoiceId: string; tdsDate: string; tdsAmount: number; certificatePeriod?: string; certificateReference?: string; matchedStatus?: "Pending"|"Matched"|"Mismatch"; notes?: string }) {
  const profile = await requireAccountsUser();
  const db = createSupabaseAdminClient();
  const amount = money(input.tdsAmount);
  if (!input.invoiceId || !/^\d{4}-\d{2}-\d{2}$/.test(input.tdsDate) || amount <= 0) throw new Error("Invoice, TDS date and a positive TDS amount are required.");
  const { data, error } = await db.rpc("post_accounts_tds", {
    p_invoice_id: input.invoiceId,
    p_tds_date: input.tdsDate,
    p_tds_amount: amount,
    p_certificate_period: input.certificatePeriod?.trim() || null,
    p_certificate_reference: input.certificateReference?.trim() || null,
    p_matched_status: input.matchedStatus ?? "Pending",
    p_notes: input.notes?.trim() || null,
    p_created_by: profile.id,
  });
  if (error) throw new Error(error.message);
  return { tdsId: String(data) };
}
