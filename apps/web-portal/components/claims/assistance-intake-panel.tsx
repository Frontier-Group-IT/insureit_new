"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveAssistanceIntake } from "@/app/claims/[id]/assistance-actions";

const initialAssistanceReviewState = { ok: false, message: "" };

type IntakeDocument = {
  id: string;
  documentType: string;
  fileName: string;
  verificationStatus: string;
  openUrl: string;
};

type IntakeMilestone = {
  key: string;
  status: string;
};

type AssistanceIntakePanelProps = {
  claimId: string;
  claimNo: string;
  currentStatus: string;
  assistanceStatus: string | null;
  assistanceNote: string | null;
  customerName: string;
  vehicleNo: string;
  documents: IntakeDocument[];
  milestones: IntakeMilestone[];
};

export function AssistanceIntakePanel(props: AssistanceIntakePanelProps) {
  const router = useRouter();
  const [decision, setDecision] = useState<"accepted" | "declined">("accepted");
  const [state, formAction, pending] = useActionState(resolveAssistanceIntake, initialAssistanceReviewState);
  const completedMilestones = props.milestones.filter((milestone) => milestone.status === "completed" || milestone.status === "not_applicable").length;
  const orderedMilestones = [...props.milestones].sort((left, right) => milestoneOrder(left.key) - milestoneOrder(right.key));

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#D8E3F2] bg-white p-5 shadow-[0_8px_24px_rgba(7,29,73,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#174EA6]">External customer-managed claim</p>
            <h1 className="mt-1 text-xl font-semibold text-[#071D49]">Assistance intake review</h1>
            <p className="mt-1 text-sm text-[#5C6878]">Review the customer&apos;s progress and evidence before Operations accepts responsibility.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${props.assistanceStatus === "requested" ? "bg-amber-100 text-amber-800" : "bg-[#EEF4FC] text-[#174EA6]"}`}>
            {props.assistanceStatus === "requested" ? "Assistance requested" : "Customer managed"}
          </span>
        </div>

        <dl className="mt-5 grid gap-3 rounded-xl bg-[#F7FAFE] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Control no." value={props.claimNo} />
          <Summary label="Customer" value={props.customerName} />
          <Summary label="Vehicle" value={props.vehicleNo} />
          <Summary label="Customer status" value={props.currentStatus} />
        </dl>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-xl border border-[#E1E8F2] p-4">
            <p className="text-xs font-semibold text-[#071D49]">Customer journey evidence</p>
            <p className="mt-2 text-sm text-[#435168]">{completedMilestones} of 9 customer milestones completed</p>
            <div className="mt-3 space-y-2">
              {orderedMilestones.length ? orderedMilestones.map((milestone) => (
                <div key={milestone.key} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-[#526178]">{milestone.key.replaceAll("_", " ")}</span>
                  <span className="font-semibold text-[#071D49]">{milestone.status.replaceAll("_", " ")}</span>
                </div>
              )) : <p className="text-xs text-[#6B7788]">No customer milestones have been recorded yet.</p>}
            </div>
          </div>

          <div className="rounded-xl border border-[#E1E8F2] p-4">
            <p className="text-xs font-semibold text-[#071D49]">Uploaded evidence</p>
            <div className="mt-3 space-y-2">
              {props.documents.length ? props.documents.map((document) => (
                <a key={document.id} href={document.openUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg bg-[#F7FAFE] px-3 py-2 text-xs hover:bg-[#EEF4FC]">
                  <span className="min-w-0"><span className="block truncate font-semibold text-[#071D49]">{document.fileName}</span><span className="block text-[#6B7788]">{document.documentType}</span></span>
                  <span className="shrink-0 capitalize text-[#174EA6]">{document.verificationStatus}</span>
                </a>
              )) : <p className="text-xs text-[#6B7788]">No claim documents have been uploaded.</p>}
            </div>
          </div>
        </div>

        {props.assistanceNote ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-900">Customer request</p><p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{props.assistanceNote}</p></div> : null}
      </section>

      {props.assistanceStatus === "requested" ? (
        <form action={formAction} className="rounded-2xl border border-[#D8E3F2] bg-white p-5 shadow-[0_8px_24px_rgba(7,29,73,0.05)]">
          <input type="hidden" name="claimId" value={props.claimId} />
          <input type="hidden" name="decision" value={decision} />
          <h2 className="text-base font-semibold text-[#071D49]">Operations decision</h2>
          <p className="mt-1 text-xs text-[#5C6878]">Acceptance converts only this claim to Operations-managed processing. The external policy source and customer milestones remain unchanged.</p>

          <div className="mt-4 flex gap-2">
            <DecisionButton active={decision === "accepted"} onClick={() => setDecision("accepted")} label="Accept assistance" />
            <DecisionButton active={decision === "declined"} onClick={() => setDecision("declined")} label="Decline assistance" />
          </div>

          {decision === "accepted" ? (
            <label className="mt-4 block text-xs font-semibold text-[#071D49]">
              Confirm internal starting stage
              <select name="entryStatus" required defaultValue="Initial Documents Verification Pending" className="mt-1 h-11 w-full rounded-lg border border-[#CCD6E4] bg-white px-3 text-sm font-medium text-[#071D49] outline-none focus:border-[#174EA6]">
                <option value="Initial Documents Pending">Initial documents still required</option>
                <option value="Initial Documents Verification Pending">Documents received - Operations verification required</option>
                <option value="Initial Documents Verified">Initial documents reviewed and verified</option>
              </select>
            </label>
          ) : null}

          <label className="mt-4 block text-xs font-semibold text-[#071D49]">
            Customer-visible review note
            <textarea name="note" required minLength={10} rows={4} placeholder="Explain the decision without including private internal information." className="mt-1 w-full rounded-lg border border-[#CCD6E4] bg-white px-3 py-2 text-sm text-[#071D49] outline-none placeholder:text-[#8491A3] focus:border-[#174EA6]" />
          </label>

          {state.message ? <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${state.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{state.message}</p> : null}
          <button type="submit" disabled={pending} className={`mt-4 inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${decision === "accepted" ? "bg-[#003A83]" : "bg-red-700"}`}>
            {pending ? "Saving decision..." : decision === "accepted" ? "Confirm acceptance and starting stage" : "Confirm decline"}
          </button>
        </form>
      ) : (
        <div className="rounded-xl border border-[#D8E3F2] bg-[#F7FAFE] p-4 text-sm text-[#435168]">
          This claim remains customer-managed. Operations controls are unavailable unless the customer submits a new assistance request.
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] font-semibold uppercase tracking-wide text-[#7B8797]">{label}</dt><dd className="mt-1 text-sm font-semibold text-[#071D49]">{value || "-"}</dd></div>;
}

function DecisionButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${active ? "border-[#174EA6] bg-[#EAF2FF] text-[#0A43A3]" : "border-[#D8E1EC] bg-white text-[#526178]"}`}>{label}</button>;
}

function milestoneOrder(key: string) {
  const order = ["spot_intimation", "spot_status", "claim_intimation", "work_approval", "repair_ri", "billing", "delivery_order", "vehicle_delivery", "payment_encashment"];
  const index = order.indexOf(key);
  return index === -1 ? order.length : index;
}
