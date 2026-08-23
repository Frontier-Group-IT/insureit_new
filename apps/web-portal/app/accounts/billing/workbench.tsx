"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Landmark, ReceiptText } from "lucide-react";
import { createBrokerageInvoiceDraft, raiseBrokerageInvoice } from "./actions";

type WorkbenchData = Awaited<ReturnType<typeof import("./actions").listBillingWorkbench>>;

const inr = (value: number | string | null | undefined) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value ?? 0));

export function BillingWorkbench({ initialData }: { initialData: WorkbenchData }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxAmount, setTaxAmount] = useState("0");
  const [taxTreatment, setTaxTreatment] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedRows = useMemo(() => initialData.eligible.filter((row) => selected.includes(row.id)), [initialData.eligible, selected]);
  const insurers = new Set(selectedRows.map((row) => row.insurerId));
  const subtotal = selectedRows.reduce((sum, row) => sum + row.invoiceable, 0);
  const tax = Number(taxAmount || 0);
  const gross = subtotal + (Number.isFinite(tax) ? tax : 0);

  const toggle = (id: string, insurerId: string) => setSelected((current) => {
    if (current.includes(id)) return current.filter((value) => value !== id);
    const currentInsurer = initialData.eligible.find((row) => current.includes(row.id))?.insurerId;
    if (currentInsurer && currentInsurer !== insurerId) return [id];
    return [...current, id];
  });

  const createDraft = () => startTransition(async () => {
    setMessage("");
    try {
      const result = await createBrokerageInvoiceDraft({ reconciliationLineIds: selected, invoiceNo, invoiceDate, dueDate, taxAmount: Number(taxAmount || 0), taxTreatment, notes });
      setMessage(`Draft created: ${result.invoiceId}`);
      setSelected([]);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create invoice draft.");
    }
  });

  const raise = (invoiceId: string, existingInvoiceNo: string | null, existingInvoiceDate: string | null, existingDueDate: string | null) => {
    const number = window.prompt("Invoice number", existingInvoiceNo ?? "")?.trim();
    if (!number) return;
    const date = window.prompt("Invoice date (YYYY-MM-DD)", existingInvoiceDate ?? "")?.trim();
    if (!date) return;
    const due = window.prompt("Due date (YYYY-MM-DD, optional)", existingDueDate ?? "")?.trim() ?? "";
    startTransition(async () => {
      setMessage("");
      try {
        await raiseBrokerageInvoice({ invoiceId, invoiceNo: number, invoiceDate: date, dueDate: due || undefined });
        setMessage("Invoice raised and posted to insurer receivables.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to raise invoice.");
      }
    });
  };

  return <div className="mx-auto max-w-[1720px] space-y-4 pb-10">
    <section className="rounded-2xl border border-[#dbe3ee] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-[#0f766e]"><ReceiptText className="h-5 w-5" /><span className="text-[9px] font-black uppercase tracking-[.14em]">Accounts · Billing</span></div><h1 className="mt-2 text-[21px] font-semibold text-[#17365D]">Brokerage Invoice Register</h1><p className="mt-1 max-w-4xl text-[10px] leading-5 text-[#667085]">Create brokerage invoices only from finalized reconciliation transactions. Draft invoices do not affect receivables; raising an invoice posts the gross invoice amount to the insurer debtor ledger.</p></div>
        <Link href="/accounts/receivables" className="inline-flex items-center gap-2 rounded-xl border border-[#d8e1ec] px-4 py-2 text-[9px] font-bold text-[#17365D]">Insurer receivables <Landmark className="h-3.5 w-3.5" /></Link>
      </div>
    </section>

    <section className="grid gap-3 md:grid-cols-4">
      <Metric label="Eligible reconciled" value={String(initialData.eligible.length)} />
      <Metric label="Selected brokerage" value={inr(subtotal)} />
      <Metric label="Tax entered" value={inr(Number.isFinite(tax) ? tax : 0)} />
      <Metric label="Draft gross invoice" value={inr(gross)} />
    </section>

    <section className="rounded-2xl border border-[#dbe3ee] bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[13px] font-semibold text-[#17365D]">1. Select finalized reconciliation transactions</h2><p className="text-[9.5px] text-[#667085]">Selection is automatically restricted to one insurer per invoice.</p></div><span className="text-[9px] font-bold text-[#0f766e]">{selected.length} selected · {insurers.size || 0} insurer</span></div>
      <div className="max-h-[390px] overflow-auto rounded-xl border border-[#e2e8f0]"><table className="min-w-[1200px] w-full text-left text-[9.5px]"><thead className="sticky top-0 z-10 bg-[#f8fafc] text-[#475467]"><tr><th className="p-2">Select</th><th className="p-2">Insurer</th><th className="p-2">Policy</th><th className="p-2">Customer</th><th className="p-2">Vehicle</th><th className="p-2">Recon period</th><th className="p-2 text-right">Recognized</th><th className="p-2 text-right">Adjustment</th><th className="p-2 text-right">Invoiceable</th></tr></thead><tbody>{initialData.eligible.map((row) => <tr key={row.id} className="border-t border-[#eef2f6]"><td className="p-2"><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id, row.insurerId)} /></td><td className="p-2 font-semibold text-[#17365D]">{row.insurerName}</td><td className="p-2">{row.policyNo}</td><td className="p-2">{row.customerName}</td><td className="p-2">{row.vehicleNo}</td><td className="p-2">{row.periodStart} → {row.periodEnd}</td><td className="p-2 text-right">{inr(row.recognized)}</td><td className="p-2 text-right">{inr(row.adjustment)}</td><td className="p-2 text-right font-semibold">{inr(row.invoiceable)}</td></tr>)}{!initialData.eligible.length ? <tr><td colSpan={9} className="p-8 text-center text-[#98a2b3]">No finalized uninvoiced reconciliation transactions are available.</td></tr> : null}</tbody></table></div>
    </section>

    <section className="rounded-2xl border border-[#dbe3ee] bg-white p-4 shadow-sm"><h2 className="text-[13px] font-semibold text-[#17365D]">2. Draft invoice details</h2><p className="mt-1 text-[9.5px] text-[#667085]">Tax is deliberately entered by Accounts; InsureIT does not assume a statutory tax treatment.</p><div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6"><Field label="Invoice no." value={invoiceNo} onChange={setInvoiceNo} /><Field label="Invoice date" type="date" value={invoiceDate} onChange={setInvoiceDate} /><Field label="Due date" type="date" value={dueDate} onChange={setDueDate} /><Field label="Tax amount" type="number" value={taxAmount} onChange={setTaxAmount} /><Field label="Tax treatment / note" value={taxTreatment} onChange={setTaxTreatment} /><Field label="Internal notes" value={notes} onChange={setNotes} /></div><div className="mt-4 flex flex-wrap items-center gap-3"><button disabled={isPending || !selected.length} onClick={createDraft} className="inline-flex items-center gap-2 rounded-xl bg-[#17365D] px-4 py-2 text-[9.5px] font-bold text-white disabled:opacity-40"><FilePlus2 className="h-4 w-4" />Create invoice draft</button><span className="text-[9.5px] text-[#667085]">Brokerage {inr(subtotal)} + Tax {inr(tax)} = Gross {inr(gross)}</span>{message ? <span className="text-[9.5px] font-semibold text-[#0f766e]">{message}</span> : null}</div></section>

    <section className="rounded-2xl border border-[#dbe3ee] bg-white p-4 shadow-sm"><div className="mb-3"><h2 className="text-[13px] font-semibold text-[#17365D]">Invoice register</h2><p className="text-[9.5px] text-[#667085]">Raising a Draft is the accounting control point that creates the insurer receivable.</p></div><div className="overflow-auto rounded-xl border border-[#e2e8f0]"><table className="min-w-[1050px] w-full text-left text-[9.5px]"><thead className="bg-[#f8fafc]"><tr><th className="p-2">Invoice</th><th className="p-2">Insurer</th><th className="p-2">Date</th><th className="p-2">Due</th><th className="p-2">Status</th><th className="p-2 text-right">Brokerage</th><th className="p-2 text-right">Tax</th><th className="p-2 text-right">Gross</th><th className="p-2 text-right">Outstanding</th><th className="p-2">Action</th></tr></thead><tbody>{initialData.invoices.map((invoice) => { const insurer = Array.isArray(invoice.insurance_companies) ? invoice.insurance_companies[0] : invoice.insurance_companies; return <tr key={invoice.id} className="border-t border-[#eef2f6]"><td className="p-2 font-semibold text-[#17365D]">{invoice.invoice_no || "Draft · no number"}</td><td className="p-2">{insurer?.name ?? ""}</td><td className="p-2">{invoice.invoice_date || "—"}</td><td className="p-2">{invoice.due_date || "—"}</td><td className="p-2"><span className="rounded-full bg-[#eef4ff] px-2 py-1 text-[8.5px] font-bold text-[#3156b8]">{invoice.status}</span></td><td className="p-2 text-right">{inr(invoice.brokerage_subtotal)}</td><td className="p-2 text-right">{inr(invoice.tax_amount)}</td><td className="p-2 text-right font-semibold">{inr(invoice.gross_invoice_amount)}</td><td className="p-2 text-right">{inr(invoice.outstanding_amount)}</td><td className="p-2">{invoice.status === "Draft" ? <button disabled={isPending} onClick={() => raise(invoice.id, invoice.invoice_no, invoice.invoice_date, invoice.due_date)} className="rounded-lg border border-[#b9c7d8] px-2.5 py-1.5 text-[8.5px] font-bold text-[#17365D]">Raise invoice</button> : <span className="text-[#98a2b3]">Posted</span>}</td></tr>})}</tbody></table></div></section>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-[#dbe3ee] bg-white p-4 shadow-sm"><div className="text-[8.5px] font-black uppercase tracking-[.12em] text-[#98a2b3]">{label}</div><div className="mt-1 text-[17px] font-semibold text-[#17365D]">{value}</div></div>; }
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="text-[9px] font-bold text-[#475467]">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[#d0d9e5] px-2 text-[10px] font-medium text-[#17365D] outline-none focus:border-[#0f766e]" /></label>; }
