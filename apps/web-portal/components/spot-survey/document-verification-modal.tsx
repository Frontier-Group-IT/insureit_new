"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { verifySpotSurveyDocument } from "@/app/claims/[id]/spot-survey-actions";

type ModalType = "rc" | "insurance";
type Result = { ok: boolean; message?: string };

export function DocumentVerificationModalButton({ claimId, documentId, modalType, incidentDate }: { claimId: string; documentId: string; modalType: ModalType; incidentDate?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [verified, setVerified] = useState(false);
  // Only a server-confirmed successful verification closes the dialog.
  // Cleanup prevents a stale timeout from closing a reopened dialog.
  useEffect(() => {
    if (!open || !result?.ok) return;
    const timeout = window.setTimeout(() => setOpen(false), 1000);
    return () => window.clearTimeout(timeout);
  }, [open, result?.ok]);

  const incident = dateOnly(incidentDate);

  return (
    <div>
      <button type="button" onClick={() => { setResult(null); setOpen(true); }} className={`h-8 w-full rounded-md border text-[12px] font-semibold ${verified ? "border-green-300 bg-green-50 text-green-700" : "border-[#16A36A] bg-white text-[#16895C] hover:bg-[#F2FBF7]"}`}>{verified ? "Verified" : "Verify"}</button>
      {verified ? <p className="mt-1 text-[10px] font-semibold leading-4 text-green-700">Verified successfully.</p> : null}
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4">
          <form
            action={(formData) => {
              startTransition(async () => {
                formData.set("claimId", claimId);
                formData.set("documentId", documentId);
                const response = await verifySpotSurveyDocument(formData);
                setResult(response);
                if (response.ok) {
                  setVerified(true);
                  router.refresh();
                }
              });
            }}
            className="w-full max-w-[760px] overflow-hidden rounded-xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
          >
            <div className="flex items-start justify-between border-b border-[#E6EEF7] px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[32px]">{modalType === "rc" ? "📄" : "🛡️"}</div>
                <div>
                  <h2 className="text-[22px] font-semibold leading-tight text-[#071D49]">{modalType === "rc" ? "RC Copy Verification Details" : "Insurance Copy Verification Details"}</h2>
                  <p className="mt-2 max-w-[520px] text-[13px] leading-5 text-[#4B596B]">Please verify the validity of the following details from {modalType === "rc" ? "RC" : "Insurance Copy"}. Select date and status for each item.</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-[34px] leading-none text-[#071D49]">×</button>
            </div>

            <div className="max-h-[68vh] overflow-y-auto">
              {modalType === "rc" ? <RcFields incidentDate={incident} /> : <InsuranceFields incidentDate={incident} />}
              {result ? <div className="px-6 pb-4"><p className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${result.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>{result.message ?? (result.ok ? "Document verified successfully." : "Verification failed")}</p></div> : null}
            </div>

            <div className="flex items-center justify-between border-t border-[#E6EEF7] px-6 py-4">
              <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-md border border-[#B8C5D6] px-7 text-[13px] font-semibold text-[#071D49]">{result?.ok ? "Close" : "Cancel"}</button>
              <button type="submit" disabled={pending || Boolean(result?.ok)} className="h-10 rounded-md bg-[#071D49] px-10 text-[13px] font-semibold text-white disabled:opacity-60">{pending ? "Saving..." : result?.ok ? "Saved" : "Save & Close"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function RcFields({ incidentDate }: { incidentDate: string | null }) {
  const rows = [
    ["fitness_valid_upto", "fitness_status", "Fitness Valid Upto"],
    ["tax_valid_upto", "tax_status", "Tax Valid Upto"],
    ["insurance_valid_upto", "insurance_status", "Insurance Valid Upto"],
    ["pucc_valid_upto", "pucc_status", "PUCC Valid Upto"],
    ["local_permit_valid_upto", "local_permit_status", "Local Permit Valid Upto"],
    ["national_permit_valid_upto", "national_permit_status", "National Permit Valid Upto"]
  ] as const;
  return <div className="divide-y divide-[#E6EEF7]">{rows.map(([dateName, statusName, label], index) => <DateStatus key={dateName} number={index + 1} dateName={dateName} statusName={statusName} label={label} incidentDate={incidentDate} />)}</div>;
}

function InsuranceFields({ incidentDate }: { incidentDate: string | null }) {
  return (
    <div className="space-y-3 px-6 py-5">
      <div className="grid gap-3 md:grid-cols-2">
        <Input name="insurance_start_date" type="date" label="Insurance Start Date" />
        <DateStatus number={1} dateName="insurance_end_date" statusName="policy_status" label="Insurance End Date" incidentDate={incidentDate} compact />
        <Input name="ncb_percent" type="number" label="NCB Verification %" />
        <Input name="gvw_kg" type="number" label="GVW Mention in Kgs" />
        <Select name="policy_type_check" label="Policy Type" options={["Hazardous", "Non Hazardous", "Not Mentioned"]} />
      </div>
      <label className="block rounded-lg border border-[#DCE7F5] bg-[#FBFCFE] p-3 text-[13px] font-semibold text-[#071D49]">Remarks<textarea name="insurance_verification_remarks" className="mt-2 min-h-[70px] w-full rounded-md border border-[#C9D4E3] px-3 py-2 text-[13px] font-normal" /></label>
    </div>
  );
}

function DateStatus({ number, dateName, statusName, label, incidentDate, compact = false }: { number: number; dateName: string; statusName: string; label: string; incidentDate: string | null; compact?: boolean }) {
  const [date, setDate] = useState("");
  const automaticStatus = date && incidentDate ? (date < incidentDate ? "Expired" : "Valid") : "";
  const isInvalid = automaticStatus === "Expired";

  return (
    <div className={`${compact ? "rounded-lg border border-[#DCE7F5] bg-[#FBFCFE] p-3" : "grid grid-cols-[52px_1fr_170px_170px] items-center gap-4 px-6 py-4"} ${isInvalid && !compact ? "bg-red-50/25" : ""}`}>
      {!compact ? <span className="grid h-8 w-8 place-items-center rounded-md bg-[#EEF4FF] text-[16px] font-semibold text-[#071D49]">{number}</span> : null}
      <p className="text-[14px] font-semibold text-[#071D49]">{label}</p>
      <label className="block">
        <span className="mb-1 block text-[10px] font-semibold text-[#071D49]">Valid Upto</span>
        <input name={dateName} type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 w-full rounded-md border border-[#C9D4E3] bg-white px-3 text-[13px] text-[#071D49]" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] font-semibold text-[#071D49]">Status</span>
        <div className={`flex h-10 items-center gap-2 rounded-md border bg-white px-3 text-[13px] font-semibold ${isInvalid ? "border-red-200 text-red-600" : automaticStatus === "Valid" ? "border-green-200 text-green-700" : "border-[#C9D4E3] text-[#8B98A9]"}`}>
          <span>{isInvalid ? "🚩" : automaticStatus === "Valid" ? "🏳️" : "—"}</span>
          <input name={statusName} value={automaticStatus} readOnly placeholder="Auto" className="min-w-0 flex-1 bg-transparent outline-none" />
          <span className="text-[#68758A]">⌄</span>
        </div>
      </label>
    </div>
  );
}

function Input({ name, label, type }: { name: string; label: string; type: string }) {
  return <label className="rounded-lg border border-[#DCE7F5] bg-[#FBFCFE] p-3 text-[13px] font-semibold text-[#071D49]">{label}<input name={name} type={type} className="mt-2 h-10 w-full rounded-md border border-[#C9D4E3] px-3 text-[13px] font-normal" /></label>;
}

function Select({ name, label, options }: { name: string; label: string; options: string[] }) {
  return <label className="rounded-lg border border-[#DCE7F5] bg-[#FBFCFE] p-3 text-[13px] font-semibold text-[#071D49]">{label}<select name={name} className="mt-2 h-10 w-full rounded-md border border-[#C9D4E3] px-3 text-[13px] font-normal">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function dateOnly(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}
