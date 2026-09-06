"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { advanceClaimWorkflow, saveSpotIntimationDetails } from "@/app/actions";
import { completeClaimJourneyStage } from "@/app/claims/stage-actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { managerTransitions, type ClaimStatus } from "@/lib/claim-workflow";
import type { InternalSpotIntimationDetails } from "@/lib/internal-spot-intimation";

type StageDetail = { stage?: string | null; details: Record<string, unknown> | null; created_at: string };
type StageField = { name: string; label: string; type?: string };
type StageFields = Record<string, StageField[]>;

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
  { key: "spot_intimation", label: "Spot Intimation", statuses: ["Draft", "Accident Reported", "Initial Documents Pending", "Documents Pending"] },
  { key: "spot_status", label: "Spot Status", statuses: ["Initial Documents Submitted", "Initial Documents Verification Pending", "Documents Submitted", "Initial Documents Verified", "Claim Intimated", "Surveyor Appointed"] },
  { key: "claim_intimation", label: "Claim Intimation", statuses: ["Vehicle Inspected", "Spot Survey Completed", "Final Documents Awaited", "Final Documents Verification Pending", "Final Documents Submitted", "Final Documents Verified", "Claim Intimation", "Final Surveyor Details", "Survey Status"] },
  { key: "work_approval", label: "Work Approval", statuses: ["Survey Done", "Estimate Submitted", "Approval Pending", "Work Approval Status"] },
  { key: "repair_ri", label: "Repair & RI", statuses: ["Work Approval Received", "Under Repair", "Repair Started", "Repair Done", "Repair Completed", "RA Intimation"] },
  { key: "billing", label: "Billing", statuses: ["RA Intimation Done"] },
  { key: "delivery_order", label: "Delivery Order", statuses: ["Final Bill Submitted", "DO Status"] },
  { key: "vehicle_delivery", label: "Vehicle Delivery", statuses: ["DO Submitted"] },
  { key: "payment_encashment", label: "Payment Encashment", statuses: ["Payment Stage", "Claim Completion In Progress", "Settlement Under Process", "Claim Complete", "Settled", "Closed"] },
] as const;

type StageKey = (typeof stages)[number]["key"];
type ActionState = { ok: boolean; message: string; advanced: boolean; nextStageKey: StageKey | null };

const stageCompletionTargets: Partial<Record<StageKey, ClaimStatus>> = {
  spot_status: "Final Documents Awaited",
  claim_intimation: "Survey Done",
  work_approval: "Work Approval Received",
  repair_ri: "RA Intimation Done",
  billing: "Final Bill Submitted",
  delivery_order: "DO Submitted",
  vehicle_delivery: "Payment Stage",
  payment_encashment: "Claim Complete",
};

// Keep these labels in sync with the Customer app's managed claim stage screens.
const fields: StageFields = {
  spot_intimation: [
    { name: "incident_at", label: "Accident date and time", type: "datetime-local" },
    { name: "spot_intimation_at", label: "Spot Intimation date and time", type: "datetime-local" },
    { name: "driver_name", label: "Driver name" },
    { name: "driver_phone", label: "Driver number", type: "tel" },
    { name: "location", label: "Location" },
  ],
  spot_status: [
    { name: "spot_survey_done_date", label: "Spot Survey Done Date *", type: "date" },
    { name: "surveyor_name", label: "Surveyor Name (Optional)" },
    { name: "surveyor_email", label: "Surveyor Email (Optional)", type: "email" },
    { name: "surveyor_phone", label: "Surveyor Number (Optional)", type: "tel" },
  ],
  claim_intimation: [
    { name: "insurer_claim_no", label: "Insurer claim number" },
    { name: "dealership_name", label: "Dealership / workshop" },
    { name: "dealership_location", label: "Workshop address" },
    { name: "contact_person_name", label: "Contact person" },
    { name: "contact_number", label: "Contact number" },
    { name: "estimate_amount", label: "Estimated loss", type: "number" },
  ],
  work_approval: [
    { name: "approval_received_date", label: "Approval Received Date", type: "date" },
    { name: "cashless", label: "Cashless Claim", type: "yesno" },
    { name: "surveyor_name", label: "Surveyor Name (Optional)" },
    { name: "surveyor_phone", label: "Surveyor Phone (Optional)", type: "tel" },
    { name: "surveyor_email", label: "Surveyor Email (Optional)", type: "email" },
  ],
  repair_ri: [
    { name: "repair_complete_date", label: "Repair Complete Date", type: "date" },
    { name: "ri_requested_date", label: "RI Requested Date (Optional)", type: "date" },
    { name: "ri_done_date", label: "RI Done Date", type: "date" },
  ],
  billing: [
    { name: "bill_date", label: "Bill Date", type: "date" },
    { name: "bill_amount", label: "Bill Amount", type: "number" },
  ],
  delivery_order: [
    { name: "do_status", label: "Delivery order status" },
    { name: "do_date", label: "Delivery order date", type: "date" },
    { name: "do_amount", label: "Delivery order amount", type: "number" },
  ],
  vehicle_delivery: [
    { name: "vehicle_received", label: "Vehicle delivery status", type: "select" },
    { name: "vehicle_received_date", label: "Vehicle delivery date", type: "date" },
    { name: "satisfaction_submitted", label: "Satisfaction voucher", type: "select" },
  ],
  payment_encashment: [
    { name: "payment_status", label: "Payment status" },
    { name: "payment_received_date", label: "Payment received date", type: "date" },
    { name: "payment_received_amount", label: "Settlement amount", type: "number" },
  ],
};

