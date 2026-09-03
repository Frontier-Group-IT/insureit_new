"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, FileUp, Loader2, RefreshCw } from "lucide-react";
import { PartnerPageHeader, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
import {
  getPartnerPolicyIntakeWeb,
  POLICY_INTAKE_ACCEPT,
  submitPartnerPolicyIntakeReplacementWeb,
  validatePolicyIntakeFile,
  type IntakeProgress,
  type PartnerPolicyIntake,
} from "@/lib/partner-policy-intakes-client";

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function statusLabel(row: PartnerPolicyIntake) {
  if (row.status === "processing" && row.ocr_status === "failed") return "Manual review required";
  const labels: Record<string, string> = {
    processing: "Fetching policy details",
    ready_for_review: "Ready for Operations review",
    in_review: "In Operations review",
    needs_attention: "Your response is needed",
    completed: "Policy onboarding completed",
    rejected: "Intake rejected",
  };
  return labels[row.status] || humanize(row.status);
}

function statusHelp(row: PartnerPolicyIntake) {
  if (row.status === "processing" && row.ocr_status === "failed") return "Automatic extraction was unavailable. Operations can continue from the saved policy copy.";
  if (row.status === "processing") return "The uploaded policy copy is being read automatically.";
  if (row.status === "ready_for_review") return "The extracted details are ready for an Operations reviewer.";
  if (row.status === "in_review") return "An Operations user is reviewing this intake.";
  if (row.status === "needs_attention") return "Read the Operations note below and upload a replacement policy copy.";
  if (row.status === "completed") return "The final policy was linked and this intake is closed.";
  if (row.status === "rejected") return "This intake was closed without policy onboarding.";
  return "Track this submission here.";
}

function pendingLabel(row: PartnerPolicyIntake) {
  return row.ocr_status === "failed" ? "Manual review" : row.ocr_status === "completed" ? "Not found" : "Fetching…";
}

export function PartnerPolicyIntakeDetailClient({ intakeId }: { intakeId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const submitted = searchParams.get("submitted") === "1";
  const [row, setRow] = useState<PartnerPolicyIntake | null>(null);
  const [loading, setLoading] = useState(true);
  const [replacing, setReplacing] = useState(false);
  const [progress, setProgress] = useState<IntakeProgress | null>(null);
  const [error, setError] = useState("");
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

  const fields = useMemo(() => new Map((row?.ocr_fields ?? []).map((field) => [field.key, field])), [row?.ocr_fields]);

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

  if (loading) {
    return <div className="border-y border-[#DCE4ED] py-14 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#7E90A8]" /><p className="mt-3 text-[11px] font-semibold text-[#526680]">Loading Policy Intake…</p></div>;
  }

  if (!row) {
    return (
      <div className="space-y-7">
        <button type="button" onClick={() => router.back()} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653]"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
        <div className="border-y border-[#DCE4ED] py-14 text-center">
          <AlertCircle className="mx-auto h-7 w-7 text-[#A66A18]" />
          <p className="mt-3 text-[12px] font-bold text-[#23395D]">Policy Intake unavailable</p>
          <p className="mt-1 text-[10.5px] text-[#7A899F]">{error || "This submission is not available in your Partner account."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => router.back()} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653]"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
        <button type="button" onClick={() => void load(true)} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653]"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
      </div>

      {submitted ? (
        <section className="flex items-start gap-3 rounded-[22px] border border-[#CDE7D7] bg-[#F3FBF6] px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2F7F52]" />
          <div><p className="text-[10.5px] font-extrabold text-[#285E41]">Policy Intake {row.intake_number} submitted</p><p className="mt-0.5 text-[9.5px] font-medium text-[#4F735F]">Received by Operations. Track progress here.</p></div>
        </section>
      ) : null}

      {error ? <section className="rounded-[20px] border border-[#F0D0D0] bg-[#FFF7F7] px-4 py-3 text-[10.5px] font-semibold text-[#9E3939]">{error}</section> : null}

      <section className="py-1">
        <PartnerPageHeader
          eyebrow="Policy Intake"
          title={row.intake_number}
          description={statusHelp(row)}
          action={<span className="inline-flex w-fit rounded-lg bg-[#EEF3F8] px-2.5 py-1.5 text-[9.5px] font-bold text-[#425672]">{statusLabel(row)}</span>}
        />

        <IntakeProgress row={row} />
        <p className="mt-3 text-right text-[9px] font-medium text-[#8190A5]">Updated {dateLabel(row.updated_at)}</p>
      </section>

      {row.final_policy_id ? (
        <Link href={"/partner/policies/" + encodeURIComponent(row.final_policy_id)} className="flex min-h-12 items-center justify-between border-y border-[#DCE4ED] px-1 text-[10.5px] font-extrabold text-[#203653]">
          Open final policy <span aria-hidden="true">→</span>
        </Link>
      ) : null}

      {row.attention_reason ? (
        <section className="rounded-[24px] border border-[#F0D7AE] bg-[#FFF8EC] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#A86809]" />
            <div>
              <p className="text-[11px] font-extrabold text-[#80511A]">Operations needs your response</p>
              <p className="mt-1 text-[10px] font-medium leading-4 text-[#80511A]">{row.attention_reason}</p>
            </div>
          </div>

          <input ref={fileRef} type="file" accept={POLICY_INTAKE_ACCEPT} className="sr-only" onChange={(event) => void replaceDocument(event.target.files?.[0])} />
          {progress ? <UploadProgress progress={progress} /> : null}
          <button
            type="button"
            disabled={replacing}
            onClick={() => fileRef.current?.click()}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#111A35] px-4 text-[10.5px] font-bold text-white disabled:opacity-50"
          >
            {replacing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {replacing ? "Uploading replacement…" : "Upload replacement policy copy"}
          </button>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="py-1">
          <PartnerSectionHeading title="Submission" />
          <div className="mt-4 divide-y divide-[#E8EDF4]">
            <Detail label="Customer mobile" value={row.customer_mobile} />
            <Detail label="Lead source" value={row.lead_source_name} />
            <Detail label="Intermediary" value={row.lead_source_type.toUpperCase() + (row.lead_source_code ? " · " + row.lead_source_code : "")} />
            <Detail label="Policy copy" value={row.file_name} />
            <Detail label="Submitted" value={dateLabel(row.created_at)} />
          </div>
        </section>

        <section className="py-1">
          <PartnerSectionHeading title="Extracted Policy" description={row.ocr_status === "completed" ? "OCR complete" : humanize(row.ocr_status)} />
          <div className="mt-4 divide-y divide-[#E8EDF4]">
            <Detail label="Policy number" value={fields.get("policy_number")?.value || pendingLabel(row)} />
            <Detail label="Insurer" value={fields.get("insurer_name")?.value || pendingLabel(row)} />
            <Detail label="Product" value={fields.get("policy_product")?.value || pendingLabel(row)} />
            <Detail label="Valid from" value={fields.get("policy_start_date")?.value || pendingLabel(row)} />
            <Detail label="Valid upto" value={fields.get("policy_end_date")?.value || pendingLabel(row)} />
          </div>
        </section>
      </div>

      <section className="py-1">
        <PartnerSectionHeading title="Extracted Vehicle" description={fields.get("vehicle_registration_number")?.value || "Pending / not found"} />
        <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Registration" value={fields.get("vehicle_registration_number")?.value || pendingLabel(row)} />
          <Info label="Make" value={fields.get("vehicle_make")?.value || pendingLabel(row)} />
          <Info label="Model" value={fields.get("vehicle_model")?.value || pendingLabel(row)} />
          <Info label="Chassis" value={fields.get("vehicle_chassis_number")?.value || pendingLabel(row)} />
        </div>
      </section>
    </div>
  );
}

function IntakeProgress({ row }: { row: PartnerPolicyIntake }) {
  const manual = row.status === "processing" && row.ocr_status === "failed";
  const activeStep = row.status === "completed" ? 4 : row.status === "in_review" ? 3 : row.status === "ready_for_review" || row.status === "needs_attention" || manual ? 2 : 1;
  const rejected = row.status === "rejected";

  return (
    <div className="mt-6 grid grid-cols-4 gap-0">
      {["Uploaded", "Read", "Review", "Done"].map((label, index) => {
        const step = index + 1;
        const complete = !rejected && step <= activeStep;
        return (
          <div key={label} className="relative flex flex-col items-center">
            <div className="relative flex w-full items-center justify-center">
              <span className={"z-10 h-3 w-3 rounded-full border-2 border-white shadow " + (complete ? "bg-[#3156B8]" : rejected && step === activeStep ? "bg-[#C85353]" : "bg-[#D6DCE6]")} />
              {index < 3 ? <span className={"absolute left-[55%] h-px w-[90%] " + (step < activeStep && !rejected ? "bg-[#8DA9F2]" : "bg-[#DCE1E9]")} /> : null}
            </div>
            <span className={"mt-2 text-[8.5px] font-bold " + (complete ? "text-[#354C70]" : "text-[#9AA6B8]")}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex min-h-11 items-center justify-between gap-4 py-3"><p className="text-[9px] font-black uppercase tracking-[0.08em] text-[#8491A3]">{label}</p><p className="max-w-[65%] text-right text-[10px] font-semibold text-[#203653]">{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[8.5px] font-black uppercase tracking-[0.08em] text-[#8491A3]">{label}</p><p className="mt-1 text-[10px] font-semibold text-[#203653]">{value}</p></div>;
}

function UploadProgress({ progress }: { progress: IntakeProgress }) {
  const percent = progress.stage === "preparing" ? 8 : progress.stage === "submitting" ? 96 : Math.max(12, Math.min(92, progress.percent ?? 12));
  const label = progress.stage === "preparing" ? "Preparing secure upload" : progress.stage === "submitting" ? "Sending to Operations" : "Uploading replacement";
  return <div className="mt-4"><div className="flex justify-between text-[9px] font-semibold text-[#80511A]"><span>{label}</span><span>{Math.round(percent)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F0D7AE]"><div className="h-full rounded-full bg-[#A36A22]" style={{ width: String(percent) + "%" }} /></div></div>;
}
