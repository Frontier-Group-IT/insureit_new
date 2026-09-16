"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { previewAccountsReconciliationUpload, type ReconciliationUploadPreview, type PreviewStatus } from "./reconciliation-upload-actions";

type Props = { period: string; fromDate: string; toDate: string; insurerId: string | null };
const inr = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
const empty = (message: string): ReconciliationUploadPreview => ({ totalRows: 0, readyRows: 0, warningRows: 0, errorRows: 0, skippedRows: 0, payinRows: [], payoutRows: [], message });

export function ReconciliationTools({ period, fromDate, toDate, insurerId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ReconciliationUploadPreview | null>(null);
  const [isPending, startTransition] = useTransition();
  const downloadHref = useMemo(() => { const params = new URLSearchParams({ period, from: fromDate, to: toDate }); if (insurerId) params.set("insurer", insurerId); return `/accounts/reconciliation-template?${params.toString()}`; }, [period, fromDate, toDate, insurerId]);

  const runPreview = () => {
    if (!file) return setPreview(empty("Choose an .xlsx file first."));
    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      try { setPreview(await previewAccountsReconciliationUpload(formData)); }
      catch (error) { setPreview(empty(error instanceof Error ? error.message : "Unable to preview this workbook.")); }
    });
  };

  return <section className="rounded-2xl border border-[#dbe3ee] bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[8px] font-black uppercase tracking-[.1em] text-[#0f766e]">Excel reconciliation</p><h2 className="mt-1 text-[14px] font-semibold text-[#17365D]">Download → enter Pay-In / Pay-Out → upload → validate</h2><p className="mt-1 max-w-4xl text-[9px] leading-4 text-[#7c899b]">One workbook contains separate Pay-In and Pay-Out sheets. INSUREIT owns projected commercial values; Accounts enters only transaction details.</p></div><span className="rounded-full border border-[#dce4ee] bg-[#f8fafc] px-2.5 py-1 text-[8px] font-bold text-[#667085]">Preview only · no financial writes</span></div>
    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-[#e2e8f0] bg-[#fbfcfe] p-3"><div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e8f5f3] text-[#0f766e]"><FileSpreadsheet className="h-4 w-4" /></span><div><p className="text-[10px] font-bold text-[#17365D]">1. Download Accounts workbook</p><p className="mt-1 text-[8.5px] leading-4 text-[#7c899b]">Uses the current date and insurer filters and includes system-controlled Pay-In and Pay-Out references.</p><a href={downloadHref} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#17365D] px-3 py-2 text-[9px] font-bold text-white"><Download className="h-3.5 w-3.5" />Download workbook</a></div></div></div>
      <div className="rounded-xl border border-[#e2e8f0] bg-[#fbfcfe] p-3"><div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eef4ff] text-[#3156b8]"><UploadCloud className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-bold text-[#17365D]">2. Upload for validation</p><p className="mt-1 text-[8.5px] leading-4 text-[#7c899b]">Blank rows are ignored. Repeating a policy is allowed for partial installments; duplicate transaction references are checked.</p><div className="mt-3 flex flex-wrap gap-2"><label className="flex h-9 min-w-[220px] flex-1 cursor-pointer items-center rounded-lg border border-[#d8e1ec] bg-white px-3 text-[9px] text-[#475467]"><input type="file" accept=".xlsx" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); }} /><span className="truncate">{file?.name ?? "Choose completed workbook"}</span></label><button type="button" disabled={isPending || !file} onClick={runPreview} className="h-9 rounded-lg bg-[#0f766e] px-3 text-[9px] font-bold text-white disabled:opacity-40">{isPending ? "Validating…" : "Preview upload"}</button></div></div></div></div>
    </div>
    {preview ? <PreviewPanel preview={preview} /> : null}
  </section>;
}