const requiredFields: Record<string, string[]> = {
  spot_intimation: ["incident_at", "spot_intimation_at"],
  spot_status: ["spot_survey_done_date"],
  claim_intimation: ["insurer_claim_no", "dealership_name", "dealership_location", "estimate_amount"],
  work_approval: ["approval_received_date", "cashless"],
  repair_ri: ["repair_complete_date", "ri_done_date"],
  billing: ["bill_date", "bill_amount"],
  delivery_order: ["do_date", "do_amount"],
  vehicle_delivery: ["vehicle_received"],
  payment_encashment: ["payment_received_date", "payment_received_amount"],
};

const fieldAliases: Record<string, string[]> = {
  spot_survey_done_date: ["spot_survey_done_date", "inspection_date", "survey_date", "completed_at"],
  surveyor_name: ["surveyor_name", "name"],
  surveyor_email: ["surveyor_email", "email"],
  surveyor_phone: ["surveyor_phone", "surveyor_mobile", "surveyor_number", "mobile"],
  dealership_name: ["dealership_name", "garage_name"],
  dealership_location: ["dealership_location", "dealership_address", "garage_address"],
  contact_person_name: ["contact_person_name", "contact_person"],
  contact_number: ["contact_number", "contact_phone"],
  estimate_amount: ["estimate_amount", "estimated_loss"],
  approval_received_date: ["approval_received_date", "approved_at"],
  repair_started_date: ["repair_started_date", "repair_start_date"],
  repair_complete_date: ["repair_complete_date", "repair_completed_date"],
  ri_requested_date: ["ri_requested_date", "reinspection_requested_date", "re_inspection_requested_date"],
  ri_done_date: ["ri_done_date", "reinspection_done_date", "re_inspection_done_date"],
  ri_status: ["ri_status", "ri_required"],
  bill_date: ["bill_date", "final_bill_date"],
  bill_amount: ["bill_amount", "final_bill_amount"],
  assessment_received: ["assessment_received", "assessment_status"],
  do_date: ["do_date", "delivery_order_date"],
  do_amount: ["do_amount", "delivery_order_amount"],
  vehicle_received: ["vehicle_received", "delivery_status", "status"],
  vehicle_received_date: ["vehicle_received_date", "vehicle_delivery_date"],
  satisfaction_submitted: ["satisfaction_submitted", "satisfaction_status"],
  payment_received_date: ["payment_received_date", "settlement_date"],
  payment_received_amount: ["payment_received_amount", "settlement_amount"],
};

function nextStageKeyFor(stageKey: string | null): StageKey | null {
  const index = stages.findIndex((stage) => stage.key === stageKey);
  return index >= 0 && index < stages.length - 1 ? stages[index + 1].key : null;
}

