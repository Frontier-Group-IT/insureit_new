"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  approvePolicyOcrTrainingLabel,
  runPolicyOcrTrainingLabel,
  submitPolicyOcrDatabaseComparison,
  type RunPolicyOcrTrainingState,
} from "../ocr-training-actions";
import {
  compareTrainingProposalToReference,
  compareTrainingValue,
  formatReviewerDate,
  type TrainingComparisonKey,
  type TrainingDatabaseReference,
  type TrainingProposal,
} from "@/lib/policy-ocr-training";

export type TrainingQueueRow = {
  documentId: string;
  labelId: string;
  fileName: string;
  uploadedAt: string;
  policyReference: string;
  linkedInsurer: string;
  status: "needs_review" | "reviewed" | "approved" | "rejected";
  processingStatus: "pending" | "processing" | "ready" | "failed" | "exhausted";
  processingAttempts: number;
  failureCode: string | null;
  proposal: TrainingProposal | null;
  databaseReference: TrainingDatabaseReference;
  parserId: string | null;
  parserVersion: string | null;
  proposedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
};

const FILTERS = ["all", "needs_review", "exact_match", "reviewed", "approved", "failed"] as const;
type Filter = (typeof FILTERS)[number];

export function TrainingReviewQueue({
  rows,
  actorId,
  canReview,
  canApprove,
}: {
  rows: TrainingQueueRow[];
  actorId: string;
  canReview: boolean;
  canApprove: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("needs_review");
  const [query, setQuery] = useState("");

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesFilter = filter === "all"
        || (filter === "failed"
          ? ["failed", "exhausted"].includes(row.processingStatus)
          : filter === "exact_match"
            ? isExactDatabaseMatch(row)
            : row.status === filter);
      const matchesQuery = !needle || `${row.fileName} ${row.policyReference} ${row.linkedInsurer}`.toLowerCase().includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, rows]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const count = rows.filter((row) => item === "all"
              || (item === "failed"
                ? ["failed", "exhausted"].includes(row.processingStatus)
                : item === "exact_match"
                  ? isExactDatabaseMatch(row)
                  : row.status === item)).length;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${filter === item ? "bg-navy-900 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {filterLabel(item)} · {count}
              </button>
            );
          })}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search file, policy or insurer"
          className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm md:w-80"
        />
      </div>

      <div className="space-y-4">
        {visibleRows.map((row) => (
          <TrainingReviewCard
            key={row.labelId}
            row={row}
            actorId={actorId}
            canReview={canReview}
            canApprove={canApprove}
          />
        ))}
        {!visibleRows.length ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No policy copies match this queue filter.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TrainingReviewCard({
  row,
  actorId,
  canReview,
  canApprove,
}: {
  row: TrainingQueueRow;
  actorId: string;
  canReview: boolean;
  canApprove: boolean;
}) {
  const proposal = row.proposal?.fields ?? {};
  const ready = row.processingStatus === "ready";
  const canOwnerApprove = canApprove && row.status === "reviewed" && row.reviewedBy !== actorId;
  const comparison = ready && row.proposal
    ? compareTrainingProposalToReference(row.proposal, row.databaseReference)
    : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-navy-900">{row.fileName}</p>
            <StatusBadge label={statusLabel(row)} tone={statusTone(row)} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Policy {row.policyReference} · {row.linkedInsurer} · {new Date(row.uploadedAt).toLocaleDateString("en-IN")}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {row.parserId ? `${row.parserId} · ${row.parserVersion ?? "version unavailable"}` : "Waiting for parser proposal"}
            {row.proposedAt ? ` · proposed ${new Date(row.proposedAt).toLocaleString("en-IN")}` : ""}
          </p>
        </div>
        <Link
          href={`/policies/ocr-training/documents/${row.documentId}/open`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700"
        >
          Open private copy ↗
        </Link>
      </div>

      {!ready ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span>
            {processingLabel(row.processingStatus)} · attempt {row.processingAttempts}/3
            {row.failureCode ? ` · ${row.failureCode.replaceAll("_", " ")}` : ""}
          </span>
          {canReview || canApprove ? (
            row.processingStatus !== "processing" ? (
          <OcrRunForm labelId={row.labelId} />
            ) : null
          ) : null}
        </div>
      ) : null}

      {row.proposal?.warnings.length ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-black uppercase tracking-wide text-amber-800">Parser warnings</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-amber-900">
            {row.proposal.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      ) : null}

      {ready && (canReview || canApprove) ? (
        <div className="mt-4 flex justify-end">
          <OcrRunForm labelId={row.labelId} rerun />
        </div>
      ) : null}

      {comparison ? (
        <div className={`mt-4 rounded-xl border p-3 text-sm ${comparison.exactMatch ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {comparison.exactMatch
            ? `Automatic comparison matched all ${comparison.comparableFields} stored Section 03 fields.`
            : `Automatic comparison found ${comparison.mismatchedFields} mismatches and ${comparison.missingOcrFields} OCR-missing fields across ${comparison.comparableFields} stored values.`}
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <div className="grid min-w-[820px] grid-cols-[170px_1fr_1fr_120px] bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500">
          <span>Section 03 field</span><span>Database reference</span><span>Google OCR</span><span>Result</span>
        </div>
        {comparisonField("insurer_name", "Insurer", row.databaseReference.insurer_name, proposal.insurer_name)}
        {comparisonField("policy_product", "Policy product", row.databaseReference.policy_product, proposal.policy_product)}
        {comparisonField("policy_number", "Policy number", row.databaseReference.policy_number, proposal.policy_number)}
        {comparisonField("valid_from", "Valid from", row.databaseReference.valid_from, proposal.policy_start_date, true)}
        {comparisonField("valid_upto", "Valid upto", row.databaseReference.valid_upto, proposal.policy_end_date, true)}
        {comparisonField("idv", "IDV", row.databaseReference.idv, proposal.idv)}
        {comparisonField("od_premium", "OD premium", row.databaseReference.od_premium, proposal.od_premium)}
        {comparisonField("tp_premium", "TP premium", row.databaseReference.tp_premium, proposal.tp_premium)}
        {comparisonField("cpa_opted", "CPA opted", row.databaseReference.cpa_opted, proposal.cpa_opted)}
        {comparisonField("cpa_premium", "CPA amount", row.databaseReference.cpa_premium, proposal.cpa_premium)}
        {comparisonField("printed_net_premium", "Printed net", row.databaseReference.printed_net_premium, proposal.total_premium)}
        {comparisonField("printed_gst", "Printed GST", row.databaseReference.printed_gst, proposal.tax_amount)}
        {comparisonField("printed_gross_premium", "Printed gross", row.databaseReference.printed_gross_premium, proposal.gross_premium)}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Existing Section 03 values are the reference. Google OCR is compared against them; no manual re-entry is required.
        </p>
        {canReview && ready && row.status === "needs_review" ? (
          <form action={submitPolicyOcrDatabaseComparison}>
            <input type="hidden" name="policy_document_id" value={row.documentId} />
            <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">
              Confirm database comparison
            </button>
          </form>
        ) : null}
      </div>

      {canApprove && row.status === "reviewed" ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm text-emerald-900">
            {row.reviewedBy === actorId
              ? "No self-approval: a different training owner must approve this review."
              : "Owner approval creates a sanitized candidate. It does not edit parser source."}
          </p>
          <form action={approvePolicyOcrTrainingLabel}>
            <input type="hidden" name="training_label_id" value={row.labelId} />
            <button disabled={!canOwnerApprove} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              Approve sanitized candidate
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

const INITIAL_OCR_RUN_STATE: RunPolicyOcrTrainingState = { status: "idle", message: null };

function OcrRunForm({ labelId, rerun = false }: { labelId: string; rerun?: boolean }) {
  const [state, formAction, pending] = useActionState(runPolicyOcrTrainingLabel, INITIAL_OCR_RUN_STATE);
  return (
    <form action={formAction} className="flex max-w-sm flex-col items-end gap-2">
      <input type="hidden" name="training_label_id" value={labelId} />
      <button
        disabled={pending}
        className={rerun
          ? "rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 disabled:cursor-wait disabled:opacity-60"
          : "rounded-lg bg-white px-3 py-2 text-xs font-bold text-amber-900 ring-1 ring-amber-300 disabled:cursor-wait disabled:opacity-60"}
      >
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

function comparisonField(
  key: TrainingComparisonKey,
  label: string,
  databaseValue: string | number | boolean | null,
  proposal: TrainingProposal["fields"][keyof TrainingProposal["fields"]],
  date = false,
) {
  const ocrValue = proposal?.value ?? null;
  const comparison = compareTrainingValue(key, databaseValue, ocrValue);
  return (
    <div className="grid min-w-[820px] grid-cols-[170px_1fr_1fr_120px] items-center border-t border-slate-100 px-3 py-2">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-navy-900">{formatValue(databaseValue, date)}</span>
      <ProposalValue field={proposal} />
      <span className={`text-xs font-black uppercase ${comparison === "match" ? "text-emerald-700" : comparison === "mismatch" ? "text-amber-700" : "text-slate-400"}`}>
        {comparison === "match" ? "Match" : comparison === "mismatch" ? "Review" : comparison === "ocr_missing" ? "OCR missing" : "Not stored"}
      </span>
    </div>
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
  return filter === "all" ? "All" : filter === "needs_review" ? "Needs review" : filter === "exact_match" ? "Exact match" : filter === "reviewed" ? "Awaiting owner" : filter === "approved" ? "Approved" : "Failed";
}

function statusLabel(row: TrainingQueueRow) {
  if (row.processingStatus !== "ready") return processingLabel(row.processingStatus);
  if (isExactDatabaseMatch(row) && row.status === "needs_review") return "Exact database match";
  return row.status === "reviewed" ? "Awaiting owner" : row.status.replaceAll("_", " ");
}

function processingLabel(status: TrainingQueueRow["processingStatus"]) {
  return status === "pending" ? "Not run" : status === "processing" ? "Reading copy" : status === "ready" ? "Proposal ready" : status === "failed" ? "Previous run failed" : "Previous run exhausted";
}

function statusTone(row: TrainingQueueRow) {
  if (["failed", "exhausted"].includes(row.processingStatus) || row.status === "rejected") return "red";
  if (row.status === "approved" || isExactDatabaseMatch(row)) return "green";
  if (row.status === "reviewed") return "blue";
  return "amber";
}

function isExactDatabaseMatch(row: TrainingQueueRow) {
  if (row.processingStatus !== "ready" || !row.proposal) return false;
  return compareTrainingProposalToReference(row.proposal, row.databaseReference).exactMatch;
}

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  const classes = tone === "green"
    ? "bg-emerald-100 text-emerald-800"
    : tone === "red"
      ? "bg-red-100 text-red-800"
      : tone === "blue"
        ? "bg-blue-100 text-blue-800"
        : "bg-amber-100 text-amber-800";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${classes}`}>{label}</span>;
}
