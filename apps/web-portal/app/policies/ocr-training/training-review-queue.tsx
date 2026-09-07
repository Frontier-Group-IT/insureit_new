"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { runPolicyOcrTrainingLabel, submitPolicyOcrDatabaseComparison, type ConfirmPolicyOcrTrainingState, type RunPolicyOcrTrainingState } from "../ocr-training-actions";
import { assignPolicyOcrReviewTask, completePolicyOcrReviewTask, type AssignPolicyOcrReviewState, type ReviewerChecklistState, startPolicyOcrReviewTask } from "../ocr-training-review-actions";
import { compareTrainingProposalToReference, compareTrainingValue, formatReviewerDate, type TrainingComparisonKey, type TrainingDatabaseReference, type TrainingProposal } from "@/lib/policy-ocr-training";
import { createPolicyOcrProposalFromFeedback } from "../ocr-training-orchestrator-actions";

export type TrainingQueueRow = { documentId: string; labelId: string; fileName: string; uploadedAt: string; policyReference: string; linkedInsurer: string; status: "needs_review" | "reviewed" | "approved" | "rejected"; processingStatus: "pending" | "processing" | "ready" | "failed" | "exhausted"; processingAttempts: number; failureCode: string | null; proposal: TrainingProposal | null; databaseReference: TrainingDatabaseReference; parserId: string | null; parserVersion: string | null; proposedAt: string | null; reviewedBy: string | null; reviewedAt: string | null; approvedBy: string | null; approvedAt: string | null; reviewTask: ReviewTask | null };

type ReviewTask = {
  id: string;
  status: "assigned" | "in_review" | "completed" | "rejected" | "cancelled";
  checklist: Record<string, boolean>;
  reviewer_note: string | null;
  assigned_at: string;
  completed_at: string | null;
  field_questions: Array<{ key: string; issue: string; prompt: string; allowedAnswers: string[] }>;
  policy_ocr_training_review_notifications: Array<{ status: "pending" | "sent" | "failed"; attempts: number; sent_at: string | null }> | null;
};

const FILTERS = ["all", "needs_review", "exact_match", "reviewed", "approved", "failed"] as const;
type Filter = (typeof FILTERS)[number];

export function TrainingReviewQueue({ rows, canTrain, canAssign, selectedDocumentId }: { rows: TrainingQueueRow[]; canTrain: boolean; canAssign: boolean; selectedDocumentId?: string }) {
  const [filter, setFilter] = useState<Filter>("needs_review");
  const [query, setQuery] = useState("");

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesFilter = filter === "all" || (filter === "failed" ? ["failed", "exhausted"].includes(row.processingStatus) : filter === "exact_match" ? isExactDatabaseMatch(row) : effectiveStatus(row) === filter);
      const matchesQuery = !needle || `${row.fileName} ${row.policyReference} ${row.linkedInsurer}`.toLowerCase().includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, rows]);

  const selectedRow = selectedDocumentId ? rows.find((row) => row.documentId === selectedDocumentId) : null;
  if (selectedDocumentId) {
    return selectedRow ? (
      <div>
        <Link href="/policies/ocr-training" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700">← Back to policy queue</Link>
        <TrainingReviewCard row={selectedRow} canTrain={canTrain} canAssign={canAssign} />
      </div>
    ) : <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">This policy copy is not available in your training queue.</div>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const count = rows.filter((row) => item === "all" || (item === "failed" ? ["failed", "exhausted"].includes(row.processingStatus) : item === "exact_match" ? isExactDatabaseMatch(row) : effectiveStatus(row) === item)).length;
            return (
              <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-lg px-3 py-2 text-xs font-bold ${filter === item ? "bg-navy-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                {filterLabel(item)} · {count}
              </button>
            );
          })}
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search file, policy or insurer" className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm md:w-80" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="hidden grid-cols-[minmax(220px,1.7fr)_minmax(150px,1fr)_minmax(130px,1fr)_120px_110px] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500 md:grid">
          <span>Policy copy</span><span>Insurer</span><span>OCR status</span><span>Review</span><span>Updated</span>
        </div>
        {visibleRows.map((row) => {
          const comparison = row.processingStatus === "ready" && row.proposal ? compareTrainingProposalToReference(row.proposal, row.databaseReference) : null;
          return (
            <Link key={row.labelId} href={`/policies/ocr-training?document=${encodeURIComponent(row.documentId)}`} className="grid gap-2 border-t border-slate-100 px-4 py-3 transition hover:bg-blue-50/50 md:grid-cols-[minmax(220px,1.7fr)_minmax(150px,1fr)_minmax(130px,1fr)_120px_110px] md:items-center">
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-navy-900">{row.fileName}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">Policy {row.policyReference} · {new Date(row.uploadedAt).toLocaleDateString("en-IN")}</span>
              </span>
              <span className="text-xs font-semibold text-slate-700">{row.linkedInsurer}</span>
              <span><StatusBadge label={statusLabel(row)} tone={statusTone(row)} /></span>
              <span className="text-xs text-slate-600">{comparison ? comparison.exactMatch ? "Exact match" : `${comparison.mismatchedFields} review · ${comparison.missingOcrFields} missing` : processingLabel(row.processingStatus)}</span>
              <span className="text-xs font-bold text-blue-700">Open review →</span>
            </Link>
          );
        })}
        {!visibleRows.length ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No policy copies match this queue filter.</div> : null}
      </div>
    </div>
  );
}

