"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  approvePolicyOcrTrainingLabel,
  retryPolicyOcrTrainingLabel,
  savePolicyOcrTrainingReview,
} from "../ocr-training-actions";
import { formatReviewerDate, type TrainingProposal } from "@/lib/policy-ocr-training";

type Corrections = {
  insurer_name: string | null;
  policy_product: string | null;
  policy_number: string | null;
  valid_from: string | null;
  valid_upto: string | null;
  idv: number | null;
  od_premium: number | null;
  tp_premium: number | null;
  cpa_opted: boolean | null;
  cpa_premium: number | null;
  printed_net_premium: number | null;
  printed_gst: number | null;
  printed_gross_premium: number | null;
  evidence_note: string | null;
};

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
  parserId: string | null;
  parserVersion: string | null;
  proposedAt: string | null;
  corrections: Corrections;
  reviewedBy: string | null;
  reviewedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
};

const FILTERS = ["all", "needs_review", "reviewed", "approved", "failed"] as const;
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
        || (filter === "failed" ? ["failed", "exhausted"].includes(row.processingStatus) : row.status === filter);
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
              || (item === "failed" ? ["failed", "exhausted"].includes(row.processingStatus) : row.status === item)).length;
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
          {canReview && ["failed", "exhausted"].includes(row.processingStatus) ? (
            <form action={retryPolicyOcrTrainingLabel}>
              <input type="hidden" name="training_label_id" value={row.labelId} />
              <button className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-amber-900 ring-1 ring-amber-300">
                Retry automatic OCR
              </button>
            </form>
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

      <form action={savePolicyOcrTrainingReview} className="mt-4">
        <input type="hidden" name="policy_document_id" value={row.documentId} />
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <div className="grid min-w-[760px] grid-cols-[180px_1fr_1fr] bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500">
            <span>Section 03 field</span><span>OCR proposal</span><span>Reviewer correction</span>
          </div>
          {reviewField("Insurer", "insurer_name", proposal.insurer_name, value(row, "insurer_name"), canReview && ready)}
          {reviewField("Policy product", "policy_product", proposal.policy_product, value(row, "policy_product"), canReview && ready)}
          {reviewField("Policy number", "policy_number", proposal.policy_number, value(row, "policy_number"), canReview && ready)}
          {reviewField("Valid from", "valid_from", proposal.policy_start_date, dateValue(row, "valid_from", proposal.policy_start_date?.value), canReview && ready, true)}
          {reviewField("Valid upto", "valid_upto", proposal.policy_end_date, dateValue(row, "valid_upto", proposal.policy_end_date?.value), canReview && ready, true)}
          {reviewField("IDV", "idv", proposal.idv, value(row, "idv"), canReview && ready, false, "decimal")}
          {reviewField("OD premium", "od_premium", proposal.od_premium, value(row, "od_premium"), canReview && ready, false, "decimal")}
          {reviewField("TP premium", "tp_premium", proposal.tp_premium, value(row, "tp_premium"), canReview && ready, false, "decimal")}
          {reviewField("CPA amount", "cpa_premium", proposal.cpa_premium, value(row, "cpa_premium"), canReview && ready, false, "decimal")}
          {reviewField("Printed net", "printed_net_premium", proposal.total_premium, value(row, "printed_net_premium"), canReview && ready, false, "decimal")}
          {reviewField("Printed GST", "printed_gst", proposal.tax_amount, value(row, "printed_gst"), canReview && ready, false, "decimal")}
          {reviewField("Printed gross", "printed_gross_premium", proposal.gross_premium, value(row, "printed_gross_premium"), canReview && ready, false, "decimal")}
          <div className="grid min-w-[760px] grid-cols-[180px_1fr_1fr] items-center border-t border-slate-100 px-3 py-2">
            <span className="text-xs font-bold text-slate-600">CPA opted</span>
            <ProposalValue field={proposal.cpa_opted} />
            <select
              name="cpa_opted"
              disabled={!canReview || !ready}
              defaultValue={row.corrections.cpa_opted === null ? (proposal.cpa_opted?.value.toLowerCase() === "yes" ? "yes" : "no") : row.corrections.cpa_opted ? "yes" : "no"}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            >
              <option value="no">No</option><option value="yes">Yes</option>
            </select>
          </div>
        </div>

        <label className="mt-3 block text-xs font-bold text-slate-600">
          Bounded evidence note
          <textarea
            name="evidence_note"
            defaultValue={row.corrections.evidence_note ?? ""}
            disabled={!canReview || !ready}
            required
            className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            placeholder="Reference labels or rows only. Do not paste raw OCR, names, registration, phone, address or identifiers."
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Dates are entered as DD/MM/YYYY and normalized to ISO dates on the server.
          </p>
          {canReview ? (
            <div className="flex gap-2">
              <button name="decision" value="rejected" disabled={!ready} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50">
                Reject sample
              </button>
              <button name="decision" value="reviewed" disabled={!ready} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                Submit reviewer correction
              </button>
            </div>
          ) : null}
        </div>
      </form>

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

function reviewField(
  label: string,
  name: string,
  proposal: TrainingProposal["fields"][keyof TrainingProposal["fields"]],
  correction: string,
  enabled: boolean,
  date = false,
  inputMode?: "decimal",
) {
  return (
    <div className="grid min-w-[760px] grid-cols-[180px_1fr_1fr] items-center border-t border-slate-100 px-3 py-2">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <ProposalValue field={proposal} />
      <input
        name={name}
        defaultValue={correction}
        disabled={!enabled}
        inputMode={date ? "numeric" : inputMode}
        pattern={date ? "\\d{2}/\\d{2}/\\d{4}" : undefined}
        placeholder={date ? "DD/MM/YYYY" : undefined}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
      />
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

function value(row: TrainingQueueRow, key: keyof Corrections) {
  const correction = row.corrections[key];
  if (correction !== null && correction !== undefined && typeof correction !== "boolean") return String(correction);
  const proposalKey = correctionProposalKey(key);
  return proposalKey ? row.proposal?.fields[proposalKey]?.value ?? "" : "";
}

function dateValue(row: TrainingQueueRow, key: "valid_from" | "valid_upto", proposal: string | undefined) {
  return formatReviewerDate(row.corrections[key] ?? proposal ?? null);
}

function correctionProposalKey(key: keyof Corrections): keyof TrainingProposal["fields"] | null {
  const map: Partial<Record<keyof Corrections, keyof TrainingProposal["fields"]>> = {
    insurer_name: "insurer_name",
    policy_product: "policy_product",
    policy_number: "policy_number",
    idv: "idv",
    od_premium: "od_premium",
    tp_premium: "tp_premium",
    cpa_premium: "cpa_premium",
    printed_net_premium: "total_premium",
    printed_gst: "tax_amount",
    printed_gross_premium: "gross_premium",
  };
  return map[key] ?? null;
}

function filterLabel(filter: Filter) {
  return filter === "all" ? "All" : filter === "needs_review" ? "Needs review" : filter === "reviewed" ? "Awaiting owner" : filter === "approved" ? "Approved" : "Failed";
}

function statusLabel(row: TrainingQueueRow) {
  if (row.processingStatus !== "ready") return processingLabel(row.processingStatus);
  return row.status === "reviewed" ? "Awaiting owner" : row.status.replaceAll("_", " ");
}

function processingLabel(status: TrainingQueueRow["processingStatus"]) {
  return status === "pending" ? "Queued" : status === "processing" ? "Reading copy" : status === "ready" ? "Proposal ready" : status === "failed" ? "Retry scheduled" : "Retry limit reached";
}

function statusTone(row: TrainingQueueRow) {
  if (["failed", "exhausted"].includes(row.processingStatus) || row.status === "rejected") return "red";
  if (row.status === "approved") return "green";
  if (row.status === "reviewed") return "blue";
  return "amber";
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
