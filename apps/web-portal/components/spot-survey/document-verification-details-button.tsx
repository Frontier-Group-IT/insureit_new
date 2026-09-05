"use client";

import { Eye } from "lucide-react";
import { useState } from "react";
import type { SpotSurveyDocument, SpotSurveyVerification } from "./spot-survey-workspace-v2";

type DetailRow = { label: string; dateKey?: string; statusKey?: string; valueKey?: string };

const rcRows: DetailRow[] = [
  { label: "Fitness", dateKey: "fitness_valid_upto", statusKey: "fitness_status" },
  { label: "Tax", dateKey: "tax_valid_upto", statusKey: "tax_status" },
  { label: "Insurance", dateKey: "insurance_valid_upto", statusKey: "insurance_status" },
  { label: "PUCC", dateKey: "pucc_valid_upto", statusKey: "pucc_status" },
  { label: "Local Permit", dateKey: "local_permit_valid_upto", statusKey: "local_permit_status" },
  { label: "National Permit", dateKey: "national_permit_valid_upto", statusKey: "national_permit_status" }
];

const insuranceRows: DetailRow[] = [
  { label: "Insurance Start Date", dateKey: "insurance_start_date" },
  { label: "Insurance End Date", dateKey: "insurance_end_date", statusKey: "policy_status" },
  { label: "NCB Verification", valueKey: "ncb_verified" },
  { label: "GVW Mention in Kgs", valueKey: "gvw_kg" },
  { label: "Policy Type", valueKey: "policy_type_check" }
];

export function DocumentVerificationDetailsButton({ document, verification, title }: { document: SpotSurveyDocument; verification: SpotSurveyVerification; title: string }) {
  const [open, setOpen] = useState(false);
  const details = verification.details ?? {};
  const verificationType = verification.verification_type;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-document-action="view"
        aria-label="View details"
        title="View details"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-transparent bg-transparent text-[#174EA6] transition hover:bg-[#F4F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174EA6]/30"
      >
        <Eye aria-hidden="true" size={17} strokeWidth={2} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#071D49]/45 px-4 py-5">
          <div className="flex max-h-[92vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(7,29,73,0.26)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#E6EEF7] px-5 py-4">
              <div>
                <h2 className="text-[20px] font-semibold text-[#071D49]">{title} - Verification Details</h2>
                <p className="mt-1 text-[12px] text-[#526178]">{document.file_name}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-[28px] leading-none text-[#071D49]">×</button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <VerificationSummary verification={verification} />
              {verificationType === "rc" ? <VerificationTable title="Documents Validity Check" rows={rcRows} details={details} /> : null}
              {verificationType === "insurance" ? <VerificationTable title="Insurance Verification" rows={insuranceRows} details={details} /> : null}
              {verificationType !== "rc" && verificationType !== "insurance" ? <GenericDetails details={details} /> : null}
              <Remarks details={details} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function VerificationSummary({ verification }: { verification: SpotSurveyVerification }) {
  return <div className={`mb-4 rounded-xl border p-3 ${verification.is_valid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}><div className="flex items-center justify-between gap-3"><p className="text-[13px] font-semibold text-[#071D49]">Verification Result</p><span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${verification.is_valid ? "border-green-200 bg-white text-green-700" : "border-red-200 bg-white text-red-700"}`}>{verification.is_valid ? "Valid / Verified" : "Invalid"}</span></div><div className="mt-2 grid gap-2 text-[12px] sm:grid-cols-2"><InfoMini label="Incident Date" value={formatDate(verification.incident_date)} /><InfoMini label="Verified On" value={formatDateTime(verification.created_at)} /></div>{verification.invalid_reason ? <p className="mt-2 text-[12px] font-semibold text-red-700">{verification.invalid_reason}</p> : null}</div>;
}

function VerificationTable({ title, rows, details }: { title: string; rows: DetailRow[]; details: Record<string, unknown> }) {
  return <section className="mb-4 rounded-xl border border-[#D9E3F0] bg-white"><div className="border-b border-[#E6EEF7] px-4 py-3"><h3 className="text-[14px] font-semibold text-[#071D49]">{title}</h3></div><div className="divide-y divide-[#EEF2F7]">{rows.map((row) => { const value = row.dateKey ? formatDate(display(details[row.dateKey])) : display(details[row.valueKey ?? ""]); const status = row.statusKey ? display(details[row.statusKey]) : ""; const valid = status.toLowerCase() === "valid"; const invalid = status.toLowerCase() === "invalid"; return <div key={row.label} className="grid grid-cols-[1fr_130px] gap-3 px-4 py-3 sm:grid-cols-[1fr_150px_110px]"><p className="text-[12px] font-semibold text-[#526178]">{row.label}</p><p className="text-[13px] font-semibold text-[#071D49]">{value || "-"}</p>{row.statusKey ? <span className={`w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${valid ? "border-green-200 bg-green-50 text-green-700" : invalid ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{status || "-"}</span> : null}</div>; })}</div></section>;
}

function GenericDetails({ details }: { details: Record<string, unknown> }) {
  const rows = Object.entries(details).filter(([key]) => !["verification_type", "document_id", "document_type", "verified"].includes(key));
  return <section className="mb-4 rounded-xl border border-[#D9E3F0] bg-white"><div className="border-b border-[#E6EEF7] px-4 py-3"><h3 className="text-[14px] font-semibold text-[#071D49]">Saved Details</h3></div><div className="divide-y divide-[#EEF2F7]">{rows.map(([key, value]) => <div key={key} className="grid grid-cols-[180px_1fr] gap-3 px-4 py-3"><p className="text-[12px] font-semibold capitalize text-[#526178]">{key.replace(/_/g, " ")}</p><p className="text-[13px] font-semibold text-[#071D49]">{formatDetailValue(key, value)}</p></div>)}</div></section>;
}

function Remarks({ details }: { details: Record<string, unknown> }) {
  const remarks = display(details.rc_verification_remarks) || display(details.insurance_verification_remarks);
  if (!remarks) return null;
  return <section className="rounded-xl border border-[#D9E3F0] bg-[#FBFCFE] p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#526178]">Remarks</p><p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-[#071D49]">{remarks}</p></section>;
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[#D9E3F0] bg-white px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#526178]">{label}</p><p className="mt-0.5 text-[13px] font-semibold text-[#071D49]">{value || "-"}</p></div>;
}

function display(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function formatDetailValue(key: string, value: unknown) {
  const text = display(value);
  if (!text) return "";
  if (key.toLowerCase().includes("date") || key.toLowerCase().includes("valid_upto") || key.toLowerCase().endsWith("_at")) {
    return key.toLowerCase().includes("_at") ? formatDateTime(text) : formatDate(text);
  }
  return text;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const parsed = parseDate(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).format(parsed).toLowerCase();
  return `${date}, ${time}`;
}

function parseDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}