function TrainingReviewCard({ row, canTrain, canAssign }: { row: TrainingQueueRow; canTrain: boolean; canAssign: boolean }) {
  const proposal = row.proposal?.fields ?? {};
  const ready = row.processingStatus === "ready";
  const comparison = ready && row.proposal ? compareTrainingProposalToReference(row.proposal, row.databaseReference) : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-navy-900">{row.fileName}</p>
            <StatusBadge label={statusLabel(row)} tone={statusTone(row)} />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Policy {row.policyReference} · {row.linkedInsurer} · {new Date(row.uploadedAt).toLocaleDateString("en-IN")}
          </p>
        </div>
        <Link href={`/policies/ocr-training/documents/${row.documentId}/open`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700">
          Open private copy ↗
        </Link>
      </div>

      {canAssign && isIffcoPackage(row) ? <ReviewerAssignmentForm labelId={row.labelId} task={row.reviewTask} /> : row.reviewTask ? <ReviewerChecklistForm task={row.reviewTask} canTrain={canTrain} /> : null}

      {!ready ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>
            {processingLabel(row.processingStatus)} · attempt {row.processingAttempts}/3
            {row.failureCode ? ` · ${row.failureCode.replaceAll("_", " ")}` : ""}
          </span>
          {canTrain ? row.processingStatus !== "processing" ? <OcrRunForm labelId={row.labelId} /> : null : null}
        </div>
      ) : null}

      {row.proposal?.warnings.length ? (
        <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <summary className="cursor-pointer font-semibold">Parser warnings · {row.proposal.warnings.length}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {row.proposal.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </details>
      ) : null}

      {ready && canTrain ? (
        <div className="mt-4 flex justify-end">
          <OcrRunForm labelId={row.labelId} rerun />
        </div>
      ) : null}

      {comparison ? <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${comparison.exactMatch ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{comparison.exactMatch ? `Comparison matched ${comparison.comparableFields} stored fields.` : `${comparison.mismatchedFields} mismatches · ${comparison.missingOcrFields} OCR missing · ${comparison.comparableFields} stored fields.`}</div> : null}

      <ReviewerComparisonTables row={row} proposal={proposal} comparison={comparison} />

      <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
        {canTrain && ready && (row.status === "needs_review" || row.status === "reviewed") ? <TrainingConfirmationForm documentId={row.documentId} /> : null}
      </div>
    </section>
  );
}

function ReviewerComparisonTables({ row, proposal, comparison }: { row: TrainingQueueRow; proposal: TrainingProposal["fields"]; comparison: ReturnType<typeof compareTrainingProposalToReference> | null }) {
  const task = row.reviewTask;
  const [state, formAction, pending] = useActionState(completePolicyOcrReviewTask, INITIAL_CHECKLIST_STATE);
  const reviewOpen = task?.status === "in_review";
  const content = (
    <>
      <ComparisonSection title="Section 02 · Vehicle details">
        {comparisonField("vehicle_registration_status", "Registration status", row.databaseReference.vehicle_registration_status, proposal.vehicle_registration_status, false, task, comparison)}
        {comparisonField("vehicle_registration_number", "Registration number", row.databaseReference.vehicle_registration_number, proposal.vehicle_registration_number, false, task, comparison)}
        {comparisonField("vehicle_class", "Vehicle class", row.databaseReference.vehicle_class, proposal.vehicle_class, false, task, comparison)}
        {comparisonField("vehicle_make", "Make", row.databaseReference.vehicle_make, proposal.vehicle_make, false, task, comparison)}
        {comparisonField("vehicle_model", "Model", row.databaseReference.vehicle_model, proposal.vehicle_model, false, task, comparison)}
        {comparisonField("vehicle_fuel_type", "Fuel type", row.databaseReference.vehicle_fuel_type, proposal.vehicle_fuel_type, false, task, comparison)}
        {comparisonField("vehicle_manufacturing_year", "Manufacturing year", row.databaseReference.vehicle_manufacturing_year, proposal.vehicle_manufacturing_year, false, task, comparison)}
        {comparisonField("vehicle_capacity", "Class-aware capacity", row.databaseReference.vehicle_capacity, proposal.vehicle_capacity, false, task, comparison)}
        {comparisonField("vehicle_chassis_number", "Chassis number", row.databaseReference.vehicle_chassis_number, proposal.vehicle_chassis_number, false, task, comparison)}
        {comparisonField("vehicle_engine_number", "Engine number", row.databaseReference.vehicle_engine_number, proposal.vehicle_engine_number, false, task, comparison)}
        {comparisonField("vehicle_rto_name", "RTO name", row.databaseReference.vehicle_rto_name, proposal.vehicle_rto_name, false, task, comparison)}
        {comparisonField("vehicle_rto_state", "RTO state", row.databaseReference.vehicle_rto_state, proposal.vehicle_rto_state, false, task, comparison)}
      </ComparisonSection>

      <ComparisonSection title="Section 03 · Policy and premium">
        {comparisonField("insurer_name", "Insurer", row.databaseReference.insurer_name, proposal.insurer_name, false, task, comparison)}
        {comparisonField("policy_product", "Policy product", row.databaseReference.policy_product, proposal.policy_product, false, task, comparison)}
        {comparisonField("policy_number", "Policy number", row.databaseReference.policy_number, proposal.policy_number, false, task, comparison)}
        {comparisonField("valid_from", "Valid from", row.databaseReference.valid_from, proposal.policy_start_date, true, task, comparison)}
        {comparisonField("valid_upto", "Valid upto", row.databaseReference.valid_upto, proposal.policy_end_date, true, task, comparison)}
        {comparisonField("idv", "IDV", row.databaseReference.idv, proposal.idv, false, task, comparison)}
        {comparisonField("od_premium", "OD premium", row.databaseReference.od_premium, proposal.od_premium, false, task, comparison)}
        {comparisonField("tp_premium", "TP premium", row.databaseReference.tp_premium, proposal.tp_premium, false, task, comparison)}
        {comparisonField("cpa_opted", "CPA opted", row.databaseReference.cpa_opted, proposal.cpa_opted, false, task, comparison)}
        {comparisonField("cpa_premium", "CPA amount", row.databaseReference.cpa_premium, proposal.cpa_premium, false, task, comparison)}
        {comparisonField("printed_net_premium", "Printed net", row.databaseReference.printed_net_premium, proposal.total_premium, false, task, comparison)}
        {comparisonField("printed_gst", "Printed GST", row.databaseReference.printed_gst, proposal.tax_amount, false, task, comparison)}
        {comparisonField("printed_gross_premium", "Printed gross", row.databaseReference.printed_gross_premium, proposal.gross_premium, false, task, comparison)}
      </ComparisonSection>
      {reviewOpen ? (
        <>
          <label className="mt-3 block text-xs font-semibold text-violet-950">
            Optional safe review note
            <textarea name="reviewer_note" maxLength={500} className="mt-1 min-h-16 w-full rounded-lg border border-violet-200 bg-white p-2 text-sm font-normal text-slate-900" placeholder="Do not include policy, vehicle or customer identifiers." />
          </label>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-violet-900">Choose one answer for every row marked Review, OCR missing, or Not stored.</p>
            <button disabled={pending} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{pending ? "Saving answers…" : "Submit answers"}</button>
          </div>
          {state.message ? <p className={`mt-2 text-xs font-semibold ${state.status === "success" ? "text-emerald-700" : "text-red-700"}`} role="status">{state.message}</p> : null}
        </>
      ) : null}
    </>
  );
  return reviewOpen && task ? <form action={formAction}><input type="hidden" name="review_task_id" value={task.id} />{content}</form> : content;
}

function ComparisonSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
      <div className="grid min-w-[820px] grid-cols-[170px_1fr_1fr_120px] bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500">
        <span>{title}</span>
        <span>Database reference</span>
        <span>Google OCR</span>
        <span>Result</span>
      </div>
      {children}
    </div>
  );
}

