"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { previewAccountsReconciliationUpload, type ReconciliationUploadPreview, type PreviewStatus } from "./reconciliation-upload-actions";
import { confirmAccountsReconciliationUpload, type AccountsImportResult } from "./reconciliation-import-actions";

type Props = { period: string; fromDate: string; toDate: string; insurerId: string | null };
const inr = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
const empty = (message: string): ReconciliationUploadPreview => ({ totalRows: 0, readyRows: 0, warningRows: 0, errorRows: 0, skippedRows: 0, payinRows: [], payoutRows: [], message });

export function ReconciliationTools({ period, fromDate, toDate, insurerId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ReconciliationUploadPreview | null>(null);
  const [importResult, setImportResult] = useState<AccountsImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const [isPreviewPending, startPreview] = useTransition();
  const [isImportPending, startImport] = useTransition();
  const downloadHref = useMemo(() => { const params = new URLSearchParams({ period, from: fromDate, to: toDate }); if (insurerId) params.set("insurer", insurerId); return `/accounts/reconciliation-template?${params.toString()}`; }, [period, fromDate, toDate, insurerId]);

  const runPreview = () => {
    if (!file) return setPreview(empty("Choose an .xlsx file first."));
    setImportResult(null); setImportError("");
    startPreview(async () => {
      const formData = new FormData(); formData.set("file", file);
      try { setPreview(await previewAccountsReconciliationUpload(formData)); }
      catch (error) { setPreview(empty(error instanceof Error ? error.message : "Unable to preview this workbook.")); }
    });
  };

  const runImport = () => {
    if (!file || !preview || preview.errorRows > 0 || !preview.totalRows) return;
    setImportResult(null); setImportError("");
    startImport(async () => {
      const formData = new FormData(); formData.set("file", file);
      try {
        const result = await confirmAccountsReconciliationUpload(formData);
        setImportResult(result);
        setPreview(null);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : "Unable to import this workbook.");
      }
    });
  };

  return <section className="rounded-2xl border border-[#dbe3ee] bg-white px-3 py-2.5 shadow-sm">
    <div className="flex flex-wrap items-center gap-2">
      <div className="mr-auto flex min-w-0 items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#e8f5f3] text-[#0f766e]"><FileSpreadsheet className="h-3.5 w-3.5" /></span>
        <div className="min-w-0"><p className="text-[7px] font-black uppercase tracking-[.08em] text-[#0f766e]">Excel reconciliation</p><p className="truncate text-[9px] font-semibold text-[#17365D]">Pay-In / Pay-Out workbook</p></div>
      </div>

      <span className="rounded-full border border-[#cfe8df] bg-[#f0faf6] px-2 py-1 text-[7px] font-bold text-[#0f766e]">Validation required</span>

      <a href={downloadHref} title="Download Accounts workbook" aria-label="Download Accounts workbook" className="grid h-8 w-8 place-items-center rounded-lg bg-[#17365D] text-white shadow-sm transition hover:bg-[#234b7a]"><Download className="h-3.5 w-3.5" /></a>

      <label title="Choose completed workbook" className="flex h-8 min-w-[220px] max-w-[420px] flex-1 cursor-pointer items-center gap-2 rounded-lg border border-[#d8e1ec] bg-[#fbfcfe] px-2.5 text-[8.5px] text-[#475467]">
        <UploadCloud className="h-3.5 w-3.5 shrink-0 text-[#3156b8]" />
        <input type="file" accept=".xlsx" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setImportResult(null); setImportError(""); }} />
        <span className="truncate">{file?.name ?? "Choose workbook"}</span>
      </label>

      <button type="button" title={isPreviewPending ? "Validating workbook" : "Preview upload"} aria-label={isPreviewPending ? "Validating workbook" : "Preview upload"} disabled={isPreviewPending || isImportPending || !file} onClick={runPreview} className="grid h-8 w-8 place-items-center rounded-lg bg-[#0f766e] text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40">
        <UploadCloud className="h-3.5 w-3.5" />
      </button>
    </div>

    {importResult ? <div className="mt-2 flex items-start gap-2 rounded-lg border border-[#bfe3d5] bg-[#f0faf6] px-3 py-1.5 text-[8.5px] font-semibold text-[#0f766e]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{importResult.message} The Business MIS export now reflects the posted Accounts records.</span></div> : null}
    {importError ? <div className="mt-2 rounded-lg border border-[#f3c7c3] bg-[#fff5f4] px-3 py-1.5 text-[8.5px] font-semibold text-[#b42318]">{importError}</div> : null}
    {preview ? <PreviewPanel preview={preview} isImportPending={isImportPending} onConfirm={runImport} /> : null}
  </section>;
}

