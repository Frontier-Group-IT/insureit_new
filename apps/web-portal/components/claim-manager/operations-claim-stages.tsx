"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { advanceClaimWorkflow, saveSpotIntimationDetails } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { managerTransitions, type ClaimStatus } from "@/lib/claim-workflow";
import type { InternalSpotIntimationDetails } from "@/lib/internal-spot-intimation";

type StageDetail = { stage?: string | null; details: Record<string, unknown> | null; created_at: string };

type Props = {
  claimId: string;
  currentStatus: ClaimStatus;
  insurerClaimNo?: string | null;
  details: StageDetail[];
  spotContent: ReactNode;
  claimIntimationContent: ReactNode;
  initialStageKey?: string;
  accidentAt?: string | null;
  spotIntimationAt?: string | null;
  spotDetails?: InternalSpotIntimationDetails | null;
};

const stages = [
  { key: "spot_intimation", label: "Spot Intimation", statuses: ["Draft", "Accident Reported", "Initial Documents Pending", "Initial Documents Verification Pending", "Initial Documents Submitted", "Initial Documents Verified", "Documents Pending", "Documents Submitted"] },
  { key: "spot_status", label: "Spot Status", statuses: ["Initial Documents Verified", "Claim Intimated", "Surveyor Appointed", "Vehicle Inspected", "Spot Survey Completed"] },
  { key: "claim_intimation", label: "Claim Intimation", statuses: ["Final Documents Awaited", "Final Documents Verification Pending", "Final Documents Submitted", "Final Documents Verified", "Claim Intimation"] },
  { key: "work_approval", label: "Work Approval", statuses: ["Estimate Submitted", "Approval Pending", "Work Approval Status", "Work Approval Received"] },
  { key: "repair_ri", label: "Repair & RI", statuses: ["Final Surveyor Details", "Survey Status", "Survey Done", "Under Repair", "Repair Started", "Repair Done", "Repair Completed", "RA Intimation", "RA Intimation Done"] },
  { key: "billing", label: "Billing", statuses: ["Final Bill Submitted"] },
  { key: "delivery_order", label: "Delivery Order", statuses: ["DO Status", "DO Submitted"] },
  { key: "vehicle_delivery", label: "Vehicle Delivery", statuses: ["Claim Complete"] },
  { key: "payment_encashment", label: "Payment Encashment", statuses: ["Payment Stage", "Claim Completion In Progress", "Settlement Under Process", "Settled", "Closed"] }
] as const;