const INITIAL_OCR_RUN_STATE: RunPolicyOcrTrainingState = { status: "idle", message: null };
const INITIAL_CONFIRM_STATE: ConfirmPolicyOcrTrainingState = { status: "idle", message: null };

function TrainingConfirmationForm({ documentId }: { documentId: string }) {
  const [state, formAction, pending] = useActionState(submitPolicyOcrDatabaseComparison, INITIAL_CONFIRM_STATE);
  return (
    <form action={formAction} className="flex max-w-sm flex-col items-end gap-2">
      <input type="hidden" name="policy_document_id" value={documentId} />
      <button disabled={pending} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">
        {pending ? "Approving training…" : "Confirm comparison & approve training"}
      </button>
      {state.message ? (
        <span className={`text-right text-xs font-semibold ${state.status === "success" ? "text-emerald-700" : "text-red-700"}`} role="status">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

function OcrRunForm({ labelId, rerun = false }: { labelId: string; rerun?: boolean }) {
  const [state, formAction, pending] = useActionState(runPolicyOcrTrainingLabel, INITIAL_OCR_RUN_STATE);
  return (
    <form action={formAction} className="flex max-w-sm flex-col items-end gap-2">
      <input type="hidden" name="training_label_id" value={labelId} />
      <button disabled={pending} className={rerun ? "rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 disabled:cursor-wait disabled:opacity-60" : "rounded-lg bg-white px-3 py-2 text-xs font-bold text-amber-900 ring-1 ring-amber-300 disabled:cursor-wait disabled:opacity-60"}>
        {pending ? "Reading with Google Cloud…" : rerun ? "Re-run with Google Cloud" : "Run with Google Cloud"}
      </button>
      {state.message ? (
        <span className={`text-right text-xs font-semibold ${state.status === "success" ? "text-emerald-700" : "text-red-700"}`} role="status">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

const INITIAL_ASSIGN_STATE: AssignPolicyOcrReviewState = { status: "idle", message: null };

function ReviewerAssignmentForm({ labelId, task }: { labelId: string; task: ReviewTask | null }) {
  const [state, formAction, pending] = useActionState(assignPolicyOcrReviewTask, INITIAL_ASSIGN_STATE);
  const notification = task?.policy_ocr_training_review_notifications?.[0] ?? null;
  return (
    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-blue-950">
          <strong>Human PDF review:</strong>{" "}
          {task ? `${task.status.replaceAll("_", " ")} · notification ${notification?.status ?? "pending"}` : "not assigned"}
        </div>
        {notification?.status === "failed" ? <span className="text-[11px] font-semibold text-red-700">Notification failed; retry after checking Resend.</span> : null}
      </div>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="training_label_id" value={labelId} />
        <label className="text-xs font-semibold text-blue-950">
          Existing portal-user email
          <input name="reviewer_email" type="email" defaultValue="anju@insureit.in" required className="mt-1 h-9 w-64 rounded-lg border border-blue-200 bg-white px-2 text-sm font-normal text-slate-900" />
        </label>
        <button disabled={pending} className="h-9 rounded-lg bg-blue-700 px-3 text-xs font-bold text-white disabled:opacity-60">
          {pending ? "Assigning…" : task ? "Assign / notify" : "Assign reviewer"}
        </button>
      </form>
      {state.message ? <p className={`mt-2 text-xs font-semibold ${state.status === "success" ? "text-emerald-700" : "text-red-700"}`} role="status">{state.message}</p> : null}
    </div>
  );
}

const INITIAL_CHECKLIST_STATE: ReviewerChecklistState = { status: "idle", message: null };

function ReviewerChecklistForm({ task, canTrain }: { task: ReviewTask; canTrain: boolean }) {
  const [startState, startAction, startPending] = useActionState(startPolicyOcrReviewTask, INITIAL_CHECKLIST_STATE);
  const isStarted = task.status !== "assigned" || startState.status === "success";
  if (task.status === "completed") {
    return <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">Reviewer questions completed. The authorized operator still controls sanitized training approval.
      {canTrain && task.field_questions?.length ? <form action={createPolicyOcrProposalFromFeedback} className="mt-2"><input type="hidden" name="review_task_id" value={task.id} /><button className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Generate sanitized candidate proposal</button></form> : null}
    </div>;
  }
  return (
    <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-wide text-violet-900">Review status</p>
        {!isStarted ? (
          <form action={startAction}>
            <input type="hidden" name="review_task_id" value={task.id} />
            <button disabled={startPending} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{startPending ? "Starting…" : "Start review"}</button>
          </form>
        ) : null}
      </div>
      {isStarted ? <p className="mt-1 text-[11px] text-violet-900">Decisions are available beside the compared values below.</p> : null}
      {startState.message ? <p className="mt-2 text-xs font-semibold text-red-700" role="status">{startState.message}</p> : null}
    </div>
  );
}

function answerLabel(answer: string) {
  return answer === "ocr_correct" ? "The OCR value is correct"
    : answer === "database_correct" ? "The database reference is correct"
      : answer === "provide_correct_value" ? "Provide the correct value"
        : "Withhold this value";
}

function comparisonField(key: TrainingComparisonKey, label: string, databaseValue: string | number | boolean | null, proposal: TrainingProposal["fields"][keyof TrainingProposal["fields"]], date = false, task: ReviewTask | null = null, summary: ReturnType<typeof compareTrainingProposalToReference> | null = null) {
  const ocrValue = proposal?.value ?? null;
  const result = compareTrainingValue(key, databaseValue, ocrValue);
  const question = task?.field_questions?.find((item) => item.key === key);
  const showDecision = Boolean(question && summary && summary.fields[key] !== "match" && task?.status === "in_review");
  return (
    <div className="grid min-w-[820px] grid-cols-[170px_1fr_1fr_120px] items-center border-t border-slate-100 px-3 py-2">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <ValueChoice keyName={key} value={formatValue(databaseValue, date)} answer="database_correct" enabled={Boolean(showDecision && question?.allowedAnswers.includes("database_correct"))} />
      <ValueChoice keyName={key} value={<ProposalValue field={proposal} />} answer="ocr_correct" enabled={Boolean(showDecision && question?.allowedAnswers.includes("ocr_correct"))} />
      <span className="text-xs font-black uppercase text-slate-400">{result === "match" ? "Match" : result === "mismatch" ? "Review" : result === "ocr_missing" ? "OCR missing" : "Not stored"}</span>
      {showDecision ? <ReviewDecisionControls keyName={key} answers={question?.allowedAnswers ?? []} /> : null}
    </div>
  );
}

function ValueChoice({ keyName, value, answer, enabled }: { keyName: string; value: ReactNode; answer: string; enabled: boolean }) {
  return <span className="relative pr-2 text-sm font-semibold text-navy-900">{enabled ? <label className="mr-1 inline-flex cursor-pointer items-center align-middle" title={answerLabel(answer)}><input type="radio" name={`answer_${keyName}`} value={answer} required className="peer sr-only" /><span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-transparent peer-checked:border-emerald-600 peer-checked:bg-emerald-600 peer-checked:text-white">✓</span><span className="sr-only">{answerLabel(answer)}</span></label> : null}{value}</span>;
}

function ReviewDecisionControls({ keyName, answers }: { keyName: string; answers: string[] }) {
  const alternateAnswers = answers.filter((answer) => !["database_correct", "ocr_correct"].includes(answer));
  return (
    <fieldset className="col-span-full mt-1 flex flex-wrap items-center gap-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-950">
      <legend className="sr-only">Decision for {keyName}</legend>
      {alternateAnswers.map((answer) => <label key={answer} className="inline-flex items-center gap-1"><input type="radio" name={`answer_${keyName}`} value={answer} required />{answerLabel(answer)}</label>)}
      {answers.includes("provide_correct_value") ? <input name={`correct_value_${keyName}`} maxLength={120} className="h-7 min-w-48 flex-1 rounded border border-amber-200 bg-white px-2 text-[11px] text-slate-900" placeholder="Correct sanitized value" /> : null}
    </fieldset>
  );
}

function ProposalValue({ field }: { field: TrainingProposal["fields"][keyof TrainingProposal["fields"]] }) {
  if (!field) return <span className="text-sm text-slate-400">Not proposed</span>;
  return (
    <span className="pr-4 text-sm text-slate-800">
      <span className="font-semibold">{field.value}</span>
      <span className="mt-0.5 block text-[11px] text-slate-500">
        {field.confidence === null ? "Confidence unavailable" : `${Math.round(field.confidence * 100)}% confidence`} · {field.evidence}
      </span>
    </span>
  );
}

function formatValue(value: string | number | boolean | null, date: boolean) {
  if (value === null) return "Not stored";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return date ? formatReviewerDate(String(value)) : String(value);
}

function filterLabel(filter: Filter) {
  return filter === "all" ? "All" : filter === "needs_review" ? "Needs review" : filter === "exact_match" ? "Exact match" : filter === "reviewed" ? "Ready to approve" : filter === "approved" ? "Approved" : "Failed";
}

function statusLabel(row: TrainingQueueRow) {
  if (row.processingStatus !== "ready") return processingLabel(row.processingStatus);
  if (isExactDatabaseMatch(row) && row.status === "needs_review") return "Exact database match";
  return effectiveStatus(row) === "reviewed" ? "Reviewed" : effectiveStatus(row).replaceAll("_", " ");
}

function processingLabel(status: TrainingQueueRow["processingStatus"]) {
  return status === "pending" ? "Not run" : status === "processing" ? "Reading copy" : status === "ready" ? "Proposal ready" : status === "failed" ? "Previous run failed" : "Previous run exhausted";
}

function statusTone(row: TrainingQueueRow) {
  if (["failed", "exhausted"].includes(row.processingStatus) || row.status === "rejected") return "red";
  if (row.status === "approved" || isExactDatabaseMatch(row)) return "green";
  if (effectiveStatus(row) === "reviewed") return "blue";
  return "amber";
}

function effectiveStatus(row: TrainingQueueRow): TrainingQueueRow["status"] {
  return row.reviewTask?.status === "completed" && row.status === "needs_review" ? "reviewed" : row.status;
}

function isExactDatabaseMatch(row: TrainingQueueRow) {
  if (row.processingStatus !== "ready" || !row.proposal) return false;
  return compareTrainingProposalToReference(row.proposal, row.databaseReference).exactMatch;
}

function isIffcoPackage(row: TrainingQueueRow) {
  return /iffco/i.test(row.linkedInsurer) && /^package$/i.test(row.databaseReference.policy_product ?? "");
}

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  const classes = tone === "green" ? "bg-emerald-100 text-emerald-800" : tone === "red" ? "bg-red-100 text-red-800" : tone === "blue" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${classes}`}>{label}</span>;
}
