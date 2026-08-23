"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordReceipt, recordTds } from "./actions";

type Data = Awaited<ReturnType<typeof import("./actions").listSettlementWorkbench>>;
const money = (v: unknown) => `₹${Number(v ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SettlementWorkbench({ data }: { data: Data }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [insurerId, setInsurerId] = useState(data.invoices[0]?.insurer_id ?? "");
  const [receiptDate, setReceiptDate] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [tdsInvoiceId, setTdsInvoiceId] = useState(data.invoices[0]?.id ?? "");
  const [tdsDate, setTdsDate] = useState("");
  const [tdsAmount, setTdsAmount] = useState("");
  const [certificateReference, setCertificateReference] = useState("");
  const insurerInvoices = useMemo(() => data.invoices.filter((i) => i.insurer_id === insurerId), [data.invoices, insurerId]);
  const receiptTotal = useMemo(() => Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0), [allocations]);

  const submitReceipt = () => startTransition(async () => {
    try {
      setMessage("");
      await recordReceipt({ insurerId, receiptDate, bankReference, bankAmount: receiptTotal, allocations: Object.entries(allocations).map(([invoiceId, amount]) => ({ invoiceId, amount: Number(amount) })) });
      setMessage("Receipt recorded and allocated."); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to record receipt."); }
  });
  const submitTds = () => startTransition(async () => {
    try {
      setMessage("");
      await recordTds({ invoiceId: tdsInvoiceId, tdsDate, tdsAmount: Number(tdsAmount), certificateReference });
      setMessage("TDS recorded against invoice."); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to record TDS."); }
  });

  return <div className="mx-auto max-w-[1600px] space-y-4 pb-10">
    <section className="rounded-2xl border border-[#dbe3ee] bg-white p-5 shadow-sm">
      <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#0f766e]">Phase E · Accounts settlement</p>
      <h1 className="mt-2 text-[21px] font-semibold text-[#17365D]">Receipts & TDS</h1>
      <p className="mt-1 max-w-4xl text-[10px] leading-5 text-[#667085]">Allocate actual bank receipts and TDS deductions against raised brokerage invoices. Each allocation posts a credit to the insurer receivable ledger and updates invoice outstanding.</p>
      {message ? <div className="mt-3 rounded-xl bg-[#f8fafc] px-3 py-2 text-[10px] text-[#344054]">{message}</div> : null}
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-[#dbe3ee] bg-white p-5 shadow-sm">
        <h2 className="text-[13px] font-semibold text-[#17365D]">Record bank receipt</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select value={insurerId} onChange={(e) => { setInsurerId(e.target.value); setAllocations({}); }} className="rounded-lg border px-3 py-2 text-[10px]">
            {[...new Map(data.invoices.map((i) => [i.insurer_id, i.insurerName])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} className="rounded-lg border px-3 py-2 text-[10px]" />
          <input value={bankReference} onChange={(e) => setBankReference(e.target.value)} placeholder="Bank / UTR reference" className="rounded-lg border px-3 py-2 text-[10px]" />
          <div className="rounded-lg bg-[#f8fafc] px-3 py-2 text-[10px] font-semibold">Allocated {money(receiptTotal)}</div>
        </div>
        <div className="mt-4 overflow-auto rounded-xl border">
          <table className="min-w-full text-[9.5px]"><thead className="bg-[#f8fafc] text-left"><tr><th className="p-2">Invoice</th><th className="p-2">Outstanding</th><th className="p-2">Allocate</th></tr></thead><tbody>{insurerInvoices.map((i) => <tr key={i.id} className="border-t"><td className="p-2">{i.invoice_no}</td><td className="p-2">{money(i.outstanding_amount)}</td><td className="p-2"><input type="number" min="0" max={Number(i.outstanding_amount)} step="0.01" value={allocations[i.id] ?? ""} onChange={(e) => setAllocations((a) => ({ ...a, [i.id]: e.target.value }))} className="w-28 rounded border px-2 py-1" /></td></tr>)}</tbody></table>
        </div>
        <button disabled={pending || !receiptTotal} onClick={submitReceipt} className="mt-4 rounded-xl bg-[#17365D] px-4 py-2 text-[10px] font-bold text-white disabled:opacity-50">Record & allocate receipt</button>
      </div>

      <div className="rounded-2xl border border-[#dbe3ee] bg-white p-5 shadow-sm">
        <h2 className="text-[13px] font-semibold text-[#17365D]">Record TDS</h2>
        <div className="mt-4 grid gap-3">
          <select value={tdsInvoiceId} onChange={(e) => setTdsInvoiceId(e.target.value)} className="rounded-lg border px-3 py-2 text-[10px]">{data.invoices.map((i) => <option key={i.id} value={i.id}>{i.insurerName} · {i.invoice_no} · {money(i.outstanding_amount)}</option>)}</select>
          <div className="grid gap-3 sm:grid-cols-2"><input type="date" value={tdsDate} onChange={(e) => setTdsDate(e.target.value)} className="rounded-lg border px-3 py-2 text-[10px]" /><input type="number" min="0" step="0.01" value={tdsAmount} onChange={(e) => setTdsAmount(e.target.value)} placeholder="TDS amount" className="rounded-lg border px-3 py-2 text-[10px]" /></div>
          <input value={certificateReference} onChange={(e) => setCertificateReference(e.target.value)} placeholder="Certificate / statement reference" className="rounded-lg border px-3 py-2 text-[10px]" />
          <button disabled={pending || !tdsAmount} onClick={submitTds} className="rounded-xl bg-[#0f766e] px-4 py-2 text-[10px] font-bold text-white disabled:opacity-50">Record TDS credit</button>
        </div>
        <div className="mt-6 rounded-xl border border-dashed p-3 text-[9.5px] leading-5 text-[#667085]">TDS is kept separate from bank receipts so certificate matching and TDS receivable reporting remain auditable. Statutory rate/section logic is intentionally not hard-coded.</div>
      </div>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <Ledger title="Recent receipts" rows={data.receipts.map((r) => [r.receipt_date, (r.insurance_companies as { name?: string } | null)?.name ?? "", r.bank_reference, money(r.bank_amount)])} />
      <Ledger title="Recent TDS entries" rows={data.tds.map((r) => [r.tds_date, (r.insurance_companies as { name?: string } | null)?.name ?? "", (r.accounts_invoices as { invoice_no?: string } | null)?.invoice_no ?? "", money(r.tds_amount)])} />
    </section>
  </div>;
}

function Ledger({ title, rows }: { title: string; rows: string[][] }) { return <div className="rounded-2xl border border-[#dbe3ee] bg-white p-5 shadow-sm"><h2 className="text-[13px] font-semibold text-[#17365D]">{title}</h2><div className="mt-3 overflow-auto"><table className="min-w-full text-[9.5px]"><tbody>{rows.slice(0, 50).map((r, idx) => <tr key={idx} className="border-t first:border-t-0">{r.map((c, i) => <td key={i} className="p-2">{c}</td>)}</tr>)}</tbody></table></div></div>; }
