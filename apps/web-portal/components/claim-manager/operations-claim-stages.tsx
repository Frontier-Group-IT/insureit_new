"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { advanceClaimWorkflow } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { managerTransitions, type ClaimStatus } from "@/lib/claim-workflow";

type StageDetail = { stage?: string | null; details: Record<string, unknown> | null; created_at: string };

type Props = {
  claimId: string;
  currentStatus: ClaimStatus;
  insurerClaimNo?: string | null;
  details: StageDetail[];
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

const fields: Record<string, Array<{ name: string; label: string; type?: string }>> = {
  spot_intimation: [
    { name: "accident_at", label: "Accident date and time", type: "datetime-local" },
    { name: "accident_location", label: "Accident location" }, { name: "accident_description", label: "Accident description" }
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
    { name: "repair_complete_date", label: "Repair complete date", type: "date" }, { name: "ri_required", label: "Re-inspection required", type: "select" },
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
  claim_intimation: ["insurer_claim_no", "dealership_name", "dealership_location", "claim_intimation_date", "gate_in_date", "estimate_amount"],
  work_approval: ["approval_received_date", "cashless"],
  repair_ri: ["repair_complete_date", "ri_done_date"],
  billing: ["bill_date", "bill_amount"],
  delivery_order: ["assessment_received", "do_date", "do_amount"],
  vehicle_delivery: ["vehicle_received"],
  payment_encashment: ["depreciation_submitted", "satisfaction_submitted", "payment_received_date", "payment_received_amount"]
};

export function OperationsClaimStages({ claimId, currentStatus, insurerClaimNo, details }: Props) {
  const router = useRouter();
  const active = stages.find((stage) => (stage.statuses as readonly string[]).includes(currentStatus));
  const detail = active ? [...details].find((row) => row.stage === currentStatus || row.details?.milestone_key === active.key) : null;
  const next = managerTransitions[currentStatus];
  const editable = Boolean(active && next && fields[active.key]);
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

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);

  return (
    <section className="rounded-2xl border border-[#DFE8F4] bg-white p-4 shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-[17px] font-semibold text-[#071D49]">Operations claim journey</h2><p className="mt-1 text-[12px] text-[#526178]">Internal stage controls aligned with the customer claim journey. Historical statuses remain unchanged.</p></div>
        <span className="rounded-full border border-[#BFD3F7] bg-[#F4F8FF] px-3 py-1 text-[11px] font-semibold text-[#174EA6]">{active?.label ?? currentStatus}</span>
      </div>
      <ol className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-9">
        {stages.map((stage) => <li key={stage.key} className={`rounded-lg border px-2 py-2 text-[10px] font-semibold ${stage === active ? "border-[#174EA6] bg-[#EEF4FF] text-[#003A83]" : "border-[#E4ECF6] text-[#68758A]"}`}>{stage.label}</li>)}
      </ol>
      {detail?.details && Object.keys(detail.details).length ? <div className="mt-3 grid gap-2 rounded-xl border border-[#E4ECF6] bg-[#FBFCFE] p-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(detail.details).filter(([key]) => key !== "milestone_key").map(([key, value]) => <div key={key}><p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#68758A]">{key.replaceAll("_", " ")}</p><p className="mt-0.5 break-words text-[12px] font-semibold text-[#071D49]">{String(value ?? "-")}</p></div>)}</div> : null}
      {editable && active ? <form action={formAction} className="mt-3 rounded-xl border border-[#D9E6F7] bg-[#F8FBFF] p-3">
        <input type="hidden" name="next_status" value={next} /><input type="hidden" name="notes" value={`Operations updated ${active.label} and moved the claim to ${next}.`} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{fields[active.key].map((field) => {
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
      </form> : <p className="mt-3 rounded-lg border border-[#E4ECF6] bg-[#FBFCFE] px-3 py-2 text-[12px] font-medium text-[#526178]">This stage is read-only here. Use the stage-specific document or survey controls above when available.</p>}
    </section>
  );
}
