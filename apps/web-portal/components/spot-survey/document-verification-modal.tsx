"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { verifySpotSurveyDocument } from "@/app/claims/[id]/spot-survey-actions";

type ModalType = "rc" | "insurance";
type Result = { ok: boolean; message?: string };

export function DocumentVerificationModalButton({ claimId, documentId, modalType, incidentDate }: { claimId: string; documentId: string; modalType: ModalType; incidentDate?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [verified, setVerified] = useState(false);
  const incident = dateOnly(incidentDate);

  return (
    <div>
      <button type="button" onClick={() => { setResult(null); setOpen(true); }} className={`h-8 w-full rounded-md border text-[12px] font-semibold ${verified ? "border-green-300 bg-green-50 text-green-700" : "border-[#16A36A] bg-white text-[#16895C] hover:bg-[#F2FBF7]"}`}>{verified ? "Verified" : "Verify"}</button>
      {verified ? <p className="mt-1 text-[10px] font-semibold leading-4 text-green-700">Verified successfully.</p> : null}
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#071D49]/45 px-4">
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
            className="w-full max-w-[780px] rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-[#E6EEF7] px-6 py-4">
              <div>
                <h2 className="text-[20px] font-semibold text-[#071D49]">{modalType === "rc" ? "RC Copy Verification Details" : "Insurance Copy Verification Details"}</h2>
                <p className="mt-1 text-[13px] text-[#4B596B]">Incident date: <span className="font-semibold text-[#071D49]">{incident ?? "Not available"}</span>. Expiry before incident date cannot be verified.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-[28px] leading-none text-[#071D49]">×</button>
            </div>

            <div className="max-h-[68vh] overflow-y-auto px-6 py-5">
              {modalType === "rc" ? <RcFields incidentDate={incident} /> : <InsuranceFields incidentDate={incident} />}
              {result ? <p className={`mt-4 rounded-lg border px-3 py-2 text-[12px] font-semibold ${result.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>{result.message ?? (result.ok ? "Document verified successfully." : "Verification failed")}</p> : null}
            </div>

            <div className="flex items-center justify-between border-t border-[#E6EEF7] px-6 py-4">
              <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg border border-[#B8C5D6] px-7 text-[13px] font-semibold text-[#071D49]">{result?.ok ? "Close" : "Cancel"}</button>
              <button type="submit" disabled={pending || Boolean(result?.ok)} className="h-10 rounded-lg bg-[#071D49] px-8 text-[13px] font-semibold text-white disabled:opacity-60">{pending ? "Saving..." : result?.ok ? "Verified" : "Save & Verify"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function RcFields({ incidentDate }: { incidentDate: string | null }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <DateStatus dateName="fitness_valid_upto" statusName="fitness_status" label="Fitness Valid Upto" incidentDate={incidentDate} />
      <DateStatus dateName="tax_valid_upto" statusName="tax_status" label="Tax Valid Upto" incidentDate={incidentDate} />
      <DateStatus dateName="insurance_valid_upto" statusName="insurance_status" label="Insurance Valid Upto" incidentDate={incidentDate} />
      <DateStatus dateName="pucc_valid_upto" statusName="pucc_status" label="PUCC Valid Upto" incidentDate={incidentDate} />
      <DateStatus dateName="local_permit_valid_upto" statusName="local_permit_status" label="Local Permit Valid Upto" incidentDate={incidentDate} />
      <DateStatus dateName="national_permit_valid_upto" statusName="national_permit_status" label="National Permit Valid Upto" incidentDate={incidentDate} />
      <label className="md:col-span-2 rounded-xl border border-[#DCE7F5] bg-[#FBFCFE] p-3 text-[13px] font-semibold text-[#071D49]">Remarks<textarea name="rc_verification_remarks" className="mt-2 min-h-[70px] w-full rounded-lg border border-[#C9D4E3] px-3 py-2 text-[13px] font-normal" /></label>
    </div>
  );
}

function InsuranceFields({ incidentDate }: { incidentDate: string | null }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Input name="insurance_start_date" type="date" label="Insurance Start Date" />
      <DateStatus dateName="insurance_end_date" statusName="policy_status" label="Insurance End Date" incidentDate={incidentDate} />
      <Input name="ncb_percent" type="number" label="NCB Verification %" />
      <Input name="gvw_kg" type="number" label="GVW Mention in Kgs" />
      <Select name="policy_type_check" label="Policy Type" options={["Hazardous", "Non Hazardous", "Not Mentioned"]} />
      <label className="md:col-span-2 rounded-xl border border-[#DCE7F5] bg-[#FBFCFE] p-3 text-[13px] font-semibold text-[#071D49]">Remarks<textarea name="insurance_verification_remarks" className="mt-2 min-h-[70px] w-full rounded-lg border border-[#C9D4E3] px-3 py-2 text-[13px] font-normal" /></label>
    </div>
  );
}

function DateStatus({ dateName, statusName, label, incidentDate }: { dateName: string; statusName: string; label: string; incidentDate: string | null }) {
  const [date, setDate] = useState("");
  const automaticStatus = date && incidentDate ? (date < incidentDate ? "Invalid" : "Valid") : "";
  const isInvalid = automaticStatus === "Invalid";
  const message = !date ? "Select expiry date to calculate status." : !incidentDate ? "Incident date not available. Status cannot be auto calculated." : isInvalid ? "Cannot verify: expiry date is earlier than incident date." : "Valid: expiry date is on/after incident date.";

  return (
    <div className={`rounded-xl border p-3 ${isInvalid ? "border-red-200 bg-red-50" : automaticStatus === "Valid" ? "border-green-200 bg-green-50" : "border-[#DCE7F5] bg-[#FBFCFE]"}`}>
      <p className="text-[13px] font-semibold text-[#071D49]">{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_135px]">
        <input name={dateName} type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 rounded-lg border border-[#C9D4E3] bg-white px-3 text-[13px]" />
        <input name={statusName} value={automaticStatus || ""} readOnly placeholder="Auto" className={`h-10 rounded-lg border bg-white px-3 text-[13px] font-semibold ${isInvalid ? "border-red-300 text-red-700" : automaticStatus === "Valid" ? "border-green-300 text-green-700" : "border-[#C9D4E3] text-[#071D49]"}`} />
      </div>
      <p className={`mt-2 text-[11px] font-medium ${isInvalid ? "text-red-700" : automaticStatus === "Valid" ? "text-green-700" : "text-[#68758A]"}`}>{message}</p>
    </div>
  );
}

function Input({ name, label, type }: { name: string; label: string; type: string }) {
  return <label className="rounded-xl border border-[#DCE7F5] bg-[#FBFCFE] p-3 text-[13px] font-semibold text-[#071D49]">{label}<input name={name} type={type} className="mt-2 h-10 w-full rounded-lg border border-[#C9D4E3] px-3 text-[13px] font-normal" /></label>;
}

function Select({ name, label, options }: { name: string; label: string; options: string[] }) {
  return <label className="rounded-xl border border-[#DCE7F5] bg-[#FBFCFE] p-3 text-[13px] font-semibold text-[#071D49]">{label}<select name={name} className="mt-2 h-10 w-full rounded-lg border border-[#C9D4E3] px-3 text-[13px] font-normal">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function dateOnly(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}
