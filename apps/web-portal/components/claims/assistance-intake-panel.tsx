"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadExternalClaimReadonlyJourney,
  type ExternalClaimReadonlyMilestone,
  type ExternalClaimReadonlySnapshot,
} from "@/app/claims/external-claim-readonly-actions";

const stages = [
  { key: "spot_intimation", label: "Spot Intimation" },
  { key: "spot_status", label: "Spot Status" },
  { key: "claim_intimation", label: "Claim Intimation" },
  { key: "work_approval", label: "Work Approval" },
  { key: "repair_ri", label: "Repair & RI" },
  { key: "billing", label: "Billing" },
  { key: "delivery_order", label: "Delivery Order" },
  { key: "vehicle_delivery", label: "Vehicle Delivery" },
  { key: "payment_encashment", label: "Payment Encashment" },
] as const;

type StageKey = (typeof stages)[number]["key"];
type FieldKind = "text" | "date" | "datetime" | "money" | "choice";
type FieldDefinition = { key: string; label: string; kind?: FieldKind; aliases?: string[]; claimFallback?: keyof ExternalClaimReadonlySnapshot };

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

const fields: Record<StageKey, FieldDefinition[]> = {
  spot_intimation: [
    { key: "incident_at", label: "Accident date and time", kind: "datetime", aliases: ["accident_at"], claimFallback: "accidentAt" },
    { key: "spot_intimation_at", label: "Spot Intimation date and time", kind: "datetime", claimFallback: "spotIntimationAt" },
    { key: "driver_name", label: "Driver name" },
    { key: "driver_phone", label: "Driver number" },
    { key: "location", label: "Location", aliases: ["accident_location"], claimFallback: "accidentLocation" },
  ],
  spot_status: [
    { key: "spot_survey_done_date", label: "Spot Survey Done Date", kind: "date", aliases: ["inspection_date", "survey_date", "completed_at"] },
    { key: "surveyor_name", label: "Surveyor Name" },
    { key: "surveyor_email", label: "Surveyor Email" },
    { key: "surveyor_phone", label: "Surveyor Number", aliases: ["surveyor_mobile", "surveyor_number", "mobile"] },
  ],
  claim_intimation: [
    { key: "insurer_claim_no", label: "Insurer claim number", claimFallback: "insurerClaimNo" },
    { key: "claim_intimation_date", label: "Claim Intimation Date", kind: "date" },
    { key: "dealership_name", label: "Dealership Name", aliases: ["garage_name"] },
    { key: "dealership_location", label: "Dealership Location", aliases: ["dealership_address", "garage_address"] },
    { key: "gate_in_date", label: "Gate-in Date", kind: "date" },
    { key: "estimate_amount", label: "Estimate Amount", kind: "money", aliases: ["estimated_loss"] },
  ],
  work_approval: [
    { key: "approval_received_date", label: "Approval Received Date", kind: "date", aliases: ["approved_at"] },
    { key: "cashless", label: "Cashless Claim", kind: "choice" },
    { key: "surveyor_name", label: "Surveyor Name" },
    { key: "surveyor_phone", label: "Surveyor Phone", aliases: ["surveyor_mobile", "surveyor_number"] },
    { key: "surveyor_email", label: "Surveyor Email" },
  ],
  repair_ri: [
    { key: "repair_complete_date", label: "Repair Complete Date", kind: "date", aliases: ["repair_completed_date"] },
    { key: "ri_requested_date", label: "RI Requested Date", kind: "date", aliases: ["reinspection_requested_date", "re_inspection_requested_date"] },
    { key: "ri_done_date", label: "RI Done Date", kind: "date", aliases: ["reinspection_done_date", "re_inspection_done_date"] },
  ],
  billing: [
    { key: "bill_date", label: "Bill Date", kind: "date", aliases: ["final_bill_date"] },
    { key: "bill_amount", label: "Bill Amount", kind: "money", aliases: ["final_bill_amount"] },
  ],
  delivery_order: [
    { key: "assessment_received", label: "Assessment Received?", kind: "choice", aliases: ["assessment_status"] },
    { key: "do_date", label: "DO Date", kind: "date", aliases: ["delivery_order_date"] },
    { key: "do_amount", label: "DO Amount", kind: "money", aliases: ["delivery_order_amount"] },
  ],
  vehicle_delivery: [
    { key: "vehicle_received", label: "Vehicle Received?", kind: "choice", aliases: ["delivery_status", "status"] },
    { key: "vehicle_received_date", label: "Vehicle Received Date", kind: "date", aliases: ["vehicle_delivery_date"] },
  ],
  payment_encashment: [
    { key: "depreciation_submitted", label: "Depreciation Slip Submitted?", kind: "choice", aliases: ["depreciation_slip_submitted", "depreciation_submitted"] },
    { key: "satisfaction_submitted", label: "Satisfaction Voucher Submitted?", kind: "choice", aliases: ["satisfaction_voucher_submitted", "satisfaction_status"] },
    { key: "documents_submit_date", label: "Documents Submit Date", kind: "date", aliases: ["document_submit_date", "documents_submitted_date"] },
    { key: "payment_received_date", label: "Payment Received Date", kind: "date", aliases: ["settlement_date"] },
    { key: "payment_received_amount", label: "Amount Received", kind: "money", aliases: ["settlement_amount"] },
  ],
};

