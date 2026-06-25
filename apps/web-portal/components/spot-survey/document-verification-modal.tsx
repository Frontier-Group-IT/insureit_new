"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { verifySpotSurveyDocument } from "@/app/claims/[id]/spot-survey-actions";

type ModalType = "rc" | "insurance";

type Result = { ok: boolean; message?: string };

export function DocumentVerificationModalButton({ claimId, documentId, modalType }: { claimId: string; documentId: string; modalType: ModalType }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="h-8 w-full rounded-md border border-[#16A36A] bg-white text-[12px] font-semibold text-[#16895C] hover:bg-[#F2FBF7]">Verify</button>
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
                  setOpen(false);
                  router.refresh();
                }
              });
            }}
            className="w-full max-w-[760px] rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-[#E6EEF7] px-6 py-4">
              <div>
                <h2 className="text-[20px] font-semibold text-[#071D49]">{modalType === "rc" ? "RC Copy Verification Details" : "Insurance Copy Verification Details"}</h2>
                <p className="mt-1 text-[13px] text-[#4B596B]">Fill verification details before marking this document verified.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-[28px] leading-none text-[#071D49]">×</button>
            </div>

            <div className="max-h-[68vh] overflow-y-auto px-6 py-5">
              {modalType === "rc" ? <RcFields /> : <InsuranceFields />}
              {result && !result.ok ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{result.message ?? "Verification failed"}</p> : null}
            </div>

            <div className="flex items-center justify-between border-t border-[#E6EEF7] px-6 py-4">
              <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg border border-[#B8C5D6] px-7 text-[13px] font-semibold text-[#071D49]">Cancel</button>
              <button type="submit" disabled={pending} className="h-10 rounded-lg bg-[#071D49] px-8 text-[13px] font-semibold text-white disabled:opacity-60">{pending ? "Saving..." : "Save & Verify"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function RcFields() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <DateStatus dateName="fitness_valid_upto" statusName="fitness_status" label="Fitness Valid Upto" />
      <DateStatus dateName="tax_valid_upto" statusName="tax_status" label="Tax Valid Upto" />
      <DateStatus dateName="insurance_valid_upto" statusName="insurance_status" label="Insurance Valid Upto" />
      <DateStatus dateName="pucc_valid_upto" statusName="pucc_status" label="PUCC Valid Upto" />
      <DateStatus dateName="local_permit_valid_upto" statusName="local_permit_status" label="Local Permit Valid Upto" />
      <DateStatus dateName="national_permit_valid_upto" statusName="national_permit_status" label="National Permit Valid Upto" />
      <label className="md:col-span-2 rounded-xl border border-[#DCE7F5] bg-[#FBFCFE] p-3 text-[13px] font-semibold text-[#071D49]">Remarks<textarea name="rc_verification_remarks" className="mt-2 min-h-[70px] w-full rounded-lg border border-[#C9D4E3] px-3 py-2 text-[13px] font-normal" /></label>
    </div>
  );
}

function InsuranceFields() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Input name="insurance_start_date" type="date" label="Insurance Start Date" />
      <Input name="insurance_end_date" type="date" label="Insurance End Date" />
      <Input name="ncb_percent" type="number" label="NCB Verification %" />
      <Input name="gvw_kg" type="number" label="GVW Mention in Kgs" />
      <Select name="policy_type_check" label="Policy Type" options={["Hazardous", "Non Hazardous", "Not Mentioned"]} />
      <Select name="policy_status" label="Policy Status" options={["Valid", "Expired", "Not Available", "Not Applicable"]} />
      <label className="md:col-span-2 rounded-xl border border-[#DCE7F5] bg-[#FBFCFE] p-3 text-[13px] font-semibold text-[#071D49]">Remarks<textarea name="insurance_verification_remarks" className="mt-2 min-h-[70px] w-full rounded-lg border border-[#C9D4E3] px-3 py-2 text-[13px] font-normal" /></label>
    </div>
  );
}

function DateStatus({ dateName, statusName, label }: { dateName: string; statusName: string; label: string }) {
  return (
    <div className="rounded-xl border border-[#DCE7F5] bg-[#FBFCFE] p-3">
      <p className="text-[13px] font-semibold text-[#071D49]">{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_135px]">
        <input name={dateName} type="date" className="h-10 rounded-lg border border-[#C9D4E3] px-3 text-[13px]" />
        <select name={statusName} defaultValue="Valid" className="h-10 rounded-lg border border-[#C9D4E3] px-3 text-[13px]">
          <option>Valid</option><option>Expired</option><option>Not Available</option><option>Not Applicable</option>
        </select>
      </div>
    </div>
  );
}

function Input({ name, label, type }: { name: string; label: string; type: string }) {
  return <label className="rounded-xl border border-[#DCE7F5] bg-[#FBFCFE] p-3 text-[13px] font-semibold text-[#071D49]">{label}<input name={name} type={type} className="mt-2 h-10 w-full rounded-lg border border-[#C9D4E3] px-3 text-[13px] font-normal" /></label>;
}

function Select({ name, label, options }: { name: string; label: string; options: string[] }) {
  return <label className="rounded-xl border border-[#DCE7F5] bg-[#FBFCFE] p-3 text-[13px] font-semibold text-[#071D49]">{label}<select name={name} className="mt-2 h-10 w-full rounded-lg border border-[#C9D4E3] px-3 text-[13px] font-normal">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
