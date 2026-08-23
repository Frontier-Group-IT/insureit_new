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

  const { data: invoices, error } = await db.from("accounts_invoices").select("id,insurer_id,status,outstanding_amount,invoice_no").in("id", allocations.map((a) => a.invoiceId));
  if (error || !invoices || invoices.length !== allocations.length) throw new Error(error?.message ?? "Unable to load selected invoices.");
  for (const allocation of allocations) {
    const invoice = invoices.find((i) => i.id === allocation.invoiceId)!;
    if (invoice.insurer_id !== input.insurerId || !["Raised","Partially Received"].includes(invoice.status) || allocation.amount > money(invoice.outstanding_amount)) throw new Error("Receipt allocation exceeds an eligible invoice balance or mixes insurers.");
  }

  const { data: receipt, error: receiptError } = await db.from("accounts_receipts").insert({ insurer_id: input.insurerId, receipt_date: input.receiptDate, bank_reference: input.bankReference.trim(), bank_amount: bankAmount, notes: input.notes?.trim() || null, created_by: profile.id }).select("id").single();
  if (receiptError || !receipt) throw new Error(receiptError?.message ?? "Unable to record receipt.");

  const { error: allocError } = await db.from("accounts_receipt_allocations").insert(allocations.map((a) => ({ receipt_id: receipt.id, invoice_id: a.invoiceId, allocated_amount: a.amount })));
  if (allocError) { await db.from("accounts_receipts").delete().eq("id", receipt.id); throw new Error(allocError.message); }

  for (const allocation of allocations) {
    const invoice = invoices.find((i) => i.id === allocation.invoiceId)!;
    const nextOutstanding = money(money(invoice.outstanding_amount) - allocation.amount);
    const nextStatus = nextOutstanding === 0 ? "Received" : "Partially Received";
    const { error: ledgerError } = await db.from("accounts_receivable_entries").insert({ insurer_id: input.insurerId, invoice_id: invoice.id, entry_date: input.receiptDate, entry_type: "Receipt", document_reference: input.bankReference.trim(), debit_amount: 0, credit_amount: allocation.amount, description: "Bank receipt allocated", created_by: profile.id });
    if (ledgerError) throw new Error(ledgerError.message);
    const { error: updateError } = await db.from("accounts_invoices").update({ outstanding_amount: nextOutstanding, status: nextStatus, updated_at: new Date().toISOString() }).eq("id", invoice.id);
    if (updateError) throw new Error(updateError.message);
    await db.from("accounts_invoice_events").insert({ invoice_id: invoice.id, event_type: "Receipt allocated", from_status: invoice.status, to_status: nextStatus, event_data: { receipt_id: receipt.id, amount: allocation.amount, bank_reference: input.bankReference.trim() }, actor_profile_id: profile.id });
  }
  return { receiptId: receipt.id };
}

export async function recordTds(input: { invoiceId: string; tdsDate: string; tdsAmount: number; certificatePeriod?: string; certificateReference?: string; matchedStatus?: "Pending"|"Matched"|"Mismatch"; notes?: string }) {
  const profile = await requireAccountsUser();
  const db = createSupabaseAdminClient();
  const amount = money(input.tdsAmount);
  if (!input.invoiceId || !/^\d{4}-\d{2}-\d{2}$/.test(input.tdsDate) || amount <= 0) throw new Error("Invoice, TDS date and a positive TDS amount are required.");
  const { data: invoice, error } = await db.from("accounts_invoices").select("id,insurer_id,status,outstanding_amount,invoice_no").eq("id", input.invoiceId).single();
  if (error || !invoice) throw new Error(error?.message ?? "Invoice not found.");
  if (!["Raised","Partially Received"].includes(invoice.status) || amount > money(invoice.outstanding_amount)) throw new Error("TDS cannot exceed the eligible outstanding invoice balance.");

  const { data: tds, error: tdsError } = await db.from("accounts_tds_entries").insert({ insurer_id: invoice.insurer_id, invoice_id: invoice.id, tds_date: input.tdsDate, tds_amount: amount, certificate_period: input.certificatePeriod?.trim() || null, certificate_reference: input.certificateReference?.trim() || null, matched_status: input.matchedStatus ?? "Pending", notes: input.notes?.trim() || null, created_by: profile.id }).select("id").single();
  if (tdsError || !tds) throw new Error(tdsError?.message ?? "Unable to record TDS.");
  const { error: ledgerError } = await db.from("accounts_receivable_entries").insert({ insurer_id: invoice.insurer_id, invoice_id: invoice.id, entry_date: input.tdsDate, entry_type: "TDS", document_reference: input.certificateReference?.trim() || input.certificatePeriod?.trim() || "TDS", debit_amount: 0, credit_amount: amount, description: "TDS receivable recognized", created_by: profile.id });
  if (ledgerError) { await db.from("accounts_tds_entries").delete().eq("id", tds.id); throw new Error(ledgerError.message); }
  const nextOutstanding = money(money(invoice.outstanding_amount) - amount);
  const nextStatus = nextOutstanding === 0 ? "Received" : "Partially Received";
  await db.from("accounts_invoices").update({ outstanding_amount: nextOutstanding, status: nextStatus, updated_at: new Date().toISOString() }).eq("id", invoice.id);
  await db.from("accounts_invoice_events").insert({ invoice_id: invoice.id, event_type: "TDS recorded", from_status: invoice.status, to_status: nextStatus, event_data: { tds_id: tds.id, amount }, actor_profile_id: profile.id });
  return { tdsId: tds.id };
}
