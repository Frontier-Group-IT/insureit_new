"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, UploadCloud, X } from "lucide-react";
import { previewAccountsReconciliationUpload, type ReconciliationUploadPreview, type PreviewStatus } from "./reconciliation-upload-actions";
import { confirmAccountsReconciliationUpload, type AccountsImportResult } from "./reconciliation-import-actions";

const inr = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
const empty = (message: string): ReconciliationUploadPreview => ({ totalRows: 0, readyRows: 0, warningRows: 0, errorRows: 0, skippedRows: 0, payinRows: [], payoutRows: [], message });
const VALIDATION_TIMEOUT_MS = 45_000;

export function ReconciliationTools() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ReconciliationUploadPreview | null>(null);
  const [importResult, setImportResult] = useState<AccountsImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);
  const [isImportPending, startImport] = useTransition();

  const previewFile = async (nextFile: File) => {
    setFile(nextFile);
    setImportResult(null);
    setImportError("");
    setPreview(null);
    setIsPreviewing(true);
    setValidationProgress(4);

    let progressTimer: ReturnType<typeof setInterval> | null = null;
    try {
      progressTimer = setInterval(() => {
        setValidationProgress((current) => {
          if (current >= 92) return current;
          const step = current < 35 ? 7 : current < 70 ? 4 : 2;
          return Math.min(92, current + step);
        });
      }, 650);

      const formData = new FormData();
      formData.set("file", nextFile);
      const result = await withTimeout(
        previewAccountsReconciliationUpload(formData),
        VALIDATION_TIMEOUT_MS,
        "Validation is taking too long. Please retry the workbook. No data has been posted.",
      );
      setValidationProgress(100);
      setPreview(result);
    } catch (error) {
      setPreview(empty(error instanceof Error ? error.message : "Unable to preview this workbook."));
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setIsPreviewing(false);
    }
  };

  const runImport = () => {
    if (!file || !preview || preview.errorRows > 0 || !preview.totalRows) return;
    setImportResult(null);
    setImportError("");
    startImport(async () => {
      const formData = new FormData();
      formData.set("file", file);
      try {
        const result = await confirmAccountsReconciliationUpload(formData);
        setImportResult(result);
        setPreview(null);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : "Unable to import this workbook.");
      }
    });
  };

  const showPopover = isPreviewing || preview || importResult || importError;

  return <div className="relative flex items-center gap-1.5">
    <label title="Upload reconciliation figures" aria-label="Upload reconciliation figures" className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-[#3156b8] bg-[#eef4ff] text-[#3156b8] shadow-sm transition hover:bg-[#e3edff]">
      <input type="file" accept=".xlsx" className="hidden" disabled={isPreviewing} onChange={(event) => { const nextFile = event.target.files?.[0]; if (nextFile) void previewFile(nextFile); event.currentTarget.value = ""; }} />
      {isPreviewing ? <span className="text-[7px] font-black tabular-nums">{validationProgress}%</span> : <UploadCloud className="h-3.5 w-3.5" />}
    </label>

    {showPopover ? <div className="absolute right-0 top-10 z-50 w-[min(920px,calc(100vw-32px))] rounded-xl border border-[#dbe3ee] bg-white p-3 shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-[#edf1f5] pb-2">
        <div className="min-w-0">
          <p className="truncate text-[9px] font-semibold text-[#17365D]">{file?.name ?? "Reconciliation upload"}</p>
          <p className="mt-0.5 text-[7.5px] text-[#7c899b]">{isPreviewing ? `Validating workbook · ${validationProgress}%` : importResult ? "Import completed" : importError ? "Import failed" : preview ? "Validation preview" : ""}</p>
        </div>
        <button type="button" title="Close" aria-label="Close reconciliation panel" disabled={isPreviewing} onClick={() => { setPreview(null); setImportResult(null); setImportError(""); }} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#dce4ee] text-[#667085] hover:bg-[#f8fafc] disabled:opacity-40"><X className="h-3.5 w-3.5" /></button>
      </div>

      {isPreviewing ? <ValidationProgress value={validationProgress} /> : null}
      {importResult ? <div className="mt-2 flex items-start gap-2 rounded-lg border border-[#bfe3d5] bg-[#f0faf6] px-3 py-2 text-[8.5px] font-semibold text-[#0f766e]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{importResult.message}</span></div> : null}
      {importError ? <div className="mt-2 rounded-lg border border-[#f3c7c3] bg-[#fff5f4] px-3 py-2 text-[8.5px] font-semibold text-[#b42318]">{importError}</div> : null}
      {!isPreviewing && preview ? <PreviewPanel preview={preview} isImportPending={isImportPending} onConfirm={runImport} /> : null}
    </div> : null}
  </div>;
}

function ValidationProgress({ value }: { value: number }) {
  return <div className="flex flex-col items-center justify-center gap-3 py-7">
    <div className="relative grid h-16 w-16 place-items-center rounded-full" style={{ background: `conic-gradient(#3156b8 ${value * 3.6}deg, #e8edf5 0deg)` }}>
      <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-[12px] font-black tabular-nums text-[#17365D]">{value}%</div>
    </div>
    <div className="w-full max-w-[320px] overflow-hidden rounded-full bg-[#edf1f5]">
      <div className="h-1.5 rounded-full bg-[#3156b8] transition-[width] duration-500 ease-out" style={{ width: `${value}%` }} />
    </div>
    <p className="text-[8.5px] font-semibold text-[#667085]">{value < 30 ? "Reading workbook" : value < 70 ? "Checking live policy and commercial data" : value < 95 ? "Checking transaction references" : "Finishing validation"}</p>
  </div>;
}

function PreviewPanel({ preview, isImportPending, onConfirm }: { preview: ReconciliationUploadPreview; isImportPending: boolean; onConfirm: () => void }) {
  if (preview.message && !preview.totalRows) return <div className="mt-2 rounded-lg border border-[#f1d7a7] bg-[#fffaf0] px-3 py-2 text-[8.5px] font-semibold text-[#8a5a13]">{preview.message}</div>;
  const canImport = preview.totalRows > 0 && preview.errorRows === 0;
  return <div className="mt-2">
    <div className="grid gap-1.5 sm:grid-cols-5"><Metric label="Transactions" value={preview.totalRows} /><Metric label="Ready" value={preview.readyRows} /><Metric label="Warnings" value={preview.warningRows} /><Metric label="Errors" value={preview.errorRows} /><Metric label="Blank ignored" value={preview.skippedRows} /></div>
    {preview.payinRows.length ? <ValidationTable title="Pay-In validation" rows={preview.payinRows.map(row => [row.rowNumber, row.policyNumber, row.insurer, inr(row.projectedPayin), row.billNumber, inr(row.billAmount), inr(row.difference), inr(row.actualTds), inr(row.amountReceived), row.reference || "—", <Validation key="v" status={row.status} message={row.message} />])} headers={["Row","Policy","Insurer","Projected","Bill","Bill amount","Difference","TDS","Received","UTR / Ref","Validation"]} minWidth="1320px" /> : null}
    {preview.payoutRows.length ? <ValidationTable title="Pay-Out validation" rows={preview.payoutRows.map(row => [row.rowNumber, row.policyNumber, row.intermediaryCode, inr(row.projectedGrossPayout), inr(row.projectedRetention), inr(row.paidAmount), row.paidDate, row.reference, <Validation key="v" status={row.status} message={row.message} />])} headers={["Row","Policy","Intermediary","Projected payout","Retention","Paid","Date","UTR / Ref","Validation"]} minWidth="1120px" /> : null}
    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-dashed border-[#cfd9e6] bg-[#f8fafc] px-2.5 py-1.5">
      <span className="text-[8px] font-semibold text-[#667085]">{preview.errorRows ? "Resolve validation errors before import." : "Validated workbook ready to import."}</span>
      <button type="button" title={preview.errorRows ? "Resolve errors first" : "Confirm Import"} aria-label={preview.errorRows ? "Resolve errors first" : "Confirm Import"} disabled={!canImport || isImportPending} onClick={onConfirm} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#17365D] text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40">{isImportPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}</button>
    </div>
  </div>;
}

function ValidationTable({ title, headers, rows, minWidth }: { title: string; headers: string[]; rows: React.ReactNode[][]; minWidth: string }) {
  return <div className="mt-2"><p className="mb-1 text-[8.5px] font-bold text-[#17365D]">{title}</p><div className="max-h-[240px] overflow-auto rounded-lg border"><table className="w-full text-left text-[8px]" style={{ minWidth }}><thead className="sticky top-0 bg-[#f8fafc]"><tr>{headers.map(header => <th key={header} className="p-1.5">{header}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t">{row.map((cell, cellIndex) => <td key={cellIndex} className="p-1.5">{cell}</td>)}</tr>)}</tbody></table></div></div>;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => { timeout = setTimeout(() => reject(new Error(message)), timeoutMs); }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border bg-[#fbfcfe] px-2.5 py-1.5"><p className="text-[7px] font-black uppercase tracking-[.06em] text-[#98a2b3]">{label}</p><p className="mt-0.5 text-[13px] font-semibold leading-4 text-[#17365D]">{value}</p></div>; }
function Validation({ status, message }: { status: PreviewStatus; message: string }) { return <div className="flex items-start gap-1.5"><StatusPill status={status} /><span className="max-w-[280px] leading-4 text-[#667085]">{message}</span></div>; }
function StatusPill({ status }: { status: PreviewStatus }) { const cls = status === "Ready" ? "bg-[#e8f5f3] text-[#0f766e]" : status === "Warning" ? "bg-[#fff7e6] text-[#9a6700]" : "bg-[#fff0f0] text-[#b42318]"; return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[7px] font-black ${cls}`}>{status}</span>; }
