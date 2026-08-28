"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type DeletableFinancialEntity = "reconciliation_cycle" | "accounts_invoice";

export type FinancialDeletePreview =
  | {
      ok: true;
      entity: DeletableFinancialEntity;
      id: string;
      label: string;
      canDelete: boolean;
      blockers: string[];
      cascadeSummary: string[];
    }
  | { ok: false; error: string };

export type FinancialDeleteResult = { ok: true } | { ok: false; error: string };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function plural(label: string, count: number) {
  return count === 1 ? label : `${label}s`;
}

async function requireItSuperUser() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || profile.role !== "it_super_user") {
    throw new Error("Only the IT Super User can permanently delete reconciliation or accounts records.");
  }
  return profile;
}

async function reconciliationCyclePreview(id: string): Promise<FinancialDeletePreview> {
  const db = createSupabaseAdminClient();
  const { data: cycle, error: cycleError } = await db
    .from("reconciliation_cycles")
    .select("id,status,period_start,period_end,statement_reference,insurance_companies(name)")
    .eq("id", id)
    .maybeSingle();

  if (cycleError) return { ok: false, error: `Unable to verify reconciliation cycle: ${cycleError.message}` };
  if (!cycle) return { ok: false, error: "This reconciliation cycle no longer exists." };

  const [{ data: lines, error: linesError }, { count: eventCount, error: eventsError }, { count: directInvoiceCount, error: directInvoiceError }] = await Promise.all([
    db.from("reconciliation_lines").select("id").eq("cycle_id", id),
    db.from("reconciliation_events").select("id", { count: "exact", head: true }).eq("cycle_id", id),
    db.from("accounts_invoices").select("id", { count: "exact", head: true }).eq("reconciliation_cycle_id", id),
  ]);

  if (linesError) return { ok: false, error: `Unable to verify reconciliation lines: ${linesError.message}` };
  if (eventsError) return { ok: false, error: `Unable to verify reconciliation history: ${eventsError.message}` };
  if (directInvoiceError) return { ok: false, error: `Unable to verify linked invoices: ${directInvoiceError.message}` };

  const lineIds = (lines ?? []).map((row) => String(row.id));
  let invoiceLineCount = 0;
  if (lineIds.length) {
    const { count, error } = await db
      .from("accounts_invoice_lines")
      .select("id", { count: "exact", head: true })
      .in("reconciliation_line_id", lineIds);
    if (error) return { ok: false, error: `Unable to verify linked invoice lines: ${error.message}` };
    invoiceLineCount = count ?? 0;
  }

  const blockers: string[] = [];
  if ((directInvoiceCount ?? 0) > 0) blockers.push(`${directInvoiceCount} Accounts ${plural("invoice", directInvoiceCount ?? 0)} directly reference this reconciliation cycle`);
  if (invoiceLineCount > 0) blockers.push(`${invoiceLineCount} Accounts invoice ${plural("line", invoiceLineCount)} use reconciliation entries from this cycle`);

  const insurerRelation = cycle.insurance_companies as { name?: string | null } | Array<{ name?: string | null }> | null;
  const insurer = Array.isArray(insurerRelation) ? insurerRelation[0]?.name : insurerRelation?.name;
  const label = [insurer || "Reconciliation", `${cycle.period_start} → ${cycle.period_end}`, cycle.statement_reference || null].filter(Boolean).join(" · ");

  return {
    ok: true,
    entity: "reconciliation_cycle",
    id,
    label,
    canDelete: blockers.length === 0,
    blockers,
    cascadeSummary: [
      `${lineIds.length} reconciliation ${plural("line", lineIds.length)} will be removed`,
      `${eventCount ?? 0} reconciliation history ${plural("event", eventCount ?? 0)} will be removed`,
    ],
  };
}