const fields: StageFields = {
  spot_intimation: [
    { name: "incident_at", label: "Accident date and time", type: "datetime-local" },
    { name: "spot_intimation_at", label: "Spot Intimation date and time", type: "datetime-local" },
    { name: "driver_name", label: "Driver name" }, { name: "driver_phone", label: "Driver number", type: "tel" },
    { name: "location", label: "Location" }
  ],
  spot_status: [
    { name: "surveyor_name", label: "Surveyor name" }, { name: "surveyor_phone", label: "Surveyor mobile" },
    { name: "survey_status", label: "Survey status" }, { name: "inspection_date", label: "Inspection date", type: "date" }
  ],
  claim_intimation: [
    { name: "insurer_claim_no", label: "Insurer claim number" },
    { name: "dealership_name", label: "Dealership" }, { name: "dealership_location", label: "Dealership location" },
    { name: "contact_person_name", label: "Contact person" }, { name: "contact_number", label: "Contact number" },
    { name: "claim_intimation_date", label: "Claim intimation date", type: "date" }, { name: "gate_in_date", label: "Gate-in date", type: "date" },
    { name: "estimate_amount", label: "Estimate amount", type: "number" }
  ],
  work_approval: [
    { name: "approval_received_date", label: "Approval received date", type: "date" },
    { name: "cashless", label: "Cashless claim", type: "select" },
    { name: "approval_status", label: "Approval status" }, { name: "approved_amount", label: "Approved amount", type: "number" },
    { name: "surveyor_name", label: "Surveyor name" }, { name: "surveyor_phone", label: "Surveyor phone" }, { name: "surveyor_email", label: "Surveyor email" }
  ],
  repair_ri: [
    { name: "repair_status", label: "Repair status" }, { name: "repair_started_date", label: "Repair start date", type: "date" },
    { name: "repair_complete_date", label: "Repair complete date", type: "date" }, { name: "ri_required", label: "Re-inspection required", type: "select" }, { name: "ri_status", label: "Re-inspection status" },
    { name: "ri_requested_date", label: "RI requested date", type: "date" }, { name: "ri_done_date", label: "RI done date", type: "date" }
  ],
  billing: [{ name: "bill_date", label: "Final bill date", type: "date" }, { name: "bill_amount", label: "Final bill amount", type: "number" }, { name: "assessment_received", label: "Assessment received", type: "select" }],
  delivery_order: [{ name: "do_status", label: "Delivery order status" }, { name: "assessment_received", label: "Assessment received", type: "select" }, { name: "do_date", label: "DO date", type: "date" }, { name: "do_amount", label: "DO amount", type: "number" }],
  vehicle_delivery: [{ name: "vehicle_received", label: "Vehicle received", type: "select" }, { name: "vehicle_received_date", label: "Vehicle received date", type: "date" }, { name: "satisfaction_submitted", label: "Satisfaction voucher submitted", type: "select" }],
  payment_encashment: [
    { name: "depreciation_submitted", label: "Depreciation slip submitted", type: "select" }, { name: "satisfaction_submitted", label: "Satisfaction voucher submitted", type: "select" },
    { name: "documents_submit_date", label: "Documents submitted date", type: "date" }, { name: "payment_status", label: "Payment status" },
    { name: "payment_received_date", label: "Payment received date", type: "date" }, { name: "payment_received_amount", label: "Payment received amount", type: "number" }
  ]
};

const requiredFields: Record<string, string[]> = {
  spot_intimation: ["incident_at", "spot_intimation_at"],
  claim_intimation: ["insurer_claim_no", "dealership_name", "dealership_location", "claim_intimation_date", "gate_in_date", "estimate_amount"],
  work_approval: ["approval_received_date", "cashless"],
  repair_ri: ["repair_complete_date", "ri_done_date"],
  billing: ["bill_date", "bill_amount"],
  delivery_order: ["assessment_received", "do_date", "do_amount"],
  vehicle_delivery: ["vehicle_received"],
  payment_encashment: ["depreciation_submitted", "satisfaction_submitted", "payment_received_date", "payment_received_amount"]
};

