import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark, ReceiptText } from "lucide-react";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { listInsurerReceivables } from "../billing/actions";

const inr = (value: number | string | null | undefined) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value ?? 0));

export default async function ReceivablesPage() {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");
  const data = await listInsurerReceivables();
  const totalDebit = data.balances.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = data.balances.reduce((sum, row) => sum + row.credit, 0);
  const totalOutstanding = data.balances.reduce((sum, row) => sum + row.balance, 0);

  return <AppShell title="Insurer Receivables"><div className="mx-auto max-w-[1650px] space-y-4 pb-10">
    <section className="rounded-2xl border border-[#dbe3ee] bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[#0f766e]"><Landmark className="h-5 w-5"/><span className="text-[9px] font-black uppercase tracking-[.14em]">Accounts · Receivables</span></div><h1 className="mt-2 text-[21px] font-semibold text-[#17365D]">Insurer Receivable Ledger</h1><p className="mt-1 max-w-4xl text-[10px] leading-5 text-[#667085]">Debtor-style sub-ledger for amounts due from insurers. Phase D posts raised brokerage invoices as debits; receipts, TDS and settlement credits will post here in Phase E.</p></div><Link href="/accounts/billing" className="inline-flex items-center gap-2 rounded-xl border border-[#d8e1ec] px-4 py-2 text-[9px] font-bold text-[#17365D]">Brokerage billing <ReceiptText className="h-3.5 w-3.5"/></Link></div></section>

    <section className="grid gap-3 md:grid-cols-3"><Metric label="Gross receivable debits" value={inr(totalDebit)}/><Metric label="Credits / settlements" value={inr(totalCredit)}/><Metric label="Outstanding receivable" value={inr(totalOutstanding)}/></section>

    <section className="rounded-2xl border border-[#dbe3ee] bg-white p-4 shadow-sm"><h2 className="text-[13px] font-semibold text-[#17365D]">Insurer balances</h2><p className="mb-3 mt-1 text-[9.5px] text-[#667085]">Current balance = ledger debits − ledger credits.</p><div className="overflow-auto rounded-xl border border-[#e2e8f0]"><table className="w-full min-w-[720px] text-left text-[9.5px]"><thead className="bg-[#f8fafc]"><tr><th className="p-2">Insurer</th><th className="p-2 text-right">Debits</th><th className="p-2 text-right">Credits</th><th className="p-2 text-right">Outstanding</th></tr></thead><tbody>{data.balances.map((row) => <tr key={row.insurerId} className="border-t border-[#eef2f6]"><td className="p-2 font-semibold text-[#17365D]">{row.insurerName}</td><td className="p-2 text-right">{inr(row.debit)}</td><td className="p-2 text-right">{inr(row.credit)}</td><td className="p-2 text-right font-semibold">{inr(row.balance)}</td></tr>)}{!data.balances.length ? <tr><td colSpan={4} className="p-8 text-center text-[#98a2b3]">No receivable entries yet. Raise a brokerage invoice to create the first debtor ledger entry.</td></tr> : null}</tbody></table></div></section>

    <section className="rounded-2xl border border-[#dbe3ee] bg-white p-4 shadow-sm"><h2 className="text-[13px] font-semibold text-[#17365D]">Receivable transactions</h2><p className="mb-3 mt-1 text-[9.5px] text-[#667085]">This is the accounting movement ledger, not a reconciliation report.</p><div className="max-h-[480px] overflow-auto rounded-xl border border-[#e2e8f0]"><table className="w-full min-w-[1050px] text-left text-[9.5px]"><thead className="sticky top-0 bg-[#f8fafc]"><tr><th className="p-2">Date</th><th className="p-2">Insurer</th><th className="p-2">Type</th><th className="p-2">Document</th><th className="p-2">Description</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th></tr></thead><tbody>{data.entries.map((row) => { const insurer = Array.isArray(row.insurance_companies) ? row.insurance_companies[0] : row.insurance_companies; return <tr key={row.id} className="border-t border-[#eef2f6]"><td className="p-2">{row.entry_date}</td><td className="p-2 font-semibold text-[#17365D]">{insurer?.name ?? ""}</td><td className="p-2">{row.entry_type}</td><td className="p-2">{row.document_reference || "—"}</td><td className="p-2">{row.description || "—"}</td><td className="p-2 text-right">{Number(row.debit_amount) ? inr(row.debit_amount) : "—"}</td><td className="p-2 text-right">{Number(row.credit_amount) ? inr(row.credit_amount) : "—"}</td></tr>})}</tbody></table></div></section>
  </div></AppShell>;
}

function Metric({label,value}:{label:string;value:string}) { return <div className="rounded-2xl border border-[#dbe3ee] bg-white p-4 shadow-sm"><div className="text-[8.5px] font-black uppercase tracking-[.12em] text-[#98a2b3]">{label}</div><div className="mt-1 text-[17px] font-semibold text-[#17365D]">{value}</div></div>; }