const stageOneDocumentTypes = new Set([
  "rc copy",
  "insurance copy",
  "driver licence",
  "driving licence",
  "gr / load bill",
  "gr copy / load challan",
  "accident photo",
  "accident video",
  "spot intimation attachment",
  "incident voice note",
]);
const workApprovalDocumentTypes = new Set(["approval pdf", "surveyor approval / report", "work approval attachment"]);
const billingDocumentTypes = new Set(["final workshop bill"]);
const deliveryOrderDocumentTypes = new Set(["assessment report"]);

export function AssistanceIntakePanel(props: AssistanceIntakePanelProps) {
  const initialStage = activeStageKey(props.milestones);
  const [selectedKey, setSelectedKey] = useState<StageKey>(initialStage);
  const [snapshot, setSnapshot] = useState<ExternalClaimReadonlySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    void loadExternalClaimReadonlyJourney(props.claimId)
      .then((result) => {
        if (!active) return;
        setSnapshot(result);
        setSelectedKey((current) => isAvailableStage(current, result.milestones) ? current : activeStageKey(result.milestones));
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load the external claim journey.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [props.claimId]);

  const progress = snapshot?.milestones ?? props.milestones.map((milestone) => ({
    key: milestone.key,
    status: milestone.status,
    details: {},
    completedAt: null,
    updatedAt: null,
  } satisfies ExternalClaimReadonlyMilestone));
  const activeKey = activeStageKey(progress);
  const activeIndex = stages.findIndex((stage) => stage.key === activeKey);
  const journeyComplete = stages.every((stage) => isCompletedStatus(progress.find((item) => item.key === stage.key)?.status));
  const selectedMilestone = progress.find((milestone) => milestone.key === selectedKey);
  const selectedDetails = selectedMilestone?.details ?? {};
  const selectedDocuments = useMemo(() => props.documents.filter((document) => documentStage(document.documentType) === selectedKey), [props.documents, selectedKey]);
  const completedMilestones = progress.filter((milestone) => isCompletedStatus(milestone.status)).length;

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-[#D8E3F2] bg-white p-4 shadow-[0_8px_24px_rgba(7,29,73,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#174EA6]">External customer-managed claim</p>
            <h1 className="mt-1 text-xl font-semibold text-[#071D49]">Claim journey</h1>
            <p className="mt-1 text-sm text-[#5C6878]">Operations can review the customer&apos;s nine-stage journey and evidence. All controls are view-only.</p>
          </div>
          <span className="rounded-full border border-[#BFD3F7] bg-[#F4F8FF] px-3 py-1 text-xs font-semibold text-[#174EA6]">View only</span>
        </div>

        <dl className="mt-4 grid gap-3 rounded-xl bg-[#F7FAFE] p-3 sm:grid-cols-2 lg:grid-cols-6">
          <Summary label="Control no." value={props.claimNo} />
          <Summary label="Customer" value={props.customerName} />
          <Summary label="Vehicle" value={props.vehicleNo} />
          <Summary label="Policy" value={snapshot?.policyNo ?? "-"} />
          <Summary label="Insurer" value={snapshot?.insurerName ?? "-"} />
          <Summary label="Customer status" value={props.currentStatus} />
        </dl>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#526178]">
          <span>{completedMilestones} of 9 stages completed</span>
          {snapshot?.policyType ? <span>{snapshot.policyType}</span> : null}
        </div>
        {props.assistanceNote ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">Customer note</p><p className="mt-1 whitespace-pre-wrap text-xs text-amber-900">{props.assistanceNote}</p></div> : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#DFE8F4] bg-white shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-[17px] font-semibold text-[#071D49]">External claim journey</h2>
          <span className="rounded-full border border-[#BFD3F7] bg-[#F4F8FF] px-4 py-1.5 text-[11px] font-semibold text-[#174EA6]">{stages.find((stage) => stage.key === selectedKey)?.label}</span>
        </div>

        <ol className="grid border-y border-[#D9E3F0] md:grid-cols-3 xl:grid-cols-9">
          {stages.map((stage, index) => {
            const milestone = progress.find((item) => item.key === stage.key);
            const completed = isCompletedStatus(milestone?.status);
            const current = !journeyComplete && stage.key === activeKey;
            const available = journeyComplete || completed || index <= activeIndex;
            const selected = stage.key === selectedKey;
            return (
              <li key={stage.key} className="border-b border-[#D9E3F0] last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                <button
                  type="button"
                  disabled={!available}
                  aria-current={selected ? "step" : undefined}
                  onClick={() => setSelectedKey(stage.key)}
                  className={`flex min-h-[50px] w-full items-center justify-center border-b-2 px-2.5 py-1.5 text-center transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#174EA6] ${selected ? "border-b-[#071D49]" : "border-b-transparent"} ${current ? "bg-[#F7FAFF]" : available ? "bg-white hover:bg-[#FAFCFF]" : "cursor-not-allowed bg-white"}`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${completed ? "bg-[#E8F8F0] text-[#0A9B72]" : current ? "bg-[#155EEF] text-white shadow-[0_2px_6px_rgba(21,94,239,0.18)]" : "bg-[#EEF2F7] text-[#58708F]"}`}>
                      {completed ? <CheckIcon /> : current ? <span className="text-[9px] font-semibold">{index + 1}</span> : <LockIcon />}
                    </span>
                    <span className={`block text-[9px] font-semibold leading-none ${current ? "text-[#155EEF]" : completed ? "text-[#3E536F]" : "text-[#667A96]"}`}>{stage.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="p-4">
          {loading ? <div className="rounded-xl border border-[#D9E6F7] bg-[#F8FBFF] p-4 text-sm text-[#526178]">Loading customer-entered stage details...</div> : null}
          {loadError ? <div role="status" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{loadError}</div> : null}
          {!loading && !loadError ? (
            <>
              <div className="rounded-xl border border-[#D9E6F7] bg-[#F8FBFF] p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-[#071D49]">Stage details</h3>
                    <p className="mt-0.5 text-[10px] text-[#667A96]">Customer-entered values are shown exactly as read-only evidence.</p>
                  </div>
                  <span className="rounded-full bg-[#EEF2F7] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#58708F]">{formatMilestoneStatus(selectedMilestone?.status)}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {fields[selectedKey].map((field) => (
                    <ReadOnlyField key={field.key} label={field.label} value={fieldValue(field, selectedDetails, snapshot)} kind={field.kind} />
                  ))}
                </div>
              </div>

              <DocumentEvidence documents={selectedDocuments} />
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-[9px] font-semibold uppercase tracking-wide text-[#7B8797]">{label}</dt><dd className="mt-1 truncate text-[12px] font-semibold text-[#071D49]">{value || "-"}</dd></div>;
}

function ReadOnlyField({ label, value, kind = "text" }: { label: string; value: unknown; kind?: FieldKind }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#526178]">{label}</p>
      <div className="min-h-10 rounded-lg border border-[#CDD8E8] bg-white px-3 py-2 text-[12px] font-medium text-[#071D49] opacity-70 shadow-sm">
        {formatFieldValue(value, kind)}
      </div>
    </div>
  );
}

function DocumentEvidence({ documents }: { documents: IntakeDocument[] }) {
  return (
    <div className="mt-3 rounded-xl border border-[#D9E6F7] bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-[#071D49]">Document evidence</h3>
        <span className="text-[10px] font-medium text-[#667A96]">View only</span>
      </div>
      {documents.length ? (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {documents.map((document) => (
            <div key={document.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#E1E8F2] bg-[#F8FBFF] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-[#071D49]">{document.fileName}</p>
                <p className="mt-0.5 truncate text-[9px] text-[#667A96]">{document.documentType} · {document.verificationStatus.replaceAll("_", " ")}</p>
              </div>
              <a href={document.openUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-md border border-[#BFD3F7] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#174EA6] hover:bg-[#F4F8FF]">View</a>
            </div>
          ))}
        </div>
      ) : <p className="text-[11px] text-[#6B7788]">No documents recorded for this stage.</p>}
    </div>
  );
}

function activeStageKey(milestones: Array<{ key: string; status: string }>): StageKey {
  const explicit = stages.find((stage) => milestones.some((milestone) => milestone.key === stage.key && milestone.status === "in_progress"));
  if (explicit) return explicit.key;
  const firstIncomplete = stages.find((stage) => !isCompletedStatus(milestones.find((milestone) => milestone.key === stage.key)?.status));
  return firstIncomplete?.key ?? "payment_encashment";
}

function isAvailableStage(key: StageKey, milestones: Array<{ key: string; status: string }>) {
  const activeKey = activeStageKey(milestones);
  const activeIndex = stages.findIndex((stage) => stage.key === activeKey);
  const index = stages.findIndex((stage) => stage.key === key);
  const status = milestones.find((milestone) => milestone.key === key)?.status;
  const complete = stages.every((stage) => isCompletedStatus(milestones.find((milestone) => milestone.key === stage.key)?.status));
  return complete || isCompletedStatus(status) || index <= activeIndex;
}

function isCompletedStatus(status?: string | null) {
  return status === "completed" || status === "not_applicable";
}

function fieldValue(field: FieldDefinition, details: Record<string, unknown>, snapshot: ExternalClaimReadonlySnapshot | null) {
  const keys = [field.key, ...(field.aliases ?? [])];
  for (const key of keys) {
    const value = details[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  if (field.claimFallback && snapshot) {
    const fallback = snapshot[field.claimFallback];
    if (fallback !== undefined && fallback !== null && fallback !== "") return fallback;
  }
  return null;
}

function formatFieldValue(value: unknown, kind: FieldKind) {
  if (value === null || value === undefined || value === "") return "-";
  if (kind === "choice") {
    const normalized = String(value).trim().toLowerCase();
    if (["true", "yes", "received", "completed"].includes(normalized)) return "Yes";
    if (["false", "no", "not received", "not_received"].includes(normalized)) return "No";
  }
  if (kind === "money") {
    const numeric = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
    if (Number.isFinite(numeric)) return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(numeric);
  }
  if (kind === "date" || kind === "datetime") return formatDateValue(String(value), kind === "datetime");
  return String(value);
}

function formatDateValue(value: string, withTime: boolean) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}-${month}-${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", withTime
    ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatMilestoneStatus(status?: string | null) {
  if (!status) return "Not started";
  return status.replaceAll("_", " ");
}

function documentStage(documentType: string): StageKey {
  const normalized = documentType.trim().toLowerCase();
  if (stageOneDocumentTypes.has(normalized)) return "spot_intimation";
  if (workApprovalDocumentTypes.has(normalized)) return "work_approval";
  if (billingDocumentTypes.has(normalized)) return "billing";
  if (deliveryOrderDocumentTypes.has(normalized)) return "delivery_order";
  return "claim_intimation";
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2.4]"><path d="m6 12 4 4 8-9" /></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3 w-3 fill-none stroke-current stroke-[2]"><rect x="6.5" y="10.5" width="11" height="8" rx="1.5" /><path d="M9 10.5V8a3 3 0 0 1 6 0v2.5" /></svg>;
}
