"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, FileText, FileUp, Loader2, Phone, ShieldCheck, UserRound } from "lucide-react";

import { openPartnerPolicyIntakeDocumentWeb } from "@/lib/partner-policy-intake-document-client";
import {
  getPartnerPolicyIntakeWeb,
  POLICY_INTAKE_ACCEPT,
  submitPartnerPolicyIntakeReplacementWeb,
  validatePolicyIntakeFile,
  type IntakeProgress,
  type PartnerPolicyIntake,
  type PartnerPolicyIntakeField,
} from "@/lib/partner-policy-intakes-client";

const vehicleKeys = [
  "vehicle_registration_status",
  "vehicle_registration_number",
  "vehicle_class",
  "vehicle_make",
  "vehicle_model",
  "vehicle_fuel_type",
  "vehicle_manufacturing_year",
  "vehicle_capacity",
  "vehicle_chassis_number",
  "vehicle_engine_number",
  "vehicle_rto_name",
  "vehicle_rto_state",
];

const policyKeys = [
  "policy_product",
  "policy_number",
  "insurer_name",
  "idv",
  "od_premium",
  "tp_premium",
  "cpa_premium",
  "cpa_opted",
  "policy_start_date",
  "policy_end_date",
  "total_premium",
  "tax_amount",
  "gross_premium",
];

function statusLabel(row: PartnerPolicyIntake) {
  if (row.status === "processing" && row.ocr_status === "failed") return "Manual review required";
  return ({
    processing: "Fetching policy & vehicle details",
    ready_for_review: "Ready for review",
    in_review: "In review",
    needs_attention: "Needs attention",
    completed: "Completed",
    rejected: "Rejected",
  } as Record<string, string>)[row.status] ?? row.status;
}

function statusClass(row: PartnerPolicyIntake) {
  if (row.status === "processing" && row.ocr_status === "failed") return "bg-amber-50 text-amber-800";
  return ({
    processing: "bg-blue-50 text-blue-700",
    ready_for_review: "bg-indigo-50 text-indigo-700",
    in_review: "bg-violet-50 text-violet-700",
    needs_attention: "bg-amber-50 text-amber-800",
    completed: "bg-emerald-50 text-emerald-700",
    rejected: "bg-rose-50 text-rose-700",
  } as Record<string, string>)[row.status] ?? "bg-slate-50 text-slate-700";
}

function ocrLabel(status: string) {
  return status === "completed" ? "Details fetched" : status === "failed" ? "Manual review" : status === "processing" ? "Fetching details" : "Queued";
}

function submittedByLabel(row: PartnerPolicyIntake) {
  return row.lead_source_name || "INSUREIT Partner user";
}

function reviewerLabel(row: PartnerPolicyIntake) {
  if (row.status === "completed") return "Completed by Operations";
  if (row.status === "in_review" || row.status === "needs_attention") return "Operations team";
  return "Not assigned";
}

function orderedFields(fields: PartnerPolicyIntakeField[], order: string[]) {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  return order.map((key) => byKey.get(key)).filter((field): field is PartnerPolicyIntakeField => Boolean(field));
}

function formattedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN");
}