function PreviewPanel({ preview, isImportPending, onConfirm }: { preview: ReconciliationUploadPreview; isImportPending: boolean; onConfirm: () => void }) {
  if (preview.message && !preview.totalRows) return <div className="mt-2 rounded-lg border border-[#f1d7a7] bg-[#fffaf0] px-3 py-1.5 text-[8.5px] font-semibold text-[#8a5a13]">{preview.message}</div>;
  const canImport = preview.totalRows > 0 && preview.errorRows === 0;
  return <div className="mt-2 border-t border-[#edf1f5] pt-2">
    <div className="grid gap-1.5 sm:grid-cols-5"><Metric label="Transactions" value={preview.totalRows} /><Metric label="Ready" value={preview.readyRows} /><Metric label="Warnings" value={preview.warningRows} /><Metric label="Errors" value={preview.errorRows} /><Metric label="Blank ignored" value={preview.skippedRows} /></div>
    {preview.payinRows.length ? <div className="mt-2"><p className="mb-1 text-[8.5px] font-bold text-[#17365D]">Pay-In validation</p><div className="max-h-[260px] overflow-auto rounded-lg border"><table className="min-w-[1320px] w-full text-left text-[8px]"><thead className="sticky top-0 bg-[#f8fafc]"><tr><th className="p-1.5">Row</th><th className="p-1.5">Policy</th><th className="p-1.5">Insurer</th><th className="p-1.5 text-right">Projected</th><th className="p-1.5">Bill</th><th className="p-1.5 text-right">Bill amount</th><th className="p-1.5 text-right">Difference</th><th className="p-1.5 text-right">TDS</th><th className="p-1.5 text-right">Received</th><th className="p-1.5">UTR / Ref</th><th className="p-1.5">Validation</th></tr></thead><tbody>{preview.payinRows.map(row => <tr key={`${row.rowNumber}-${row.policyId}-${row.reference}`} className="border-t"><td className="p-1.5">{row.rowNumber}</td><td className="p-1.5 font-semibold text-[#17365D]">{row.policyNumber}</td><td className="p-1.5">{row.insurer}</td><td className="p-1.5 text-right">{inr(row.projectedPayin)}</td><td className="p-1.5">{row.billNumber}</td><td className="p-1.5 text-right">{inr(row.billAmount)}</td><td className="p-1.5 text-right">{inr(row.difference)}</td><td className="p-1.5 text-right">{inr(row.actualTds)}</td><td className="p-1.5 text-right">{inr(row.amountReceived)}</td><td className="p-1.5">{row.reference || "—"}</td><td className="p-1.5"><Validation status={row.status} message={row.message} /></td></tr>)}</tbody></table></div></div> : null}
    {preview.payoutRows.length ? <div className="mt-2"><p className="mb-1 text-[8.5px] font-bold text-[#17365D]">Pay-Out validation</p><div className="max-h-[260px] overflow-auto rounded-lg border"><table className="min-w-[1120px] w-full text-left text-[8px]"><thead className="sticky top-0 bg-[#f8fafc]"><tr><th className="p-1.5">Row</th><th className="p-1.5">Policy</th><th className="p-1.5">Intermediary</th><th className="p-1.5 text-right">Projected payout</th><th className="p-1.5 text-right">Retention</th><th className="p-1.5 text-right">Paid</th><th className="p-1.5">Date</th><th className="p-1.5">UTR / Ref</th><th className="p-1.5">Validation</th></tr></thead><tbody>{preview.payoutRows.map(row => <tr key={`${row.rowNumber}-${row.payoutId}-${row.reference}`} className="border-t"><td className="p-1.5">{row.rowNumber}</td><td className="p-1.5 font-semibold text-[#17365D]">{row.policyNumber}</td><td className="p-1.5">{row.intermediaryCode}</td><td className="p-1.5 text-right">{inr(row.projectedGrossPayout)}</td><td className="p-1.5 text-right">{inr(row.projectedRetention)}</td><td className="p-1.5 text-right">{inr(row.paidAmount)}</td><td className="p-1.5">{row.paidDate}</td><td className="p-1.5">{row.reference}</td><td className="p-1.5"><Validation status={row.status} message={row.message} /></td></tr>)}</tbody></table></div></div> : null}
    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-dashed border-[#cfd9e6] bg-[#f8fafc] px-2.5 py-1.5">
      <span className="text-[8px] font-semibold text-[#667085]">{preview.errorRows ? "Resolve validation errors before import." : "Validated workbook ready to import."}</span>
      <button type="button" title={isImportPending ? "Importing workbook" : preview.errorRows ? "Resolve errors first" : "Confirm Import"} aria-label={isImportPending ? "Importing workbook" : preview.errorRows ? "Resolve errors first" : "Confirm Import"} disabled={!canImport || isImportPending} onClick={onConfirm} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#17365D] text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="h-3.5 w-3.5" /></button>
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border bg-[#fbfcfe] px-2.5 py-1.5"><p className="text-[7px] font-black uppercase tracking-[.06em] text-[#98a2b3]">{label}</p><p className="mt-0.5 text-[13px] font-semibold leading-4 text-[#17365D]">{value}</p></div>; }
function Validation({ status, message }: { status: PreviewStatus; message: string }) { return <div className="flex items-start gap-1.5"><StatusPill status={status} /><span className="max-w-[300px] leading-4 text-[#667085]">{message}</span></div>; }
function StatusPill({ status }: { status: PreviewStatus }) { const cls = status === "Ready" ? "bg-[#e8f5f3] text-[#0f766e]" : status === "Warning" ? "bg-[#fff7e6] text-[#9a6700]" : "bg-[#fff0f0] text-[#b42318]"; return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[7px] font-black ${cls}`}>{status}</span>; }
