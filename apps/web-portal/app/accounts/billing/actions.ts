"use server";

import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

async function requireAccountsUser() {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) throw new Error("Commercial details restricted");
  return profile;
}

const money = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function listBillingWorkbench() {
  await requireAccountsUser();
  const db = createSupabaseAdminClient();

  const [{ data: lines, error: lineError }, { data: invoiced, error: invoicedError }, { data: invoices, error: invoiceError }] = await Promise.all([
    db.from("reconciliation_lines").select("id,cycle_id,policy_id,input_policy_no,actual_recognized_payin,adjustment_amount,review_status,match_status,reconciliation_cycles!inner(id,insurer_id,status,period_start,period_end,insurance_companies(name)),policies(policy_no,customers(contact_name),vehicles(vehicle_no))").in("review_status", ["Accepted", "Resolved"]).eq("match_status", "Matched").in("reconciliation_cycles.status", ["Reconciled", "Closed"]).order("created_at", { ascending: false }).limit(1000),
    db.from("accounts_invoice_lines").select("reconciliation_line_id").not("reconciliation_line_id", "is", null),
    db.from("accounts_invoices").select("id,invoice_no,invoice_date,due_date,status,brokerage_subtotal,tax_amount,gross_invoice_amount,outstanding_amount,created_at,insurance_companies(name)").order("created_at", { ascending: false }).limit(250),
  ]);
  if (lineError) throw new Error(lineError.message);
  if (invoicedError) throw new Error(invoicedError.message);
  if (invoiceError) throw new Error(invoiceError.message);

  const invoicedIds = new Set((invoiced ?? []).map((row) => row.reconciliation_line_id).filter(Boolean));
  const eligible = (lines ?? []).filter((row) => !invoicedIds.has(row.id)).map((row) => {
    const cycle = one(row.reconciliation_cycles);
    const policy = one(row.policies);
    const insurer = one(cycle?.insurance_companies as { name: string | null } | Array<{ name: string | null }> | null | undefined);
    const customer = one(policy?.customers);
    const vehicle = one(policy?.vehicles);
    return {
      id: row.id,
      cycleId: row.cycle_id,
      insurerId: cycle?.insurer_id ?? "",
      insurerName: insurer?.name ?? "",
      periodStart: cycle?.period_start ?? "",
      periodEnd: cycle?.period_end ?? "",
      policyId: row.policy_id,
      policyNo: policy?.policy_no ?? row.input_policy_no ?? "",
      customerName: customer?.contact_name ?? "",
      vehicleNo: vehicle?.vehicle_no ?? "",
      recognized: money(row.actual_recognized_payin),
      adjustment: money(row.adjustment_amount),
      invoiceable: money(money(row.actual_recognized_payin) + money(row.adjustment_amount)),
    };
  });

  return { eligible, invoices: invoices ?? [] };
}

export async function createBrokerageInvoiceDraft(input: {
  reconciliationLineIds: string[];
  invoiceNo?: string;
  invoiceDate?: string;
  dueDate?: string;
  taxAmount?: number;
  taxTreatment?: string;
  notes?: string;
}) {
  const profile = await requireAccountsUser();
  const db = createSupabaseAdminClient();
  const ids = [...new Set(input.reconciliationLineIds.filter(Boolean))];
  if (!ids.length) throw new Error("Select at least one reconciled transaction.");

  const { data: lines, error } = await db.from("reconciliation_lines").select("id,cycle_id,policy_id,input_policy_no,actual_recognized_payin,adjustment_amount,review_status,match_status,reconciliation_cycles!inner(id,insurer_id,status,period_start,period_end),policies(policy_no)").in("id", ids);
  if (error) throw new Error(error.message);
  if (!lines || lines.length !== ids.length) throw new Error("One or more reconciliation lines could not be loaded.");

  const normalized = lines.map((row) => {
    const cycle = one(row.reconciliation_cycles);
    const policy = one(row.policies);
    if (!cycle || !["Reconciled", "Closed"].includes(cycle.status) || row.match_status !== "Matched" || !["Accepted", "Resolved"].includes(row.review_status)) throw new Error("Only finalized matched reconciliation lines can be invoiced.");
    return { row, cycle, policy };
  });
  const insurerIds = new Set(normalized.map((item) => item.cycle.insurer_id));
  if (insurerIds.size !== 1) throw new Error("An invoice can contain transactions for one insurer only.");

  const { data: already } = await db.from("accounts_invoice_lines").select("reconciliation_line_id").in("reconciliation_line_id", ids);
  if ((already ?? []).length) throw new Error("One or more selected reconciliation transactions are already invoiced.");

  const brokerageSubtotal = money(normalized.reduce((sum, item) => sum + money(item.row.actual_recognized_payin) + money(item.row.adjustment_amount), 0));
  if (brokerageSubtotal <= 0) throw new Error("Brokerage invoice subtotal must be greater than zero. Negative/zero settlements require an adjustment or credit-note workflow.");
  const taxAmount = money(input.taxAmount);
  if (taxAmount < 0) throw new Error("Tax amount cannot be negative.");
  const gross = money(brokerageSubtotal + taxAmount);

  const periods = normalized.map((item) => [item.cycle.period_start, item.cycle.period_end]).flat().filter(Boolean).sort();
  const cycleIds = new Set(normalized.map((item) => item.cycle.id));
  const invoiceNo = input.invoiceNo?.trim() || null;
  const invoiceDate = input.invoiceDate || null;
  const dueDate = input.dueDate || null;
  if (invoiceDate && dueDate && dueDate < invoiceDate) throw new Error("Due date cannot be before invoice date.");

  const { data: invoice, error: invoiceError } = await db.from("accounts_invoices").insert({
    insurer_id: [...insurerIds][0],
    reconciliation_cycle_id: cycleIds.size === 1 ? [...cycleIds][0] : null,
    invoice_no: invoiceNo,
    invoice_date: invoiceDate,
    due_date: dueDate,
    accounting_period_start: periods[0] ?? null,
    accounting_period_end: periods[periods.length - 1] ?? null,
    status: "Draft",
    brokerage_subtotal: brokerageSubtotal,
    tax_amount: taxAmount,
    gross_invoice_amount: gross,
    outstanding_amount: 0,
    tax_treatment: input.taxTreatment?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: profile.id,
  }).select("id").single();
  if (invoiceError || !invoice) throw new Error(invoiceError?.message ?? "Unable to create invoice draft.");

  const payload = normalized.map((item) => ({
    invoice_id: invoice.id,
    reconciliation_line_id: item.row.id,
    policy_id: item.row.policy_id,
    policy_no: item.policy?.policy_no ?? item.row.input_policy_no ?? null,
    line_type: "Brokerage",
    recognized_brokerage_amount: money(item.row.actual_recognized_payin),
    adjustment_amount: money(item.row.adjustment_amount),
    invoice_line_amount: money(money(item.row.actual_recognized_payin) + money(item.row.adjustment_amount)),
  }));
  const { error: linesError } = await db.from("accounts_invoice_lines").insert(payload);
  if (linesError) {
    await db.from("accounts_invoices").delete().eq("id", invoice.id);
    throw new Error(linesError.message);
  }
  await db.from("accounts_invoice_events").insert({ invoice_id: invoice.id, event_type: "Invoice draft created", to_status: "Draft", event_data: { line_count: payload.length }, actor_profile_id: profile.id });
  return { invoiceId: invoice.id };
}