export function OperationsClaimStages({ claimId, currentStatus, insurerClaimNo, details, spotContent, claimIntimationContent, initialStageKey, accidentAt, spotIntimationAt, spotDetails }: Props) {
  const router = useRouter();
  const active = stages.find((stage) => (stage.statuses as readonly string[]).includes(currentStatus));
  const activeIndex = active ? stages.findIndex((stage) => stage.key === active.key) : 0;
  const [selectedKey, setSelectedKey] = useState(() => stages.some((stage) => stage.key === initialStageKey) ? initialStageKey! : active?.key ?? stages[0].key);
  const selected = stages.find((stage) => stage.key === selectedKey) ?? stages[0];
  const selectedIndex = stages.findIndex((stage) => stage.key === selected.key);
  const detail = [...details].find((row) => row.details?.milestone_key === selected.key || (selected.statuses as readonly string[]).includes(row.stage ?? ""));
  const spotDetail = [...details].find((row) => row.details?.milestone_key === "spot_intimation" || typeof row.details?.incident_at === "string" || typeof row.details?.accident_at === "string" || typeof row.details?.spot_intimation_at === "string");
  const next = managerTransitions[currentStatus];
  const editable = Boolean(active?.key === selected.key && next && fields[selected.key]);
  const [state, formAction] = useActionState(
    async (_previous: { ok: boolean; message: string }, formData: FormData) => {
      try {
        await advanceClaimWorkflow(claimId, formData);
        return { ok: true, message: "Claim stage updated." };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Unable to update the claim stage." };
      }
    },
    { ok: false, message: "" },
  );
  const [spotState, spotFormAction] = useActionState(
    async (_previous: { ok: boolean; message: string }, formData: FormData) => {
      try {
        await saveSpotIntimationDetails(claimId, formData);
        return { ok: true, message: "Spot Intimation details saved." };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Unable to save Spot Intimation details." };
      }
    },
    { ok: false, message: "" },
  );
  const [showSpotSaved, setShowSpotSaved] = useState(false);

  useEffect(() => {
    if (state.ok && active?.key === "claim_intimation" && next === "Final Documents Submitted") {
      router.push(`/claims/${claimId}?stage=claim_intimation`);
      return;
    }
    if (state.ok) router.refresh();
  }, [active?.key, claimId, next, router, state.ok]);
  useEffect(() => {
    if (spotState.ok) setShowSpotSaved(true);
  }, [spotState.ok]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#DFE8F4] bg-white shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <h2 className="text-[17px] font-semibold text-[#071D49]">Operations claim journey</h2>
        <span className="rounded-full border border-[#BFD3F7] bg-[#F4F8FF] px-3 py-1 text-[11px] font-semibold text-[#174EA6]">{selected.label}</span>
      </div>
      <ol className="grid border-y border-[#D9E3F0] md:grid-cols-3 xl:grid-cols-9">
        {stages.map((stage, index) => {
          const available = index <= activeIndex;
          const isCurrent = stage.key === active?.key;
          const isSelected = stage.key === selected.key;
          const isCompleted = index < activeIndex;
          return (
            <li key={stage.key} className="border-b border-[#D9E3F0] last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
              <button
                type="button"
                disabled={!available}
                aria-current={isSelected ? "step" : undefined}
                onClick={() => setSelectedKey(stage.key)}
                className={`relative flex min-h-[72px] w-full items-center gap-2.5 px-3 py-3 text-left transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#174EA6] ${isSelected ? "bg-[#EEF3FF]" : available ? "bg-white hover:bg-[#F8FBFF]" : "cursor-not-allowed bg-white"}`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${isCompleted ? "bg-[#EAFBF4] text-[#0A9B72]" : isCurrent ? "bg-[#4F46E5] text-white" : "bg-[#F1F5F9] text-[#91A0B4]"}`}>
                  {isCompleted ? "✓" : index + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[10px] font-medium leading-4 ${isSelected ? "text-[#2837A6]" : available ? "text-[#526178]" : "text-[#A7B3C2]"}`}>{stage.label}</span>
                  <span className={`mt-0.5 block text-[8px] font-medium uppercase tracking-[0.04em] ${isCurrent ? "text-[#4F46E5]" : isCompleted ? "text-[#0A8062]" : "text-[#A7B3C2]"}`}>{isCurrent ? "Current" : isCompleted ? "Completed" : "Locked"}</span>
                </span>
                {isSelected ? <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-[#4F46E5]" /> : null}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="p-4">
        {selected.key === "spot_intimation" ? <StageForm stage={selected} active={active ?? stages[0]} detail={spotDetail ?? detail} spotDetails={spotDetails} fields={fields} next={next} accidentAt={accidentAt} spotIntimationAt={spotIntimationAt} formAction={active?.key === "spot_intimation" && next ? formAction : spotFormAction} state={active?.key === "spot_intimation" && next ? state : spotState} standalone={!editable} onSubmitStart={() => setShowSpotSaved(false)} /> : null}
        {selected.key === "spot_intimation" ? <><div className="mt-3">{spotContent}</div><div className="mt-3 flex justify-end"><FormSubmitButton form="spot-intimation-form" label={editable ? `Save & move to ${next}` : "Save Spot Intimation Details"} pendingLabel="Saving..." className="rounded-lg bg-[#071D49] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-60" /></div>{showSpotSaved ? <div className="fixed inset-0 z-50 grid place-items-center bg-[#071D49]/35 px-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="spot-intimation-saved-title" className="w-full max-w-sm rounded-2xl border border-[#D9E3F0] bg-white p-5 text-center shadow-[0_18px_50px_rgba(7,29,73,0.2)]"><h2 id="spot-intimation-saved-title" className="text-[16px] font-semibold text-[#071D49]">Spot Intimation details saved</h2><button type="button" onClick={() => { setShowSpotSaved(false); router.refresh(); }} className="mt-4 rounded-lg bg-[#071D49] px-5 py-2 text-[12px] font-semibold text-white hover:bg-[#12356C]">OK</button></div></div> : null}</> : null}
        {selected.key === "claim_intimation" ? <div className="mt-3">{claimIntimationContent}</div> : null}
        {editable && active && selected.key !== "spot_intimation" ? <form action={formAction} className="mt-3 rounded-xl border border-[#D9E6F7] bg-[#F8FBFF] p-3">
          <input type="hidden" name="next_status" value={next} /><input type="hidden" name="notes" value={`Operations updated ${active.label} and moved the claim to ${next}.`} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{fields[selected.key].map((field) => {
            const value = field.name === "insurer_claim_no"
              ? insurerClaimNo ?? ""
              : typeof detail?.details?.[field.name] === "string" || typeof detail?.details?.[field.name] === "number"
                ? String(detail.details[field.name])
                : "";
            const required = requiredFields[active.key]?.includes(field.name);
            return <label key={field.name} className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">{field.label}{required ? <span className="ml-1 text-rose-600">*</span> : null}
              {field.type === "select"
                ? <select name={field.name} defaultValue={value ?? ""} required={required} className="mt-1 h-9 w-full rounded-md border border-[#D9E3F0] bg-white px-2 text-[12px] font-medium normal-case tracking-normal text-[#071D49] outline-none focus:border-[#174EA6]"><option value="" disabled>Select</option><option value={field.name === "cashless" ? "true" : "yes"}>Yes</option><option value={field.name === "cashless" ? "false" : "no"}>{field.name === "vehicle_received" ? "Not yet" : "No"}</option></select>
                : <input name={field.name} type={field.type ?? "text"} defaultValue={value} required={required} className="mt-1 h-9 w-full rounded-md border border-[#D9E3F0] bg-white px-2 text-[12px] font-medium normal-case tracking-normal text-[#071D49] outline-none focus:border-[#174EA6]" />}
            </label>;
          })}</div>
          {state.message ? <p role={state.ok ? "status" : "alert"} className={`mt-3 rounded-md border px-3 py-2 text-[12px] font-medium ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{state.message}</p> : null}
          <FormSubmitButton label={`Save & move to ${next}`} pendingLabel="Saving..." className="mt-3 rounded-lg bg-[#071D49] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-60" />
        </form> : selected.key !== "spot_intimation" ? <p className="mt-3 rounded-lg border border-[#E4ECF6] bg-[#FBFCFE] px-3 py-2 text-[12px] font-medium text-[#526178]">{selectedIndex < activeIndex ? "Completed stage. Details are shown above." : "This stage will open when the previous stage is cleared."}</p> : null}
      </div>
    </section>
  );
}

type StageField = { name: string; label: string; type?: string };
type StageFields = Record<string, StageField[]>;

function StageForm({ stage, active, detail, spotDetails, fields, next, insurerClaimNo, accidentAt, spotIntimationAt, formAction, state, standalone = false, onSubmitStart }: { stage: (typeof stages)[number]; active: (typeof stages)[number]; detail: StageDetail | undefined; spotDetails?: InternalSpotIntimationDetails | null; fields: StageFields; next?: ClaimStatus; insurerClaimNo?: string | null; accidentAt?: string | null; spotIntimationAt?: string | null; formAction: (formData: FormData) => void; state: { ok: boolean; message: string }; standalone?: boolean; onSubmitStart?: () => void }) {
  const spot = stage.key === "spot_intimation";
  const [location, setLocation] = useState(spotDetails?.location ?? "");
  const [locationError, setLocationError] = useState("");
  useEffect(() => {
    if (!locationError) return;
    const timeout = window.setTimeout(() => setLocationError(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [locationError]);
  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Location capture is not supported in this browser.");
      return;
    }
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation(`${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`),
      () => setLocationError("Unable to access your location. Enter it manually."),
    );
  };
  return <form id="spot-intimation-form" action={formAction} onSubmit={onSubmitStart} className="mt-3 overflow-hidden rounded-2xl border border-[#BFD7F6] bg-[linear-gradient(180deg,#F8FBFF_0%,#F3F8FF_100%)] shadow-[0_8px_20px_rgba(23,78,166,0.05)]">
    {!standalone ? <><input type="hidden" name="next_status" value={next} /><input type="hidden" name="notes" value={`Operations updated ${active.label} and moved the claim to ${next}.`} /></> : null}
    {spot ? <div className="flex items-center gap-3 border-b border-[#DCE9F8] px-4 py-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#E8F2FF] text-[#2F80ED]">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2.2"/></svg>
      </span>
      <div className="min-w-0">
        <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[#071D49]">Accident &amp; Spot Intimation Details</h3>
        <p className="mt-0.5 text-[11px] font-medium text-[#68758A]">Capture the key details of the accident and spot intimation.</p>
      </div>
    </div> : null}
    <div className="p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{fields[stage.key].map((field) => {
        const storedValue = detail?.details?.[field.name];
        const value = field.name === "insurer_claim_no" ? insurerClaimNo ?? "" : field.name === "incident_at" ? spotDetails?.incident_at ?? accidentAt ?? (typeof storedValue === "string" ? storedValue : "") : field.name === "spot_intimation_at" ? spotDetails?.spot_intimation_at ?? spotIntimationAt ?? (typeof storedValue === "string" ? storedValue : "") : field.name === "driver_name" ? spotDetails?.driver_name ?? (typeof storedValue === "string" ? storedValue : "") : field.name === "driver_phone" ? spotDetails?.driver_phone ?? (typeof storedValue === "string" ? storedValue : "") : field.name === "location" ? location : typeof storedValue === "string" || typeof storedValue === "number" ? String(storedValue) : "";
        const required = requiredFields[stage.key]?.includes(field.name);
        if (spot && field.name === "location") {
          return <div key={field.name} className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="spot-intimation-location" className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#174EA6]">{field.label}{required ? <span className="ml-1 text-rose-600">*</span> : null}</label>
              <button type="button" onClick={captureLocation} className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold normal-case tracking-normal text-[#174EA6] hover:underline"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current stroke-2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>Use current location</button>
            </div>
            <input id="spot-intimation-location" name={field.name} type={field.type ?? "text"} value={location} onChange={(event) => setLocation(event.target.value)} required={required} className="mt-1.5 h-10 w-full rounded-lg border border-[#CEDBEC] bg-white px-3 text-[12px] font-semibold normal-case tracking-normal text-[#071D49] shadow-[0_2px_6px_rgba(7,29,73,0.03)] outline-none transition focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/10" />
            {locationError ? <span role="alert" className="mt-1 block text-[10px] font-medium normal-case tracking-normal text-rose-700">{locationError}</span> : null}
          </div>;
        }
        return <label key={field.name} className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#174EA6]">{field.label}{required ? <span className="ml-1 text-rose-600">*</span> : null}
          {field.type === "select" ? <select name={field.name} defaultValue={value} required={required} className="mt-1.5 h-10 w-full rounded-lg border border-[#CEDBEC] bg-white px-3 text-[12px] font-semibold normal-case tracking-normal text-[#071D49] shadow-[0_2px_6px_rgba(7,29,73,0.03)] outline-none transition focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/10"><option value="" disabled>Select</option><option value={field.name === "cashless" ? "true" : "yes"}>Yes</option><option value={field.name === "cashless" ? "false" : "no"}>{field.name === "vehicle_received" ? "Not yet" : "No"}</option></select> : <input name={field.name} type={field.type ?? "text"} defaultValue={spot ? toDateTimeLocal(value, field.type) : undefined} required={required} className="mt-1.5 h-10 w-full rounded-lg border border-[#CEDBEC] bg-white px-3 text-[12px] font-semibold normal-case tracking-normal text-[#071D49] shadow-[0_2px_6px_rgba(7,29,73,0.03)] outline-none transition focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/10" />}
        </label>;
      })}</div>
      {state.message && !state.ok ? <p role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-800">{state.message}</p> : null}
    </div>
  </form>;
}

function toDateTimeLocal(value: string, type?: string) {
  if (type !== "datetime-local" || !value) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}