export function PartnerPolicyIntakeDetailClient({ intakeId }: { intakeId: string }) {
  const [row, setRow] = useState<PartnerPolicyIntake | null>(null);
  const [loading, setLoading] = useState(true);
  const [replacing, setReplacing] = useState(false);
  const [progress, setProgress] = useState<IntakeProgress | null>(null);
  const [error, setError] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [openingDocument, startDocumentTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (manual = false) => {
    if (!manual) setLoading(true);
    setError("");
    try {
      const result = await getPartnerPolicyIntakeWeb(intakeId);
      setRow(result.intake);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Policy Intake could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [intakeId]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const vehicleFields = useMemo(() => orderedFields(row?.ocr_fields ?? [], vehicleKeys), [row?.ocr_fields]);
  const policyFields = useMemo(() => orderedFields(row?.ocr_fields ?? [], policyKeys), [row?.ocr_fields]);

  async function replaceDocument(file?: File) {
    if (!row || !file || replacing) return;
    setError("");
    const fileError = validatePolicyIntakeFile(file);
    if (fileError) {
      setError(fileError);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setReplacing(true);
    setProgress({ stage: "preparing" });
    try {
      await submitPartnerPolicyIntakeReplacementWeb({ intakeId: row.id, file, onProgress: setProgress });
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
      await load(true);
    } catch (cause) {
      setProgress(null);
      setError(cause instanceof Error ? cause.message : "Replacement document could not be submitted.");
    } finally {
      setReplacing(false);
    }
  }

  function openDocument() {
    if (!row || openingDocument) return;
    setDocumentError("");
    startDocumentTransition(async () => {
      try {
        const url = await openPartnerPolicyIntakeDocumentWeb(row.id);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (cause) {
        setDocumentError(cause instanceof Error ? cause.message : "Could not open the policy copy.");
      }
    });
  }

  if (loading) {
    return <div className="py-14 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#7E90A8]" /><p className="mt-3 text-[11px] font-semibold text-[#526680]">Loading Policy Intake…</p></div>;
  }

  if (!row) {
    return <div className="rounded-2xl border border-[#DCE5EF] bg-white p-8 text-center shadow-sm"><AlertCircle className="mx-auto h-7 w-7 text-[#A66A18]" /><p className="mt-3 text-[12px] font-bold text-[#23395D]">Policy Intake unavailable</p><p className="mt-1 text-[10.5px] text-[#7A899F]">{error || "This intake is not available."}</p></div>;
  }

  const submittedBy = submittedByLabel(row);
  const manualReview = row.status === "processing" && row.ocr_status === "failed";

  return (
    <div className="mx-auto grid max-w-[1360px] gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <main className="min-w-0 overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-[0_14px_40px_rgba(15,23,42,.06)]">
        <header className="border-b border-[#E5ECF5] bg-[#F8FAFC] px-4 py-3.5 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#64748B]">Policy Intake Review</p>
              <h1 className="mt-1 text-[17px] font-semibold text-[#0F172A]">{row.intake_number}</h1>
              <p className="mt-1 text-[9px] text-[#64748B]">Submitted by <span className="font-semibold text-[#334155]">{submittedBy}</span> · {formattedDate(row.created_at)}</p>
            </div>
            <span className={`inline-flex self-start rounded-full px-2.5 py-1 text-[8.5px] font-bold ${statusClass(row)}`}>{statusLabel(row)}</span>
          </div>

          <div className="mt-3 grid gap-2 border-t border-[#E5ECF5] pt-3 sm:grid-cols-3">
            <HeaderMeta icon={<Phone className="h-3.5 w-3.5" />} label="Customer" value={row.customer_mobile} hint="Partner supplied" />
            <HeaderMeta icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Lead source" value={row.lead_source_name} hint={`${row.lead_source_type.toUpperCase()}${row.lead_source_code ? ` · ${row.lead_source_code}` : ""}`} />
            <HeaderMeta icon={<FileText className="h-3.5 w-3.5" />} label="Policy copy" value={row.file_name} hint="Original source document" />
          </div>

          {row.attention_reason ? <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[9px] font-medium text-amber-900">Operations note: {row.attention_reason}</div> : null}
          {error ? <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[9px] font-medium text-rose-800">{error}</div> : null}
        </header>

        <ReviewSection number="01" title="Source & customer" subtitle="Details supplied by Partner before automatic policy reading.">
          <ReviewField label="Submitted by" value={submittedBy} source="Partner" />
          <ReviewField label="Customer mobile" value={row.customer_mobile} source="Partner" />
          <ReviewField label="Lead source" value={row.lead_source_name} source="Partner" />
          <ReviewField label="Intermediary" value={`${row.lead_source_type.toUpperCase()}${row.lead_source_code ? ` · ${row.lead_source_code}` : ""}`} source="Partner" />
        </ReviewSection>

        <ReviewSection number="02" title="Vehicle details" subtitle={row.ocr_status === "completed" ? "Fetched from the uploaded policy copy for Operations review." : "Vehicle information will appear here when available."}>
          {vehicleFields.length ? vehicleFields.map((item) => <ReviewField key={item.key} label={item.label} value={item.value} source="OCR" confidence={item.confidence} />) : <SectionEmpty text={manualReview ? "Automatic vehicle extraction was unavailable. Operations will use the saved policy copy for manual review." : "Fetching vehicle details from the saved policy copy…"} />}
        </ReviewSection>

        <ReviewSection number="03" title="Policy & premium" subtitle={row.ocr_status === "completed" ? "Proposal only. Operations confirms these values in Policy Onboarding." : "Policy and premium information will appear here when available."}>
          {policyFields.length ? policyFields.map((item) => <ReviewField key={item.key} label={item.label} value={item.value} source="OCR" confidence={item.confidence} />) : <SectionEmpty text={manualReview ? "Automatic policy extraction was unavailable. Operations will continue with manual review from the policy copy." : "Fetching policy and premium details…"} />}
        </ReviewSection>
      </main>

      <aside className="space-y-3 xl:sticky xl:top-[88px] xl:self-start">
        <section className="rounded-2xl border border-[#DCE5EF] bg-white p-3 shadow-sm">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 text-[#315B9A]" />
            <div className="min-w-0"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#64748B]">Policy copy</p><p className="mt-1 truncate text-[9px] font-semibold text-[#334155]">{row.file_name}</p></div>
          </div>
          <button type="button" onClick={openDocument} disabled={openingDocument} className="mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#D7E1EC] bg-white text-[9px] font-bold text-[#17365D] transition hover:bg-[#F8FAFC] disabled:opacity-60">
            {openingDocument ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {openingDocument ? "Opening…" : "View policy copy"}
            {!openingDocument ? <ExternalLink className="h-3 w-3" /> : null}
          </button>
          {documentError ? <p className="mt-1.5 text-[8px] font-semibold text-red-600">{documentError}</p> : null}
        </section>

        <section className="rounded-2xl border border-[#DCE5EF] bg-white p-3 shadow-sm">
          <p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#64748B]">Review status</p>
          <div className="mt-2 space-y-2 text-[9px]">
            <SideMeta label="Workflow" value={statusLabel(row)} />
            <SideMeta label="Detail fetch" value={ocrLabel(row.ocr_status)} />
            <SideMeta label="Reviewer" value={reviewerLabel(row)} />
          </div>
        </section>

        {row.final_policy_id ? (
          <Link href={`/partner/policies/${encodeURIComponent(row.final_policy_id)}`} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE5EF] bg-white px-3 text-[9px] font-bold text-[#17365D] shadow-sm transition hover:bg-[#F8FAFC]">
            Open final policy <ExternalLink className="h-3 w-3" />
          </Link>
        ) : null}

        <div className="rounded-xl bg-[#F3F7FB] px-3 py-2.5 text-[8.5px] leading-4 text-[#64748B]"><UserRound className="mb-1.5 h-3.5 w-3.5 text-[#315B9A]" />This is a pre-onboarding review sheet. The saved policy copy remains the source document; final corrections are made by Operations in Policy Onboarding.</div>

        {row.status === "needs_attention" ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
            <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><div><p className="text-[9px] font-bold text-amber-900">Operations needs your response</p><p className="mt-1 text-[8.5px] leading-4 text-amber-800">{row.attention_reason || "Upload the requested replacement policy copy."}</p></div></div>
            <input ref={fileRef} type="file" accept={POLICY_INTAKE_ACCEPT} className="sr-only" onChange={(event) => void replaceDocument(event.target.files?.[0])} />
            {progress ? <UploadProgress progress={progress} /> : null}
            <button type="button" disabled={replacing} onClick={() => fileRef.current?.click()} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#17365D] px-3 text-[9px] font-bold text-white transition hover:bg-[#244D80] disabled:opacity-50">
              {replacing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
              {replacing ? "Uploading replacement…" : "Upload replacement policy copy"}
            </button>
          </section>
        ) : null}

        <div className="sr-only" aria-live="polite">{row.status === "completed" ? <CheckCircle2 /> : null}</div>
      </aside>
    </div>
  );
}

function HeaderMeta({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return <div className="flex min-w-0 items-start gap-2"><span className="mt-0.5 text-[#315B9A]">{icon}</span><div className="min-w-0"><p className="text-[7.5px] font-bold uppercase tracking-[.06em] text-[#8A96A8]">{label}</p><p className="mt-0.5 truncate text-[9.5px] font-semibold text-[#334155]">{value || "—"}</p><p className="mt-0.5 truncate text-[7.5px] text-[#8A96A8]">{hint}</p></div></div>;
}

function ReviewSection({ number, title, subtitle, children }: { number: string; title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="border-b border-[#E5ECF5] px-4 py-4 last:border-b-0 sm:px-5"><div className="mb-3 flex items-start gap-3"><span className="mt-0.5 text-[9px] font-bold tabular-nums text-[#315B9A]">{number}</span><div><h2 className="text-[12px] font-semibold text-[#17365D]">{title}</h2><p className="mt-0.5 text-[8.5px] text-[#7A8798]">{subtitle}</p></div></div><div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div></section>;
}

function ReviewField({ label, value, source, confidence }: { label: string; value: string; source: "Partner" | "OCR"; confidence?: number | null }) {
  const review = source === "OCR" && typeof confidence === "number" && confidence < .9;
  return <div className="min-w-0 py-1"><div className="flex items-center gap-1.5"><p className="text-[7.5px] font-bold uppercase tracking-[.055em] text-[#7A8798]">{label}</p><span className="rounded bg-[#EEF3F8] px-1.5 py-0.5 text-[6.5px] font-bold uppercase tracking-[.04em] text-[#60758D]">{source}</span>{review ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[6.5px] font-bold uppercase text-amber-800">Review</span> : null}</div><p className="mt-1 break-words text-[10.5px] font-semibold leading-4 text-[#253B59]">{value || "—"}</p>{review && typeof confidence === "number" ? <p className="mt-0.5 text-[7px] text-amber-700">{Math.round(confidence * 100)}% extraction confidence</p> : null}</div>;
}

function SectionEmpty({ text }: { text: string }) {
  return <p className="col-span-full py-2 text-[9px] text-[#7A8798]">{text}</p>;
}

function SideMeta({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3"><span className="text-[#7A8798]">{label}</span><span className="text-right font-semibold text-[#334155]">{value}</span></div>;
}

function UploadProgress({ progress }: { progress: IntakeProgress }) {
  const percent = progress.stage === "preparing" ? 8 : progress.stage === "submitting" ? 96 : Math.max(12, Math.min(92, progress.percent ?? 12));
  const label = progress.stage === "preparing" ? "Preparing secure upload" : progress.stage === "submitting" ? "Sending to Operations" : "Uploading replacement";
  return <div className="mt-3"><div className="flex justify-between text-[8px] font-semibold text-amber-800"><span>{label}</span><span>{Math.round(percent)}%</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-amber-600" style={{ width: String(percent) + "%" }} /></div></div>;
}
