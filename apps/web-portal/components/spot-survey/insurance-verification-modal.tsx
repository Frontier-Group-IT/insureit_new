"use client";

import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { loadInsuranceVerificationCapacity } from "@/app/claims/[id]/insurance-verification-actions";
import { verifySpotSurveyDocument } from "@/app/claims/[id]/spot-survey-actions";
import type { InsuranceVerificationCapacity } from "@/lib/insurance-verification-capacity";

type Result = { ok: boolean; message?: string };
type Status = "" | "Valid" | "Invalid";
type InsuranceState = { start: string; end: string; ncb: string; policy: string; capacity: string };

export function InsuranceVerificationModalButton({
  claimId,
  documentId,
  incidentDate,
  policyStartDate,
  policyEndDate,
}: {
  claimId: string;
  documentId: string;
  incidentDate?: string | null;
  policyStartDate?: string | null;
  policyEndDate?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [saved, setSaved] = useState(false);
  const [capacity, setCapacity] = useState<InsuranceVerificationCapacity | null>(null);
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [capacityError, setCapacityError] = useState("");
  const policyStart = toDateOnly(policyStartDate) ?? "";
  const policyEnd = toDateOnly(policyEndDate) ?? "";
  const [insurance, setInsurance] = useState<InsuranceState>({
    start: policyStart,
    end: policyEnd,
    ncb: "",
    policy: "",
    capacity: "",
  });
  const incident = toDateOnly(incidentDate);

  useEffect(() => {
    if (!open || capacity) return;
    let active = true;
    setCapacityLoading(true);
    setCapacityError("");
    void loadInsuranceVerificationCapacity(claimId)
      .then((response) => {
        if (!active) return;
        if (response.ok) {
          setCapacity(response.capacity);
          setInsurance((previous) => ({
            ...previous,
            capacity: previous.capacity || response.capacity.value,
          }));
          return;
        }
        setCapacityError(response.message);
      })
      .catch(() => {
        if (active) setCapacityError("Vehicle capacity could not be loaded. Enter the value shown on the insurance copy.");
      })
      .finally(() => {
        if (active) setCapacityLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, claimId, capacity]);

  const insuranceStatus = getStatus(insurance.end, incident);
  const dateOrderInvalid = Boolean(insurance.start && insurance.end && insurance.start > insurance.end);
  const policyDatesAvailable = Boolean(insurance.start && insurance.end);
  const insuranceComplete = Boolean(
    policyDatesAvailable && insurance.ncb && insurance.policy && insurance.capacity.trim(),
  );
  const insuranceValid = Boolean(policyDatesAvailable && !dateOrderInvalid && insuranceStatus === "Valid");
  const canSave = insuranceComplete && insuranceValid;

  const message = useMemo(() => {
    if (!policyDatesAvailable) return "Policy start and end date are not available in customer policy details.";
    if (capacityLoading && !insurance.capacity) return "Loading the selected vehicle class and capacity.";
    if (!insuranceComplete) return "Enter all required insurance details.";
    if (!insuranceValid) return "Insurance date validity is invalid. Verification is blocked.";
    return "Insurance details are valid.";
  }, [policyDatesAvailable, capacityLoading, insurance.capacity, insuranceComplete, insuranceValid]);

  const modal = (
    <div className="fixed inset-0 z-[100] grid min-h-screen place-items-center overflow-y-auto bg-black/55 p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          const formData = new FormData(event.currentTarget);
          const capacityValue = insurance.capacity.trim();
          formData.set("claimId", claimId);
          formData.set("documentId", documentId);
          formData.set("vehicle_capacity_value", capacityValue);
          formData.set("vehicle_capacity_label", capacity?.label ?? "Vehicle Capacity");
          formData.set("vehicle_capacity_unit", capacity?.unit ?? "");
          formData.set("vehicle_capacity_source", capacity?.sourceField ?? "unavailable");
          formData.set("vehicle_class_code", capacity?.vehicleClassCode ?? "");
          formData.set("vehicle_class_description", capacity?.vehicleClassDescription ?? "");
          // Keep the current server-side verification contract intact while new records also carry
          // explicit class-aware capacity metadata. Historical verification logic still expects gvw_kg.
          formData.set("gvw_kg", capacityValue);
          startTransition(async () => {
            const response = await verifySpotSurveyDocument(formData);
            setResult(response);
            if (response.ok) {
              setSaved(true);
              router.refresh();
            }
          });
        }}
        className="w-full max-w-[760px] overflow-hidden rounded-xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
      >
        <div className="flex items-start justify-between border-b border-[#E6EEF7] px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[13px] font-semibold text-[#071D49]">Shield</div>
            <div>
              <h2 className="text-[22px] font-semibold leading-tight text-[#071D49]">Insurance Copy Verification Details</h2>
              <p className="mt-2 max-w-[520px] text-[13px] leading-5 text-[#4B596B]">Please verify the following details from the insurance document.</p>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="text-[34px] leading-none text-[#071D49]">×</button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto">
          <InsuranceRows
            incidentDate={incident}
            values={insurance}
            setValues={setInsurance}
            capacity={capacity}
            capacityLoading={capacityLoading}
            capacityError={capacityError}
          />
          <div className="px-6 pb-4">
            <p className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${canSave ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{message}</p>
            {result ? <p className={`mt-2 rounded-lg border px-3 py-2 text-[12px] font-semibold ${result.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>{result.message ?? "Verification response received."}</p> : null}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#E6EEF7] px-6 py-4">
          <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-md border border-[#B8C5D6] px-7 text-[13px] font-semibold text-[#071D49]">{result?.ok ? "Close" : "Cancel"}</button>
          <button type="submit" disabled={pending || Boolean(result?.ok) || !canSave} className="h-10 rounded-md bg-[#071D49] px-10 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#A9B4C5] disabled:opacity-70">{pending ? "Saving..." : result?.ok ? "Saved" : "Save & Close"}</button>
        </div>
      </form>
    </div>
  );

  return (
    <div>
      <button type="button" onClick={() => { setResult(null); setOpen(true); }} className={`h-8 w-full rounded-md border text-[12px] font-semibold ${saved ? "border-green-300 bg-green-50 text-green-700" : "border-[#16A36A] bg-white text-[#16895C] hover:bg-[#F2FBF7]"}`}>{saved ? "Verified" : "Verify"}</button>
      {open && typeof document !== "undefined" ? createPortal(modal, document.body) : null}
    </div>
  );
}

function InsuranceRows({
  incidentDate,
  values,
  setValues,
  capacity,
  capacityLoading,
  capacityError,
}: {
  incidentDate: string | null;
  values: InsuranceState;
  setValues: (next: InsuranceState | ((previous: InsuranceState) => InsuranceState)) => void;
  capacity: InsuranceVerificationCapacity | null;
  capacityLoading: boolean;
  capacityError: string;
}) {
  const endStatus = getStatus(values.end, incidentDate);
  const dateOrderInvalid = Boolean(values.start && values.end && values.start > values.end);
  const capacityLabel = capacity?.label ?? "Vehicle Capacity";
  const classDisplay = capacity?.vehicleClassDescription
    ? `${capacity.vehicleClassDescription}${capacity.vehicleClassCode ? ` (${capacity.vehicleClassCode})` : ""}`
    : capacity?.vehicleClassCode || "Vehicle class unavailable";

  return (
    <div className="divide-y divide-[#E6EEF7]">
      <div className="grid grid-cols-[52px_1fr_210px_210px] items-center gap-4 px-6 py-4">
        <NumberBadge number={1} />
        <p className="text-[14px] font-semibold text-[#071D49]">Insurance Policy Period</p>
        <ReadonlyDateInput label="Start Date" name="insurance_start_date" value={values.start} invalid={dateOrderInvalid || !values.start} />
        <ReadonlyDateInput label="End Date" name="insurance_end_date" value={values.end} invalid={endStatus === "Invalid" || dateOrderInvalid || !values.end} valid={endStatus === "Valid" && !dateOrderInvalid} />
      </div>
      <input type="hidden" name="policy_status" value={dateOrderInvalid ? "Invalid" : endStatus} />

      <InsuranceRow number={2} label="NCB Verification">
        <select name="ncb_verified" value={values.ncb} onChange={(event) => setValues((previous) => ({ ...previous, ncb: event.target.value }))} className="h-10 w-full rounded-md border border-[#C9D4E3] bg-white px-3 text-[13px] text-[#071D49]">
          <option value="">Select</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </InsuranceRow>

      <InsuranceRow number={3} label="Hazardous or Non Hazardous Policy">
        <select name="policy_type_check" value={values.policy} onChange={(event) => setValues((previous) => ({ ...previous, policy: event.target.value }))} className="h-10 w-full rounded-md border border-[#C9D4E3] px-3 text-[13px]">
          <option value="">Select</option>
          <option>Hazardous</option>
          <option>Non Hazardous</option>
        </select>
      </InsuranceRow>

      <InsuranceRow number={4} label={capacityLabel}>
        <div>
          <div className="relative">
            <input
              name="vehicle_capacity_value"
              type="text"
              inputMode="decimal"
              value={values.capacity}
              onChange={(event) => setInsuranceValue(setValues, event.target.value)}
              placeholder={capacityLoading ? "Loading vehicle capacity..." : "Enter value shown on insurance copy"}
              className={`h-10 w-full rounded-md border border-[#C9D4E3] px-3 text-[13px] ${capacity?.unit ? "pr-20" : "pr-3"}`}
            />
            {capacity?.unit ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#68758A]">{capacity.unit}</span> : null}
          </div>
          <p className="mt-1 text-[10px] font-medium text-[#68758A]">Vehicle class: {classDisplay}. {capacity?.value ? "Prefilled from the vehicle record; adjust only if the insurance copy shows a different value." : "Enter the value shown on the insurance copy."}</p>
          {capacityError ? <p className="mt-1 text-[10px] font-semibold text-amber-700">{capacityError}</p> : null}
        </div>
      </InsuranceRow>

      <div className="px-6 py-3">
        <div className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${endStatus === "Invalid" || dateOrderInvalid ? "border-red-200 bg-red-50 text-red-700" : endStatus === "Valid" ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>Insurance validity status: {dateOrderInvalid ? "Invalid - start date is after end date" : endStatus || "Policy date unavailable"}</div>
      </div>
    </div>
  );
}

function setInsuranceValue(setValues: (next: InsuranceState | ((previous: InsuranceState) => InsuranceState)) => void, value: string) {
  setValues((previous) => ({ ...previous, capacity: value }));
}

function InsuranceRow({ number, label, children }: { number: number; label: string; children: ReactNode }) {
  return <div className="grid grid-cols-[52px_1fr_420px] items-center gap-4 px-6 py-4"><NumberBadge number={number} /><p className="text-[14px] font-semibold text-[#071D49]">{label} <span className="text-red-600">*</span></p>{children}</div>;
}

function ReadonlyDateInput({ label, name, value, invalid = false, valid = false }: { label: string; name: string; value: string; invalid?: boolean; valid?: boolean }) {
  return <label><span className="mb-1 block text-[10px] font-semibold text-[#071D49]">{label} <span className="text-red-600">*</span></span><input type="text" value={formatDisplayDate(value)} readOnly className={`h-10 w-full rounded-md border bg-slate-50 px-3 text-[13px] text-[#071D49] ${invalid ? "border-red-300" : valid ? "border-green-300" : "border-[#C9D4E3]"}`} /><input type="hidden" name={name} value={value} /></label>;
}

function NumberBadge({ number }: { number: number }) {
  return <span className="grid h-8 w-8 place-items-center rounded-md bg-[#EEF4FF] text-[16px] font-semibold text-[#071D49]">{number}</span>;
}

function getStatus(date: string, incidentDate: string | null): Status {
  if (!date || !incidentDate) return "";
  return date < incidentDate ? "Invalid" : "Valid";
}

function toDateOnly(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function formatDisplayDate(value?: string | null) {
  if (!value) return "";
  const isoDate = toDateOnly(value);
  if (!isoDate) return value;
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}
