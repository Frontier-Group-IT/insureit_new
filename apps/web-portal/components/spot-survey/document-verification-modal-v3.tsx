"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { verifySpotSurveyDocument } from "@/app/claims/[id]/spot-survey-actions";

type ModalType = "rc" | "insurance" | "gr";
type Result = { ok: boolean; message?: string };
type Status = "" | "Valid" | "Invalid";
type InsuranceState = { start: string; end: string; ncb: string; policy: string; gvw: string };
type GrState = { gvw: string; unladen: string; load: string };

const rcRows = [
  { dateName: "fitness_valid_upto", statusName: "fitness_status", label: "Fitness Valid Upto" },
  { dateName: "tax_valid_upto", statusName: "tax_status", label: "Tax Valid Upto" },
  { dateName: "insurance_valid_upto", statusName: "insurance_status", label: "Insurance Valid Upto" },
  { dateName: "pucc_valid_upto", statusName: "pucc_status", label: "PUCC Valid Upto" },
  { dateName: "local_permit_valid_upto", statusName: "local_permit_status", label: "Local Permit Valid Upto" },
  { dateName: "national_permit_valid_upto", statusName: "national_permit_status", label: "National Permit Valid Upto" }
];

export function DocumentVerificationModalButton({ claimId, documentId, modalType, incidentDate, policyStartDate, policyEndDate }: { claimId: string; documentId: string; modalType: ModalType; incidentDate?: string | null; policyStartDate?: string | null; policyEndDate?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [saved, setSaved] = useState(false);
  const [rcDates, setRcDates] = useState<Record<string, string>>({});
  const policyStart = toDateOnly(policyStartDate) ?? "";
  const policyEnd = toDateOnly(policyEndDate) ?? "";
  const [insurance, setInsurance] = useState<InsuranceState>({ start: policyStart, end: policyEnd, ncb: "", policy: "", gvw: "" });
  const [gr, setGr] = useState<GrState>({ gvw: "", unladen: "", load: "" });
  const incident = toDateOnly(incidentDate);

  const rcComplete = rcRows.every((row) => Boolean(rcDates[row.dateName]));
  const rcValid = rcRows.every((row) => getStatus(rcDates[row.dateName], incident) === "Valid");
  const insuranceStatus = getStatus(insurance.end, incident);
  const dateOrderInvalid = Boolean(insurance.start && insurance.end && insurance.start > insurance.end);
  const policyDatesAvailable = Boolean(insurance.start && insurance.end);
  const insuranceComplete = Boolean(policyDatesAvailable && insurance.ncb && insurance.policy && insurance.gvw);
  const insuranceValid = Boolean(policyDatesAvailable && !dateOrderInvalid && insuranceStatus === "Valid");
  const grValues = getGrValues(gr);
  const grComplete = Boolean(gr.gvw && gr.unladen && gr.load);
  const grValid = grComplete && grValues.gvw > 0 && grValues.unladen >= 0 && grValues.load >= 0 && grValues.difference >= 0;
  const canSave = modalType === "rc" ? rcComplete && rcValid : modalType === "insurance" ? insuranceComplete && insuranceValid : grValid;

  const message = useMemo(() => {
    if (modalType === "rc") {
      if (!rcComplete) return "Enter all six RC expiry dates.";
      if (!rcValid) return "One or more RC fields are invalid. Verification is blocked.";
      return "All RC fields are valid.";
    }
    if (modalType === "insurance") {
      if (!policyDatesAvailable) return "Policy start and end date are not available in customer policy details.";
      if (!insuranceComplete) return "Enter all required insurance details.";
      if (!insuranceValid) return "Insurance date validity is invalid. Verification is blocked.";
      return "Insurance details are valid.";
    }
    if (!grComplete) return "Enter GVW, unladen weight and load weight.";
    if (!grValid) return "Load calculation is invalid. Load difference cannot be negative.";
    return `Calculation: (${grValues.gvw} - ${grValues.unladen}) - ${grValues.load} = ${grValues.difference} kg`;
  }, [modalType, rcComplete, rcValid, policyDatesAvailable, insuranceComplete, insuranceValid, grComplete, grValid, grValues.gvw, grValues.unladen, grValues.load, grValues.difference]);

  return (
    <div>
      <button type="button" onClick={() => { setResult(null); setOpen(true); }} className={`h-8 w-full rounded-md border text-[12px] font-semibold ${saved ? "border-green-300 bg-green-50 text-green-700" : "border-[#16A36A] bg-white text-[#16895C] hover:bg-[#F2FBF7]"}`}>{saved ? "Verified" : "Verify"}</button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4">
          <form action={(formData) => { if (!canSave) return; if (modalType === "gr") { formData.set("load_difference_kg", String(grValues.difference)); formData.set("gr_calculation", `(${grValues.gvw} - ${grValues.unladen}) - ${grValues.load} = ${grValues.difference} kg`); } startTransition(async () => { formData.set("claimId", claimId); formData.set("documentId", documentId); const response = await verifySpotSurveyDocument(formData); setResult(response); if (response.ok) { setSaved(true); router.refresh(); } }); }} className={`w-full overflow-hidden rounded-xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] ${modalType === "gr" ? "max-w-[560px]" : "max-w-[760px]"}`}>
            <ModalHeader modalType={modalType} onClose={() => setOpen(false)} />
            <div className="max-h-[68vh] overflow-y-auto">
              {modalType === "rc" ? <RcRows incidentDate={incident} values={rcDates} onChange={(key, value) => setRcDates((prev) => ({ ...prev, [key]: value }))} /> : null}
              {modalType === "insurance" ? <InsuranceRows incidentDate={incident} values={insurance} setValues={setInsurance} /> : null}
              {modalType === "gr" ? <GrRows values={gr} setValues={setGr} /> : null}
              <div className="px-6 pb-4"><p className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${canSave ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{message}</p>{result ? <p className={`mt-2 rounded-lg border px-3 py-2 text-[12px] font-semibold ${result.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>{result.message ?? "Verification response received."}</p> : null}</div>
            </div>
            <div className="flex items-center justify-between border-t border-[#E6EEF7] px-6 py-4"><button type="button" onClick={() => setOpen(false)} className="h-10 rounded-md border border-[#B8C5D6] px-7 text-[13px] font-semibold text-[#071D49]">{result?.ok ? "Close" : "Cancel"}</button><button type="submit" disabled={pending || Boolean(result?.ok) || !canSave} className="h-10 rounded-md bg-[#071D49] px-10 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#A9B4C5] disabled:opacity-70">{pending ? "Saving..." : result?.ok ? "Saved" : "Save & Close"}</button></div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function ModalHeader({ modalType, onClose }: { modalType: ModalType; onClose: () => void }) {
  const title = modalType === "rc" ? "RC Copy Verification Details" : modalType === "insurance" ? "Insurance Copy Verification Details" : "GR / Load Challan Verification";
  const subtitle = modalType === "rc" ? "Please verify the validity of the following details from RC." : modalType === "insurance" ? "Please verify the following details from the insurance document." : "Please verify the details from GR / Load Challan.";
  const icon = modalType === "rc" ? "PDF" : modalType === "insurance" ? "Shield" : "Truck";
  return <div className="flex items-start justify-between border-b border-[#E6EEF7] px-6 py-5"><div className="flex items-start gap-4"><div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[14px] font-semibold text-[#071D49]">{icon}</div><div><h2 className="text-[22px] font-semibold leading-tight text-[#071D49]">{title}</h2><p className="mt-2 max-w-[520px] text-[13px] leading-5 text-[#4B596B]">{subtitle}</p></div></div><button type="button" onClick={onClose} className="text-[34px] leading-none text-[#071D49]">×</button></div>;
}

function RcRows({ incidentDate, values, onChange }: { incidentDate: string | null; values: Record<string, string>; onChange: (key: string, value: string) => void }) { return <div className="divide-y divide-[#E6EEF7]">{rcRows.map((row, index) => <DateRow key={row.dateName} number={index + 1} label={row.label} dateName={row.dateName} statusName={row.statusName} value={values[row.dateName] ?? ""} incidentDate={incidentDate} onChange={(value) => onChange(row.dateName, value)} />)}</div>; }
function DateRow({ number, label, dateName, statusName, value, incidentDate, onChange }: { number: number; label: string; dateName: string; statusName: string; value: string; incidentDate: string | null; onChange: (value: string) => void }) { const status = getStatus(value, incidentDate); return <div className={`grid grid-cols-[52px_1fr_170px_170px] items-center gap-4 px-6 py-4 ${status === "Invalid" ? "bg-red-50/25" : ""}`}><NumberBadge number={number} /><p className="text-[14px] font-semibold text-[#071D49]">{label}</p><label><span className="mb-1 block text-[10px] font-semibold text-[#071D49]">Valid Upto</span><input name={dateName} type="date" value={value} onChange={(event) => onChange(event.target.value)} className={`h-10 w-full rounded-md border bg-white px-3 text-[13px] text-[#071D49] ${status === "Invalid" ? "border-red-300" : status === "Valid" ? "border-green-300" : "border-[#C9D4E3]"}`} /></label><div><span className="mb-1 block text-[10px] font-semibold text-[#071D49]">Status</span><StatusBox status={status} /><input type="hidden" name={statusName} value={status} /></div></div>; }

function InsuranceRows({ incidentDate, values, setValues }: { incidentDate: string | null; values: InsuranceState; setValues: (next: InsuranceState | ((prev: InsuranceState) => InsuranceState)) => void }) {
  const endStatus = getStatus(values.end, incidentDate); const dateOrderInvalid = Boolean(values.start && values.end && values.start > values.end);
  return <div className="divide-y divide-[#E6EEF7]"><div className="grid grid-cols-[52px_1fr_210px_210px] items-center gap-4 px-6 py-4"><NumberBadge number={1} /><p className="text-[14px] font-semibold text-[#071D49]">Insurance Policy Period</p><ReadonlyDateInput label="Start Date" name="insurance_start_date" value={values.start} invalid={dateOrderInvalid || !values.start} /><ReadonlyDateInput label="End Date" name="insurance_end_date" value={values.end} invalid={endStatus === "Invalid" || dateOrderInvalid || !values.end} valid={endStatus === "Valid" && !dateOrderInvalid} /></div><input type="hidden" name="policy_status" value={dateOrderInvalid ? "Invalid" : endStatus} /><InsuranceRow number={2} label="NCB Verification"><select name="ncb_verified" value={values.ncb} onChange={(event) => setValues((prev) => ({ ...prev, ncb: event.target.value }))} className="h-10 w-full rounded-md border border-[#C9D4E3] bg-white px-3 text-[13px] text-[#071D49]"><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option></select></InsuranceRow><InsuranceRow number={3} label="Hazardous or Non Hazardous Policy"><select name="policy_type_check" value={values.policy} onChange={(event) => setValues((prev) => ({ ...prev, policy: event.target.value }))} className="h-10 w-full rounded-md border border-[#C9D4E3] px-3 text-[13px]"><option value="">Select</option><option>Hazardous</option><option>Non Hazardous</option><option>Not Mentioned</option></select></InsuranceRow><InsuranceRow number={4} label="GVW Mention (in Kgs)"><div className="relative"><input name="gvw_kg" type="number" value={values.gvw} onChange={(event) => setValues((prev) => ({ ...prev, gvw: event.target.value }))} placeholder="Enter GVW" className="h-10 w-full rounded-md border border-[#C9D4E3] px-3 pr-12 text-[13px]" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#68758A]">Kgs</span></div></InsuranceRow><div className="px-6 py-3"><div className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${endStatus === "Invalid" || dateOrderInvalid ? "border-red-200 bg-red-50 text-red-700" : endStatus === "Valid" ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>Insurance validity status: {dateOrderInvalid ? "Invalid - start date is after end date" : endStatus || "Policy date unavailable"}</div></div></div>;
}

function GrRows({ values, setValues }: { values: GrState; setValues: (next: GrState | ((prev: GrState) => GrState)) => void }) { const numbers = getGrValues(values); return <div className="divide-y divide-[#E6EEF7] px-6 py-3"><GrInputRow number={1} label="GVW Mention (kg)" name="gr_gvw_kg" value={values.gvw} onChange={(value) => setValues((prev) => ({ ...prev, gvw: value }))} /><GrInputRow number={2} label="Unladen Weight (kg)" name="unladen_weight_kg" value={values.unladen} onChange={(value) => setValues((prev) => ({ ...prev, unladen: value }))} /><GrInputRow number={3} label="Load Weight (kg)" name="load_weight_kg" value={values.load} onChange={(value) => setValues((prev) => ({ ...prev, load: value }))} /><GrInputRow number={4} label="Load Difference (kg)" name="load_difference_kg" value={String(numbers.difference)} readOnly muted help="GVW minus unladen weight minus load weight" /><input type="hidden" name="gr_calculation" value={`(${numbers.gvw} - ${numbers.unladen}) - ${numbers.load} = ${numbers.difference} kg`} /></div>; }
function GrInputRow({ number, label, name, value, onChange, readOnly = false, muted = false, help }: { number: number; label: string; name: string; value: string; onChange?: (value: string) => void; readOnly?: boolean; muted?: boolean; help?: string }) { return <div className="grid grid-cols-[36px_1fr_150px_28px] items-center gap-3 py-3"><p className="text-[12px] font-semibold text-[#071D49]">{number}.</p><div><p className="text-[13px] font-semibold text-[#071D49]">{label}</p>{help ? <p className="mt-0.5 text-[9px] font-medium text-[#6B778C]">{help}</p> : null}</div><div className="relative"><input name={name} type="number" value={value} readOnly={readOnly} onChange={(event) => onChange?.(event.target.value)} className={`h-9 w-full rounded-md border border-[#C9D4E3] px-3 pr-9 text-[12px] font-semibold text-[#071D49] ${muted ? "bg-[#E8EDF5]" : "bg-white"}`} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#68758A]">kg</span></div><span className="text-[18px] text-green-600">✓</span></div>; }

function InsuranceRow({ number, label, children }: { number: number; label: string; children: React.ReactNode }) { return <div className="grid grid-cols-[52px_1fr_420px] items-center gap-4 px-6 py-4"><NumberBadge number={number} /><p className="text-[14px] font-semibold text-[#071D49]">{label} <span className="text-red-600">*</span></p>{children}</div>; }
function ReadonlyDateInput({ label, name, value, invalid = false, valid = false }: { label: string; name: string; value: string; invalid?: boolean; valid?: boolean }) { return <label><span className="mb-1 block text-[10px] font-semibold text-[#071D49]">{label} <span className="text-red-600">*</span></span><input name={name} type="date" value={value} readOnly disabled className={`h-10 w-full rounded-md border bg-slate-50 px-3 text-[13px] text-[#071D49] ${invalid ? "border-red-300" : valid ? "border-green-300" : "border-[#C9D4E3]"}`} /><input type="hidden" name={name} value={value} /></label>; }
function StatusBox({ status }: { status: Status }) { const tone = status === "Invalid" ? "border-red-200 text-red-600" : status === "Valid" ? "border-green-200 text-green-700" : "border-[#C9D4E3] text-[#8B98A9]"; return <div className={`flex h-10 items-center gap-2 rounded-md border bg-white px-3 text-[13px] font-semibold ${tone}`}><span>{status === "Invalid" ? "!" : status === "Valid" ? "OK" : "-"}</span><span className="flex-1">{status || "Auto"}</span><span className="text-[#68758A]">⌄</span></div>; }
function NumberBadge({ number }: { number: number }) { return <span className="grid h-8 w-8 place-items-center rounded-md bg-[#EEF4FF] text-[16px] font-semibold text-[#071D49]">{number}</span>; }
function getStatus(date: string, incidentDate: string | null): Status { if (!date || !incidentDate) return ""; return date < incidentDate ? "Invalid" : "Valid"; }
function toDateOnly(value?: string | null) { if (!value) return null; const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) return null; return parsed.toISOString().slice(0, 10); }
function toNumber(value: string) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function getGrValues(values: GrState) { const gvw = toNumber(values.gvw); const unladen = toNumber(values.unladen); const load = toNumber(values.load); return { gvw, unladen, load, difference: gvw - unladen - load }; }