function PreviewPanel({ preview }: { preview: ReconciliationUploadPreview }) {
  if (preview.message && !preview.totalRows) return <div className="mt-3 rounded-xl border border-[#f1d7a7] bg-[#fffaf0] px-3 py-2 text-[9px] font-semibold text-[#8a5a13]">{preview.message}</div>;
  return <div className="mt-3 border-t border-[#edf1f5] pt-3"><div className="grid gap-2 sm:grid-cols-5"><Metric label="Transactions" value={preview.totalRows} /><Metric label="Ready" value={preview.readyRows} /><Metric label="Warnings" value={preview.warningRows} /><Metric label="Errors" value={preview.errorRows} /><Metric label="Blank ignored" value={preview.skippedRows} /></div>
    {preview.payinRows.length ? <div className="mt-3"><p className="mb-1.5 text-[9px] font-bold text-[#17365D]">Pay-In validation</p><div className="max-h-[320px] overflow-auto rounded-xl border"><table className="min-w-[1320px] w-full text-left text-[8.5px]"><thead className="sticky top-0 bg-[#f8fafc]"><tr><th className="p-2">Row</th><th className="p-2">Policy</th><th className="p-2">Insurer</th><th className="p-2 text-right">Projected</th><th className="p-2">Bill</th><th className="p-2 text-right">Bill amount</th><th className="p-2 text-right">Difference</th><th className="p-2 text-right">TDS</th><th className="p-2 text-right">Received</th><th className="p-2">UTR / Ref</th><th className="p-2">Validation</th></tr></thead><tbody>{preview.payinRows.map(row => <tr key={`${row.rowNumber}-${row.policyId}-${row.reference}`} className="border-t"><td className="p-2">{row.rowNumber}</td><td className="p-2 font-semibold text-[#17365D]">{row.policyNumber}</td><td className="p-2">{row.insurer}</td><td className="p-2 text-right">{inr(row.projectedPayin)}</td><td className="p-2">{row.billNumber}</td><td className="p-2 text-right">{inr(row.billAmount)}</td><td className="p-2 text-right">{inr(row.difference)}</td><td className="p-2 text-right">{inr(row.actualTds)}</td><td className="p-2 text-right">{inr(row.amountReceived)}</td><td className="p-2">{row.reference || "—"}</td><td className="p-2"><Validation status={row.status} message={row.message} /></td></tr>)}</tbody></table></div></div> : null}
    {preview.payoutRows.length ? <div className="mt-3"><p className="mb-1.5 text-[9px] font-bold text-[#17365D]">Pay-Out validation</p><div className="max-h-[320px] overflow-auto rounded-xl border"><table className="min-w-[1120px] w-full text-left text-[8.5px]"><thead className="sticky top-0 bg-[#f8fafc]"><tr><th className="p-2">Row</th><th className="p-2">Policy</th><th className="p-2">Intermediary</th><th className="p-2 text-right">Projected payout</th><th className="p-2 text-right">Retention</th><th className="p-2 text-right">Paid</th><th className="p-2">Date</th><th className="p-2">UTR / Ref</th><th className="p-2">Validation</th></tr></thead><tbody>{preview.payoutRows.map(row => <tr key={`${row.rowNumber}-${row.payoutId}-${row.reference}`} className="border-t"><td className="p-2">{row.rowNumber}</td><td className="p-2 font-semibold text-[#17365D]">{row.policyNumber}</td><td className="p-2">{row.intermediaryCode}</td><td className="p-2 text-right">{inr(row.projectedGrossPayout)}</td><td className="p-2 text-right">{inr(row.projectedRetention)}</td><td className="p-2 text-right">{inr(row.paidAmount)}</td><td className="p-2">{row.paidDate}</td><td className="p-2">{row.reference}</td><td className="p-2"><Validation status={row.status} message={row.message} /></td></tr>)}</tbody></table></div></div> : null}
    <p className="mt-3 rounded-lg border border-dashed border-[#cfd9e6] bg-[#f8fafc] px-3 py-2 text-[8.5px] font-semibold text-[#667085]">This validation stage is read-only. Confirm Import will be enabled only after the policy-line allocation extension and posting path are separately implemented and verified.</p>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border bg-[#fbfcfe] px-3 py-2"><p className="text-[7.5px] font-black uppercase tracking-[.08em] text-[#98a2b3]">{label}</p><p className="mt-0.5 text-[15px] font-semibold text-[#17365D]">{value}</p></div>; }
function Validation({ status, message }: { status: PreviewStatus; message: string }) { return <div className="flex items-start gap-2"><StatusPill status={status} /><span className="max-w-[300px] leading-4 text-[#667085]">{message}</span></div>; }
function StatusPill({ status }: { status: PreviewStatus }) { const cls = status === "Ready" ? "bg-[#e8f5f3] text-[#0f766e]" : status === "Warning" ? "bg-[#fff7e6] text-[#9a6700]" : "bg-[#fff0f0] text-[#b42318]"; return <span className={`shrink-0 rounded-full px-2 py-1 text-[7.5px] font-black ${cls}`}>{status}</span>; }