export async function raiseBrokerageInvoice(input: { invoiceId: string; invoiceNo: string; invoiceDate: string; dueDate?: string }) {
  const profile = await requireAccountsUser();
  const db = createSupabaseAdminClient();
  const invoiceNo = input.invoiceNo.trim();
  if (!invoiceNo) throw new Error("Invoice number is required before raising the invoice.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.invoiceDate)) throw new Error("Invoice date is required.");
  if (input.dueDate && input.dueDate < input.invoiceDate) throw new Error("Due date cannot be before invoice date.");

  const { data: invoice, error } = await db.from("accounts_invoices").select("id,insurer_id,status,gross_invoice_amount").eq("id", input.invoiceId).single();
  if (error || !invoice) throw new Error(error?.message ?? "Invoice not found.");
  if (invoice.status !== "Draft") throw new Error("Only Draft invoices can be raised.");
  const gross = money(invoice.gross_invoice_amount);
  if (gross <= 0) throw new Error("Invoice gross amount must be greater than zero.");

  const { error: updateError } = await db.from("accounts_invoices").update({ invoice_no: invoiceNo, invoice_date: input.invoiceDate, due_date: input.dueDate || null, status: "Raised", outstanding_amount: gross, raised_by: profile.id, raised_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", invoice.id).eq("status", "Draft");
  if (updateError) throw new Error(updateError.message);

  const { error: ledgerError } = await db.from("accounts_receivable_entries").insert({ insurer_id: invoice.insurer_id, invoice_id: invoice.id, entry_date: input.invoiceDate, entry_type: "Invoice", document_reference: invoiceNo, debit_amount: gross, credit_amount: 0, description: "Brokerage invoice raised", created_by: profile.id });
  if (ledgerError) {
    await db.from("accounts_invoices").update({ status: "Draft", outstanding_amount: 0, raised_by: null, raised_at: null }).eq("id", invoice.id);
    throw new Error(ledgerError.message);
  }
  await db.from("accounts_invoice_events").insert({ invoice_id: invoice.id, event_type: "Invoice raised", from_status: "Draft", to_status: "Raised", event_data: { invoice_no: invoiceNo, gross_invoice_amount: gross }, actor_profile_id: profile.id });
  return { success: true };
}

export async function listInsurerReceivables() {
  await requireAccountsUser();
  const db = createSupabaseAdminClient();
  const { data: entries, error } = await db.from("accounts_receivable_entries").select("id,insurer_id,entry_date,entry_type,document_reference,debit_amount,credit_amount,description,insurance_companies(name),accounts_invoices(id,invoice_no,due_date,status)").order("entry_date", { ascending: true }).order("created_at", { ascending: true }).limit(5000);
  if (error) throw new Error(error.message);
  const balances = new Map<string, { insurerId: string; insurerName: string; debit: number; credit: number; balance: number }>();
  for (const row of entries ?? []) {
    const insurer = one(row.insurance_companies);
    const current = balances.get(row.insurer_id) ?? { insurerId: row.insurer_id, insurerName: insurer?.name ?? "", debit: 0, credit: 0, balance: 0 };
    current.debit = money(current.debit + money(row.debit_amount));
    current.credit = money(current.credit + money(row.credit_amount));
    current.balance = money(current.debit - current.credit);
    balances.set(row.insurer_id, current);
  }
  return { entries: entries ?? [], balances: [...balances.values()].sort((a, b) => b.balance - a.balance) };
}