export function OperationsClaimStages({ claimId, currentStatus, insurerClaimNo, details, spotContent, claimIntimationContent, initialStageKey, accidentAt, spotIntimationAt, spotDetails }: Props) {
  const router = useRouter();
  const active = stages.find((stage) => (stage.statuses as readonly string[]).includes(currentStatus));
  const activeIndex = active ? stages.findIndex((stage) => stage.key === active.key) : 0;
  const journeyComplete = ["Claim Complete", "Settled", "Closed"].includes(currentStatus);
  const [selectedKey, setSelectedKey] = useState(() => stages.some((stage) => stage.key === initialStageKey) ? initialStageKey! : active?.key ?? stages[0].key);
  const selected = stages.find((stage) => stage.key === selectedKey) ?? stages[0];
  const selectedIndex = stages.findIndex((stage) => stage.key === selected.key);
  const selectedAvailable = journeyComplete || selectedIndex <= activeIndex;
  const selectedIsCurrent = !journeyComplete && selected.key === active?.key;
  const detail = details.find((row) => row.details?.milestone_key === selected.key || (selected.statuses as readonly string[]).includes(row.stage ?? ""));
  const spotDetail = details.find((row) => row.details?.milestone_key === "spot_intimation" || typeof row.details?.incident_at === "string" || typeof row.details?.accident_at === "string" || typeof row.details?.spot_intimation_at === "string");
  const managerNext = managerTransitions[currentStatus];
  const stageTarget = stageCompletionTargets[selected.key];
  const spotCurrentEditable = Boolean(selected.key === "spot_intimation" && selectedIsCurrent && managerNext);
  const stageEditable = Boolean(selected.key !== "spot_intimation" && selected.key !== "claim_intimation" && selectedAvailable && stageTarget);
  const [spotSubmitting, setSpotSubmitting] = useState(false);
  const [showSpotSaved, setShowSpotSaved] = useState(false);

  const [state, formAction] = useActionState(
    async (_previous: ActionState, formData: FormData): Promise<ActionState> => {
      try {
        const milestoneKey = formData.get("milestone_key");
        if (typeof milestoneKey === "string" && milestoneKey && milestoneKey !== "spot_intimation") {
          const result = await completeClaimJourneyStage(claimId, formData);
          return {
            ok: true,
            message: result.advanced ? "Claim stage updated." : "Stage details saved.",
            advanced: result.advanced,
            nextStageKey: result.advanced ? nextStageKeyFor(milestoneKey) : null,
          };
        }
        await advanceClaimWorkflow(claimId, formData);
        return { ok: true, message: "Claim stage updated.", advanced: true, nextStageKey: "spot_status" };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Unable to update the claim stage.", advanced: false, nextStageKey: null };
      } finally {
        setSpotSubmitting(false);
      }
    },
    { ok: false, message: "", advanced: false, nextStageKey: null },
  );

  const [spotState, spotFormAction] = useActionState(
    async (_previous: { ok: boolean; message: string }, formData: FormData) => {
      try {
        await saveSpotIntimationDetails(claimId, formData);
        return { ok: true, message: "Spot Intimation details saved." };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Unable to save Spot Intimation details." };
      } finally {
        setSpotSubmitting(false);
      }
    },
    { ok: false, message: "" },
  );

  useEffect(() => {
    if (!state.ok) return;
    if (state.advanced && state.nextStageKey) {
      setSelectedKey(state.nextStageKey);
      router.replace(`/claims/${claimId}?stage=${state.nextStageKey}`);
      return;
    }
    router.refresh();
  }, [claimId, router, state.advanced, state.nextStageKey, state.ok]);

  useEffect(() => {
    if (!initialStageKey || !stages.some((stage) => stage.key === initialStageKey)) return;
    setSelectedKey(initialStageKey);
  }, [initialStageKey]);

  useEffect(() => {
    if (spotState.ok) setShowSpotSaved(true);
  }, [spotState.ok]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#DFE8F4] bg-white shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <h2 className="text-[17px] font-semibold text-[#071D49]">Operations claim journey</h2>
        <span className="rounded-full border border-[#BFD3F7] bg-[#F4F8FF] px-4 py-1.5 text-[11px] font-semibold text-[#174EA6]">{selected.label}</span>
      </div>

      <ol className="grid border-y border-[#D9E3F0] md:grid-cols-3 xl:grid-cols-9">
        {stages.map((stage, index) => {
          const available = journeyComplete || index <= activeIndex;
          const isCurrent = !journeyComplete && stage.key === active?.key;
          const isCompleted = journeyComplete || index < activeIndex;
          const isSelected = stage.key === selected.key;
          return (
            <li key={stage.key} className="border-b border-[#D9E3F0] last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
              <button
                type="button"
                disabled={!available}
                aria-current={isSelected ? "step" : undefined}
                onClick={() => setSelectedKey(stage.key)}
                className={`flex min-h-[50px] w-full items-center justify-center border-b-2 px-2.5 py-1.5 text-center transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#174EA6] ${isSelected ? "border-b-[#071D49]" : "border-b-transparent"} ${isCurrent ? "bg-[#F7FAFF]" : available ? "bg-white hover:bg-[#FAFCFF]" : "cursor-not-allowed bg-white"}`}
              >
                <span className="flex items-center justify-center gap-2">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${isCompleted ? "bg-[#E8F8F0] text-[#0A9B72]" : isCurrent ? "bg-[#155EEF] text-white shadow-[0_2px_6px_rgba(21,94,239,0.18)]" : "bg-[#EEF2F7] text-[#58708F]"}`}>
                    {isCompleted ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2.4]"><path d="m6 12 4 4 8-9" /></svg>
                    ) : isCurrent ? <span className="text-[9px] font-semibold">{index + 1}</span> : (
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3 w-3 fill-none stroke-current stroke-[2]"><rect x="6.5" y="10.5" width="11" height="8" rx="1.5" /><path d="M9 10.5V8a3 3 0 0 1 6 0v2.5" /></svg>
                    )}
                  </span>
                  <span className={`block text-[9px] font-semibold leading-none ${isCurrent ? "text-[#155EEF]" : isCompleted ? "text-[#3E536F]" : "text-[#667A96]"}`}>{stage.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="p-4">
        {selected.key === "spot_intimation" ? (
          <>
            <StageOneForm
              stage={selected}
              active={active ?? stages[0]}
              detail={spotDetail ?? detail}
              spotDetails={spotDetails}
              next={managerNext}
              accidentAt={accidentAt}
              spotIntimationAt={spotIntimationAt}
              formAction={spotCurrentEditable ? formAction : spotFormAction}
              state={spotCurrentEditable ? state : { ok: spotState.ok, message: spotState.message, advanced: false, nextStageKey: null }}
              standalone={!spotCurrentEditable}
              onSubmitStart={() => { setShowSpotSaved(false); setSpotSubmitting(true); }}
            />
            <div className="mt-3">{spotContent}</div>
            <div className="mt-3 flex justify-end">
              <FormSubmitButton
                form="spot-intimation-form"
                label={spotCurrentEditable ? `Save & move to ${managerNext}` : "Save Details"}
                pendingLabel="Saving..."
                forcePending={spotSubmitting}
                className="rounded-lg bg-[#071D49] px-4 py-2 text-[11px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </>
        ) : null}

        {selected.key === "claim_intimation" ? <div className="mt-3">{claimIntimationContent}</div> : null}

        {stageEditable ? (
          <form action={formAction} className="mt-3 rounded-xl border border-[#D9E6F7] bg-[#F8FBFF] p-3">
            <input type="hidden" name="milestone_key" value={selected.key} />
            <input type="hidden" name="next_status" value={stageTarget ?? ""} />
            <input type="hidden" name="save_only" value={selectedIsCurrent ? "false" : "true"} />
            <input type="hidden" name="notes" value={selectedIsCurrent ? `Operations completed ${selected.label} and opened the next journey stage.` : `Operations edited ${selected.label} details.`} />
            <div className={`grid gap-3 sm:grid-cols-2 ${selected.key === "work_approval" ? "lg:grid-cols-5" : selected.key === "repair_ri" ? "lg:grid-cols-3" : selected.key === "billing" ? "lg:grid-cols-2" : "lg:grid-cols-4"}`}>
              {fields[selected.key].map((field) => {
                const value = field.name === "insurer_claim_no" ? insurerClaimNo ?? fieldValue(details, detail, field.name) : fieldValue(details, detail, field.name);
                const required = requiredFields[selected.key]?.includes(field.name);
                if (field.type === "yesno") {
                  const yesChecked = value === "true" || value === "yes";
                  const noChecked = value === "false" || value === "no";
                  return (
                    <fieldset key={field.name} className="min-w-0">
                      <legend className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">
                        {field.label}{required ? <span className="ml-1 text-rose-600">*</span> : null}
                      </legend>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <label className="flex h-9 cursor-pointer items-center justify-center rounded-md border border-[#D9E3F0] bg-white text-[12px] font-semibold normal-case tracking-normal text-[#071D49] has-[:checked]:border-[#174EA6] has-[:checked]:bg-[#EEF4FF]">
                          <input className="sr-only" type="radio" name={field.name} value="true" defaultChecked={yesChecked} required={required} />Yes
                        </label>
                        <label className="flex h-9 cursor-pointer items-center justify-center rounded-md border border-[#D9E3F0] bg-white text-[12px] font-semibold normal-case tracking-normal text-[#071D49] has-[:checked]:border-[#174EA6] has-[:checked]:bg-[#EEF4FF]">
                          <input className="sr-only" type="radio" name={field.name} value="false" defaultChecked={noChecked} required={required} />No
                        </label>
                      </div>
                    </fieldset>
                  );
                }
                return (
                  <label key={field.name} className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">
                    {field.label}{required && !field.label.includes("*") ? <span className="ml-1 text-rose-600">*</span> : null}
                    {selected.key === "billing" && field.name === "bill_date" ? (
                      <AppStyleDateInput name={field.name} value={value} required={required} />
                    ) : field.type === "select" ? (
                      <select name={field.name} defaultValue={value} required={required} className="mt-1 h-9 w-full rounded-md border border-[#D9E3F0] bg-white px-2 text-[12px] font-medium normal-case tracking-normal text-[#071D49] outline-none focus:border-[#174EA6]">
                        <option value="" disabled>Select</option>
                        <option value={field.name === "cashless" ? "true" : "yes"}>Yes</option>
                        <option value={field.name === "cashless" ? "false" : "no"}>No</option>
                      </select>
                    ) : (
                      <input
                        name={field.name}
                        type={field.type ?? "text"}
                        defaultValue={field.type === "date" ? toDateValue(value) : value}
                        required={required}
                        onClick={field.type === "date" ? (event) => event.currentTarget.showPicker?.() : undefined}
                        className="mt-1 h-9 w-full rounded-md border border-[#D9E3F0] bg-white px-2 text-[12px] font-medium normal-case tracking-normal text-[#071D49] outline-none focus:border-[#174EA6]"
                      />
                    )}
                  </label>
                );
              })}
            </div>
            {state.message ? <p role={state.ok ? "status" : "alert"} className={`mt-3 rounded-md border px-3 py-2 text-[12px] font-medium ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{state.message}</p> : null}
            <div className="mt-3 flex justify-end"><FormSubmitButton label="Save Details" pendingLabel="Saving..." className="rounded-lg bg-[#071D49] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-60" /></div>
          </form>
        ) : selected.key !== "spot_intimation" && selected.key !== "claim_intimation" ? (
          <p className="mt-3 rounded-lg border border-[#E4ECF6] bg-[#FBFCFE] px-3 py-2 text-[12px] font-medium text-[#526178]">This stage will open when the previous stage is completed.</p>
        ) : null}
      </div>

      {showSpotSaved ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#071D49]/35 px-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="spot-intimation-saved-title" className="w-full max-w-sm rounded-2xl border border-[#D9E3F0] bg-white p-5 text-center shadow-[0_18px_50px_rgba(7,29,73,0.2)]">
            <h2 id="spot-intimation-saved-title" className="text-[16px] font-semibold text-[#071D49]">Spot Intimation details saved</h2>
            <button type="button" onClick={() => { setShowSpotSaved(false); router.refresh(); }} className="mt-4 rounded-lg bg-[#071D49] px-5 py-2 text-[12px] font-semibold text-white hover:bg-[#12356C]">OK</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function fieldValue(details: StageDetail[], detail: StageDetail | undefined, fieldName: string) {
  const aliases = fieldAliases[fieldName] ?? [fieldName];
  const candidates = detail ? [detail, ...details.filter((row) => row !== detail)] : details;
  for (const row of candidates) {
    for (const alias of aliases) {
      const value = row.details?.[alias];
      if (typeof value === "string" && value.trim()) return value;
      if (typeof value === "number") return String(value);
      if (typeof value === "boolean") return value ? "yes" : "no";
    }
  }
  return "";
}

function toDateValue(value: string) {
  if (!value) return "";
  const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly) return dateOnly;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function AppStyleDateInput({ name, value, required }: { name: string; value: string; required?: boolean }) {
  const [dateValue, setDateValue] = useState(() => toDateValue(value));
  return (
    <span className="relative mt-1 flex h-10 w-full items-center justify-between rounded-md border border-[#D9E3F0] bg-white px-3 normal-case tracking-normal text-[#071D49] focus-within:border-[#174EA6]">
      <span className={`text-[12px] font-medium ${dateValue ? "text-[#071D49]" : "text-[#7B8BA3]"}`}>{dateValue ? formatDisplayDate(dateValue) : "Select date"}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-[#526178] stroke-[1.8]"><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M8 3v6M16 3v6M4 10h16" /></svg>
      <input
        aria-label="Select date"
        name={name}
        type="date"
        value={dateValue}
        onChange={(event) => setDateValue(event.target.value)}
        required={required}
        onClick={(event) => event.currentTarget.showPicker?.()}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  );
}

function formatDisplayDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

function StageOneForm({ stage, active, detail, spotDetails, next, accidentAt, spotIntimationAt, formAction, state, standalone = false, onSubmitStart }: { stage: (typeof stages)[number]; active: (typeof stages)[number]; detail: StageDetail | undefined; spotDetails?: InternalSpotIntimationDetails | null; next?: ClaimStatus; accidentAt?: string | null; spotIntimationAt?: string | null; formAction: (formData: FormData) => void; state: ActionState; standalone?: boolean; onSubmitStart?: () => void }) {
  const [location, setLocation] = useState(spotDetails?.location ?? "");
  const [locationError, setLocationError] = useState("");
  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Location capture is not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => { setLocation(`${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`); setLocationError(""); },
      () => setLocationError("Unable to access your location. Enter it manually."),
    );
  };

  return (
    <form id="spot-intimation-form" action={formAction} onSubmit={onSubmitStart} className="mt-3 overflow-hidden rounded-2xl border border-[#BFD7F6] bg-white shadow-[0_8px_20px_rgba(23,78,166,0.05)]">
      {!standalone ? <><input type="hidden" name="next_status" value={next} /><input type="hidden" name="notes" value={`Operations updated ${active.label} and moved the claim to ${next}.`} /></> : null}
      <div className="flex items-center gap-3 border-b border-[#DCE9F8] px-4 py-3">
        <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[#071D49]">Accident &amp; Spot Intimation Details</h3>
      </div>
      <div className="p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {fields[stage.key].map((field) => {
            const storedValue = detail?.details?.[field.name];
            const value = field.name === "incident_at"
              ? spotDetails?.incident_at ?? accidentAt ?? (typeof storedValue === "string" ? storedValue : "")
              : field.name === "spot_intimation_at"
                ? spotDetails?.spot_intimation_at ?? spotIntimationAt ?? (typeof storedValue === "string" ? storedValue : "")
                : field.name === "driver_name"
                  ? spotDetails?.driver_name ?? (typeof storedValue === "string" ? storedValue : "")
                  : field.name === "driver_phone"
                    ? spotDetails?.driver_phone ?? (typeof storedValue === "string" ? storedValue : "")
                    : field.name === "location" ? location : typeof storedValue === "string" || typeof storedValue === "number" ? String(storedValue) : "";
            const required = requiredFields[stage.key]?.includes(field.name);
            if (field.name === "location") {
              return (
                <div key={field.name} className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="spot-intimation-location" className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#174EA6]">{field.label}</label>
                    <button type="button" onClick={captureLocation} className="text-[10px] font-semibold normal-case tracking-normal text-[#174EA6] hover:underline">Use current location</button>
                  </div>
                  <input id="spot-intimation-location" name={field.name} value={location} onChange={(event) => setLocation(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[#CEDBEC] bg-white px-3 text-[12px] font-semibold text-[#071D49] outline-none focus:border-[#2F80ED]" />
                  {locationError ? <span role="alert" className="mt-1 block text-[10px] font-medium text-rose-700">{locationError}</span> : null}
                </div>
              );
            }
            return (
              <label key={field.name} className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#174EA6]">
                {field.label}{required ? <span className="ml-1 text-rose-600">*</span> : null}
                <input name={field.name} type={field.type ?? "text"} defaultValue={toDateTimeLocal(value, field.type)} required={required} className="mt-1.5 h-10 w-full rounded-lg border border-[#CEDBEC] bg-white px-3 text-[12px] font-semibold normal-case tracking-normal text-[#071D49] outline-none focus:border-[#2F80ED]" />
              </label>
            );
          })}
        </div>
        {state.message && !state.ok ? <p role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-800">{state.message}</p> : null}
      </div>
    </form>
  );
}

function toDateTimeLocal(value: string, type?: string) {
  if (type !== "datetime-local" || !value) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}