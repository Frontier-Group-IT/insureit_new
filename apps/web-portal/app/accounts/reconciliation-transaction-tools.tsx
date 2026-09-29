"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, FileDown, FileSpreadsheet, Loader2, X } from "lucide-react";
import {
  confirmAccountsTransactionUpload,
  previewAccountsTransactionUpload,
  type AccountsTransactionImportResult,
  type AccountsTransactionUploadPreview,
  type TransactionTemplateType,
} from "./reconciliation-transaction-upload-actions";

const QUEUES = [
  { value: "all", label: "All applicable" },
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "variance", label: "Variance" },
] as const;

export function ReconciliationTransactionTools({ onImported }: { onImported?: () => void | Promise<void> }) {
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AccountsTransactionUploadPreview | null>(null);
  const [result, setResult] = useState<AccountsTransactionImportResult | null>(null);
  const [error, setError] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImportPending, startImport] = useTransition();
  const downloadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!downloadOpen) return;
    const close = (event: MouseEvent) => {
      if (!downloadRef.current?.contains(event.target as Node)) setDownloadOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDownloadOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [downloadOpen]);

  const previewFile = async (nextFile: File) => {
    setFile(nextFile);
    setPreview(null);
    setResult(null);
    setError("");
    setIsPreviewing(true);
    try {
      const formData = new FormData();
      formData.set("file", nextFile);
      const next = await previewAccountsTransactionUpload(formData);
      if (!next.recognized) throw new Error("This is not an INSUREIT transaction template. Use the existing reconciliation upload button for the full Business MIS workbook.");
      setPreview(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to validate this transaction workbook.");
    } finally {
      setIsPreviewing(false);
    }
  };

  const runImport = () => {
    if (!file || !preview || preview.errorRows || !preview.totalRows) return;
    setError("");
    setResult(null);
    startImport(async () => {
      try {
        const formData = new FormData();
        formData.set("file", file);
        const next = await confirmAccountsTransactionUpload(formData);
        setResult(next);
        setPreview(null);
        await onImported?.();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to import this transaction workbook.");
      }
    });
  };

  const showPanel = isPreviewing || preview || result || error;

  return <div className="relative flex items-center gap-1">
    <div ref={downloadRef} className="relative">
      <button type="button" onClick={() => setDownloadOpen((value) => !value)} title="Download transaction template" aria-label="Download reconciliation transaction template" aria-expanded={downloadOpen} className="flex h-8 items-center gap-1 rounded-lg border border-[#dce4ee] bg-white px-2 text-[#17365D] shadow-sm transition hover:bg-[#f8fafc]">
        <FileDown className="h-3.5 w-3.5" />
        <ChevronDown className={`h-3 w-3 transition-transform ${downloadOpen ? "rotate-180" : ""}`} />
      </button>
      {downloadOpen ? <div className="absolute right-0 top-10 z-50 w-[300px] rounded-xl border border-[#dbe3ee] bg-white p-2.5 shadow-xl">
        <div className="mb-2 border-b border-[#edf1f5] pb-2">
          <p className="text-[9px] font-semibold text-[#17365D]">Transaction templates</p>
          <p className="mt-0.5 text-[7.5px] text-[#7c899b]">Download only the policy rows needed for the next Pay-In or Payout entries.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TemplateLinks type="payin" label="Pay-In" />
          <TemplateLinks type="payout" label="Payout" />
        </div>
      </div> : null}
    </div>

    <label title="Upload transaction template" aria-label="Upload reconciliation transaction template" className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-[#0f766e] bg-[#f0faf6] text-[#0f766e] shadow-sm transition hover:bg-[#e5f6ef]">
      <input type="file" accept=".xlsx" className="hidden" disabled={isPreviewing || isImportPending} onChange={(event) => { const nextFile = event.target.files?.[0]; if (nextFile) void previewFile(nextFile); event.currentTarget.value = ""; }} />
      {isPreviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
    </label>

    {showPanel ? <div className="absolute right-0 top-10 z-50 w-[min(720px,calc(100vw-24px))] rounded-xl border border-[#dbe3ee] bg-white p-2.5 shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-[#edf1f5] pb-2">
        <div className="min-w-0">
          <p className="truncate text-[9px] font-semibold text-[#17365D]">{file?.name ?? "Transaction reconciliation"}</p>
          <p className="mt-0.5 text-[7.5px] text-[#7c899b]">Append-only Pay-In / Payout import · all rows post atomically</p>
        </div>
        <button type="button" title="Close" aria-label="Close transaction panel" disabled={isPreviewing || isImportPending} onClick={() => { setPreview(null); setResult(null); setError(""); }} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#dce4ee] text-[#667085] hover:bg-[#f8fafc] disabled:opacity-40"><X className="h-3.5 w-3.5" /></button>
      </div>

      {isPreviewing ? <div className="flex items-center justify-center gap-2 py-8 text-[9px] font-semibold text-[#667085]"><Loader2 className="h-4 w-4 animate-spin" />Validating current policy and reconciliation data…</div> : null}
      {result ? <div className="mt-2 flex items-start gap-2 rounded-lg border border-[#bfe3d5] bg-[#f0faf6] px-3 py-2 text-[8.5px] font-semibold text-[#0f766e]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{result.message}</span></div> : null}
      {error ? <div className="mt-2 rounded-lg border border-[#f3c7c3] bg-[#fff5f4] px-3 py-2 text-[8.5px] font-semibold text-[#b42318]">{error}</div> : null}
      {!isPreviewing && preview ? <TransactionPreview preview={preview} pending={isImportPending} onImport={runImport} /> : null}
    </div> : null}
  </div>;
}

function TemplateLinks({ type, label }: { type: TransactionTemplateType; label: string }) {
  return <div className="rounded-lg border border-[#e3e9f1] bg-[#fbfcfe] p-2">
    <p className="mb-1.5 text-[8px] font-bold text-[#17365D]">{label}</p>
    <div className="space-y-0.5">{QUEUES.map((queue) => <a key={queue.value} href={templateHref(type, queue.value)} className="block rounded-md px-2 py-1 text-[7.5px] font-semibold text-[#667085] hover:bg-white hover:text-[#17365D]">{queue.label}</a>)}</div>
  </div>;
}

function templateHref(type: TransactionTemplateType, queue: string) {
  if (typeof window === "undefined") return `/accounts/reconciliation-transaction-template?type=${type}&queue=${queue}`;
  const current = new URLSearchParams(window.location.search);
  const params = new URLSearchParams({ type, queue });
  for (const key of ["period", "from", "to", "insurer"]) {
    const value = current.get(key);
    if (value) params.set(key, value);
  }
  return `/accounts/reconciliation-transaction-template?${params.toString()}`;
}

function TransactionPreview({ preview, pending, onImport }: { preview: AccountsTransactionUploadPreview; pending: boolean; onImport: () => void }) {
  if (!preview.totalRows) return <div className="mt-2 rounded-lg border border-[#f1d7a7] bg-[#fffaf0] px-3 py-2 text-[8.5px] font-semibold text-[#8a5a13]">{preview.message}</div>;
  const canImport = preview.errorRows === 0;
  return <div className="mt-2">
    <div className="grid grid-cols-4 gap-1">
      <Metric label="Rows" value={preview.totalRows} />
      <Metric label="Ready" value={preview.readyRows} />
      <Metric label="Warnings" value={preview.warningRows} />
      <Metric label="Errors" value={preview.errorRows} />
    </div>
    <div className="mt-2 max-h-[220px] overflow-auto rounded-lg border border-[#e3e9f1]">
      <table className="w-full min-w-[650px] table-fixed text-left text-[7.5px]">
        <thead className="sticky top-0 z-10 bg-[#f8fafc]"><tr>{["Row","Policy","Type","Reference","Amount","Date","Status"].map((header) => <th key={header} className="px-1.5 py-1.5 font-bold text-[#667085]">{header}</th>)}</tr></thead>
        <tbody>{preview.rows.map((row) => <tr key={row.rowNumber} className="border-t border-[#edf1f5] align-top">
          <td className="px-1.5 py-1.5">{row.rowNumber}</td><td className="px-1.5 py-1.5 font-semibold text-[#344054]">{row.policyNumber || "—"}</td><td className="px-1.5 py-1.5">{row.type === "payin" ? "Pay-In" : "Payout"}</td><td className="px-1.5 py-1.5">{row.reference || "—"}</td><td className="px-1.5 py-1.5">{currency(row.amount)}</td><td className="px-1.5 py-1.5">{row.date || "—"}</td><td className="px-1.5 py-1.5"><span className={`rounded-full px-1.5 py-0.5 font-bold ${row.status === "Ready" ? "bg-[#e8f5f3] text-[#0f766e]" : row.status === "Warning" ? "bg-[#fff7e6] text-[#9a6700]" : "bg-[#fff0f0] text-[#b42318]"}`}>{row.status}</span><p className="mt-1 leading-3 text-[#667085]">{row.message}</p></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-dashed border-[#cfd9e6] bg-[#f8fafc] px-2.5 py-1.5">
      <span className="text-[8px] font-semibold text-[#667085]">{preview.errorRows ? "Resolve errors before import." : preview.warningRows ? "Warnings are allowed; review them before posting." : "All rows are ready. Import posts the whole workbook atomically."}</span>
      <button type="button" disabled={!canImport || pending} onClick={onImport} title="Post transaction workbook" aria-label="Post transaction workbook" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#17365D] text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}</button>
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border bg-[#fbfcfe] px-2 py-1"><p className="text-[6.5px] font-black uppercase tracking-[.05em] text-[#98a2b3]">{label}</p><p className="text-[12px] font-semibold leading-4 text-[#17365D]">{value}</p></div>; }
function currency(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value); }