async function accountsInvoicePreview(id: string): Promise<FinancialDeletePreview> {
  const db = createSupabaseAdminClient();
  const { data: invoice, error: invoiceError } = await db
    .from("accounts_invoices")
    .select("id,invoice_no,invoice_date,status,insurance_companies(name)")
    .eq("id", id)
    .maybeSingle();

  if (invoiceError) return { ok: false, error: `Unable to verify invoice: ${invoiceError.message}` };
  if (!invoice) return { ok: false, error: "This invoice no longer exists." };

  const [
    { count: lineCount, error: lineError },
    { count: eventCount, error: eventError },
    { count: allocationCount, error: allocationError },
    { count: tdsCount, error: tdsError },
    { count: ledgerCount, error: ledgerError },
  ] = await Promise.all([
    db.from("accounts_invoice_lines").select("id", { count: "exact", head: true }).eq("invoice_id", id),
    db.from("accounts_invoice_events").select("id", { count: "exact", head: true }).eq("invoice_id", id),
    db.from("accounts_receipt_allocations").select("id", { count: "exact", head: true }).eq("invoice_id", id),
    db.from("accounts_tds_entries").select("id", { count: "exact", head: true }).eq("invoice_id", id),
    db.from("accounts_receivable_entries").select("id", { count: "exact", head: true }).eq("invoice_id", id),
  ]);

  if (lineError) return { ok: false, error: `Unable to verify invoice lines: ${lineError.message}` };
  if (eventError) return { ok: false, error: `Unable to verify invoice history: ${eventError.message}` };
  if (allocationError) return { ok: false, error: `Unable to verify receipt allocations: ${allocationError.message}` };
  if (tdsError) return { ok: false, error: `Unable to verify TDS entries: ${tdsError.message}` };
  if (ledgerError) return { ok: false, error: `Unable to verify receivable ledger entries: ${ledgerError.message}` };

  const blockers: string[] = [];
  if (invoice.status !== "Draft") blockers.push(`Invoice status is ${invoice.status}; only Draft invoices can be permanently deleted`);
  if ((allocationCount ?? 0) > 0) blockers.push(`${allocationCount} receipt ${plural("allocation", allocationCount ?? 0)} reference this invoice`);
  if ((tdsCount ?? 0) > 0) blockers.push(`${tdsCount} TDS ${plural("entry", tdsCount ?? 0)} reference this invoice`);
  if ((ledgerCount ?? 0) > 0) blockers.push(`${ledgerCount} receivable ledger ${plural("entry", ledgerCount ?? 0)} reference this invoice`);

  const insurerRelation = invoice.insurance_companies as { name?: string | null } | Array<{ name?: string | null }> | null;
  const insurer = Array.isArray(insurerRelation) ? insurerRelation[0]?.name : insurerRelation?.name;
  const label = [invoice.invoice_no || "Draft · no number", insurer || null, invoice.invoice_date || null].filter(Boolean).join(" · ");

  return {
    ok: true,
    entity: "accounts_invoice",
    id,
    label,
    canDelete: blockers.length === 0,
    blockers,
    cascadeSummary: [
      `${lineCount ?? 0} invoice ${plural("line", lineCount ?? 0)} will be removed`,
      `${eventCount ?? 0} invoice history ${plural("event", eventCount ?? 0)} will be removed`,
      "No reconciliation cycle or reconciliation line will be deleted",
    ],
  };
}

export async function previewFinancialDelete(entity: DeletableFinancialEntity, id: string): Promise<FinancialDeletePreview> {
  try {
    await requireItSuperUser();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Not authorized." };
  }
  if (!isUuid(id)) return { ok: false, error: "Invalid record identifier." };
  if (entity === "reconciliation_cycle") return reconciliationCyclePreview(id);
  if (entity === "accounts_invoice") return accountsInvoicePreview(id);
  return { ok: false, error: "Unsupported financial record type." };
}

export async function deleteFinancialRecord(entity: DeletableFinancialEntity, id: string): Promise<FinancialDeleteResult> {
  let profile: Awaited<ReturnType<typeof requireItSuperUser>>;
  try {
    profile = await requireItSuperUser();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Not authorized." };
  }
  if (!isUuid(id)) return { ok: false, error: "Invalid record identifier." };

  const preview = entity === "reconciliation_cycle"
    ? await reconciliationCyclePreview(id)
    : entity === "accounts_invoice"
      ? await accountsInvoicePreview(id)
      : ({ ok: false, error: "Unsupported financial record type." } as const);

  if (!preview.ok) return preview;
  if (!preview.canDelete) return { ok: false, error: `Deletion blocked. ${preview.blockers.join(". ")}.` };

  const db = createSupabaseAdminClient();

  if (entity === "reconciliation_cycle") {
    const { data, error } = await db
      .from("reconciliation_cycles")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      const referenced = error.code === "23503" || /foreign key|violates/i.test(error.message);
      return {
        ok: false,
        error: referenced
          ? "Deletion was blocked because an Accounts record began referencing this reconciliation cycle. Refresh and review the deletion impact again."
          : `Unable to delete reconciliation cycle: ${error.message}`,
      };
    }
    if (!data) return { ok: false, error: "The reconciliation cycle changed or no longer exists. Refresh and try again." };

    await db.from("audit_logs").insert({
      actor_id: profile.id,
      action: "delete_reconciliation_cycle",
      table_name: "reconciliation_cycles",
      record_id: id,
      old_data: {
        id,
        deletion_source: "it_super_user_financial_data_control",
        cascade_summary: preview.cascadeSummary,
      },
    });

    revalidatePath("/reconciliation");
    revalidatePath("/reconciliation/history");
    revalidatePath("/accounts");
    revalidatePath("/accounts/billing");
    return { ok: true };
  }

  const { data, error } = await db
    .from("accounts_invoices")
    .delete()
    .eq("id", id)
    .eq("status", "Draft")
    .select("id")
    .maybeSingle();

  if (error) {
    const referenced = error.code === "23503" || /foreign key|violates/i.test(error.message);
    return {
      ok: false,
      error: referenced
        ? "Deletion was blocked because a receipt, TDS, ledger, or other Accounts record now references this invoice. Refresh and review the deletion impact again."
        : `Unable to delete invoice: ${error.message}`,
    };
  }
  if (!data) return { ok: false, error: "Only an unchanged Draft invoice can be deleted. Refresh and review the record again." };

  await db.from("audit_logs").insert({
    actor_id: profile.id,
    action: "delete_accounts_draft_invoice",
    table_name: "accounts_invoices",
    record_id: id,
    old_data: {
      id,
      deletion_source: "it_super_user_financial_data_control",
      prior_status: "Draft",
      cascade_summary: preview.cascadeSummary,
    },
  });

  revalidatePath("/accounts");
  revalidatePath("/accounts/billing");
  revalidatePath("/accounts/receivables");
  revalidatePath("/reconciliation");
  revalidatePath("/reconciliation/history");
  return { ok: true };
}
