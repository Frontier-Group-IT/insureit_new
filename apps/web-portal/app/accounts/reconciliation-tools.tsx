"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { previewAccountsReconciliationUpload, type ReconciliationUploadPreview } from "./reconciliation-upload-actions";

type Props = {
  period: string;
  fromDate: string;
  toDate: string;
  insurerId: string | null;
};

const inr = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);

export function ReconciliationTools({ period, fromDate, toDate, insurerId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ReconciliationUploadPreview | null>(null);
  const [isPending, startTransition] = useTransition();

  const downloadHref = useMemo(() => {
    const params = new URLSearchParams({ period, from: fromDate, to: toDate });
    if (insurerId) params.set("insurer", insurerId);
    return `/accounts/reconciliation-template?${params.toString()}`;
  }, [period, fromDate, toDate, insurerId]);

  const runPreview = () => {
    if (!file) {
      setPreview({ totalRows: 0, readyRows: 0, warningRows: 0, errorRows: 0, rows: [], message: "Choose an .xlsx file first." });
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      try {
        setPreview(await previewAccountsReconciliationUpload(formData));
      } catch (error) {
        setPreview({ totalRows: 0, readyRows: 0, warningRows: 0, errorRows: 0, rows: [], message: error instanceof Error ? error.message : "Unable to preview this workbook." });
      }
    });
  };

  return (
    <section className="rounded-2xl border border-[#dbe3ee] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[.1em] text-[#0f766e]">Reconciliation Excel test</p>
          <h2 className="mt-1 text-[14px] font-semibold text-[#17365D]">Download → fill → upload → validate</h2>
          <p className="mt-1 max-w-3xl text-[9px] leading-4 text-[#7c899b]">The workbook carries system reference columns plus only the billing and payment fields Accounts should maintain. Upload is preview-only in this phase; no database records are changed.</p>
        </div>
        <span className="rounded-full border border-[#dce4ee] bg-[#f8fafc] px-2.5 py-1 text-[8px] font-bold text-[#667085]">Step 2 · safe preview</span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.25fr]">
        <div className="rounded-xl border border-[#e2e8f0] bg-[#fbfcfe] p-3">
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e8f5f3] text-[#0f766e]"><FileSpreadsheet className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-[#17365D]">1. Download controlled template</p>
              <p className="mt-1 text-[8.5px] leading-4 text-[#7c899b]">Uses the current dashboard date and insurer filters. Expected Pay-in is system generated; Difference is intentionally not an editable Excel field.</p>
              <a href={downloadHref} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#17365D] px-3 py-2 text-[9px] font-bold text-white hover:bg-[#234b7a]">
                <Download className="h-3.5 w-3.5" />Download Excel template
              </a>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#e2e8f0] bg-[#fbfcfe] p-3">
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eef4ff] text-[#3156b8]"><UploadCloud className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-[#17365D]">2. Upload for validation preview</p>
              <p className="mt-1 text-[8.5px] leading-4 text-[#7c899b]">INSUREIT re-checks Reconciliation ID and Expected Pay-in against live system data before showing the preview.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="flex min-h-9 min-w-[240px] flex-1 cursor-pointer items-center rounded-lg border border-[#d8e1ec] bg-white px-3 text-[9px] font-medium text-[#475467]">
                  <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); }} />
                  <span className="truncate">{file?.name ?? "Choose completed .xlsx template"}</span>
                </label>
                <button type="button" disabled={isPending || !file} onClick={runPreview} className="h-9 rounded-lg bg-[#0f766e] px-3 text-[9px] font-bold text-white disabled:opacity-40">
                  {isPending ? "Validating…" : "Preview upload"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {preview ? <PreviewPanel preview={preview} /> : null}
    </section>
  );
}

function PreviewPanel({ preview }: { preview: ReconciliationUploadPreview }) {
  if (preview.message && !preview.rows.length) {
    return <div className="mt-3 rounded-xl border border-[#f1d7a7] bg-[#fffaf0] px-3 py-2 text-[9px] font-semibold text-[#8a5a13]">{preview.message}</div>;
  }
  return (
    <div className="mt-3 border-t border-[#edf1f5] pt-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <PreviewMetric label="Rows" value={preview.totalRows} />
        <PreviewMetric label="Ready" value={preview.readyRows} />
        <PreviewMetric label="Warnings" value={preview.warningRows} />
        <PreviewMetric label="Errors" value={preview.errorRows} />
      </div>
      <div className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-[#e2e8f0]">
        <table className="min-w-[1280px] w-full text-left text-[8.5px]">
          <thead className="sticky top-0 z-10 bg-[#f8fafc] text-[#667085]"><tr>
            <th className="p-2">Row</th><th className="p-2">Policy</th><th className="p-2">Insurer</th><th className="p-2 text-right">Expected</th><th className="p-2">Bill no.</th><th className="p-2 text-right">Bill amount</th><th className="p-2 text-right">Difference</th><th className="p-2 text-right">Paid</th><th className="p-2">UTR</th><th className="p-2">Validation</th>
          </tr></thead>
          <tbody>{preview.rows.map((row) => <tr key={`${row.rowNumber}-${row.reconciliationId}`} className="border-t border-[#eef2f6]">
            <td className="p-2">{row.rowNumber}</td><td className="p-2 font-semibold text-[#17365D]">{row.policyNumber || "—"}</td><td className="p-2">{row.insurer || "—"}</td><td className="p-2 text-right">{inr(row.expectedPayin)}</td><td className="p-2">{row.billNumber || "—"}</td><td className="p-2 text-right">{inr(row.billAmount)}</td><td className="p-2 text-right font-semibold">{inr(row.difference)}</td><td className="p-2 text-right">{inr(row.paidAmount)}</td><td className="p-2">{row.utrDetails || "—"}</td><td className="p-2"><div className="flex items-start gap-2"><StatusPill status={row.status} /><span className="max-w-[280px] leading-4 text-[#667085]">{row.message}</span></div></td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="mt-2 text-[8.5px] font-semibold text-[#667085]">Preview only — there is deliberately no “Import” button yet. Financial writes will be enabled only after this format is approved.</p>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-[#e2e8f0] bg-[#fbfcfe] px-3 py-2"><p className="text-[7.5px] font-black uppercase tracking-[.08em] text-[#98a2b3]">{label}</p><p className="mt-0.5 text-[15px] font-semibold text-[#17365D]">{value}</p></div>;
}
function StatusPill({ status }: { status: "Ready" | "Warning" | "Error" }) {
  const classes = status === "Ready" ? "bg-[#e8f5f3] text-[#0f766e]" : status === "Warning" ? "bg-[#fff7e6] text-[#9a6700]" : "bg-[#fff0f0] text-[#b42318]";
  return <span className={`shrink-0 rounded-full px-2 py-1 text-[7.5px] font-black ${classes}`}>{status}</span>;
}
