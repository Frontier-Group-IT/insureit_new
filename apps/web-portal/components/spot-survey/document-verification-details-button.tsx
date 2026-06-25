"use client";

import { useState } from "react";
import type { SpotSurveyDocument, SpotSurveyVerification } from "./spot-survey-workspace-v2";

type DetailRow = {
  label: string;
  dateKey?: string;
  statusKey?: string;
  valueKey?: string;
};

const rcRows: DetailRow[] = [
  { label: "Fitness", dateKey: "fitness_valid_upto", statusKey: "fitness_status" },
  { label: "Tax", dateKey: "tax_valid_upto", statusKey: "tax_status" },
  { label: "Insurance", dateKey: "insurance_valid_upto", statusKey: "insurance_status" },
  { label: "PUCC", dateKey: "pucc_valid_upto", statusKey: "pucc_status" },
  { label: "Local Permit", dateKey: "local_permit_valid_upto", statusKey: "local_permit_status" },
  { label: "National Permit", dateKey: "national_permit_valid_upto", statusKey: "national_permit_status" }
];

const insuranceRows: DetailRow[] = [
  { label: "Insurance Start Date", valueKey: "insurance_start_date" },
  { label: "Insurance End Date", dateKey: "insurance_end_date", statusKey: "policy_status" },
  { label: "NCB Verification %", valueKey: "ncb_percent" },
  { label: "GVW Mention in Kgs", valueKey: "gvw_kg" },
  { label: "Policy Type", valueKey: "policy_type_check" }
];

export function DocumentVerificationDetailsButton({ document, verification, title }: { document: SpotSurveyDocument; verification: SpotSurveyVerification; title: string }) {
  const [open, setOpen] = useState(false);
  const details = verification.details ?? {};
  const isPdf = document.signedUrl?.toLowerCase().includes(".pdf") || document.file_name.toLowerCase().endsWith(".pdf");
  const isImage = Boolean(document.signedUrl) && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(document.signedUrl ?? document.file_name);
  const verificationType = verification.verification_type;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="h-8 rounded-md border border-[#174EA6] bg-white px-2 text-[11px] font-semibold text-[#174EA6] transition hover:bg-[#F4F8FF]">
        View Details
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#071D49]/45 px-4 py-5">
          <div className="flex max-h-[92vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(7,29,73,0.26)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#E6EEF7] px-5 py-4">
              <div>
                <h2 className="text-[20px] font-semibold text-[#071D49]">{title} - Verification Details</h2>
                <p className="mt-1 text-[12px] text-[#526178]">Verified information saved for future reference.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-[28px] leading-none text-[#071D49]">×</button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
              <div className="min-h-[360px] overflow-hidden border-b border-[#E6EEF7] bg-[#F6F8FC] lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between border-b border-[#E6EEF7] bg-white px-4 py-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#526178]">Document Preview</p>
                    <p className="mt-0.5 max-w-[520px] truncate text-[13px] font-semibold text-[#071D49]">{document.file_name}</p>
                  </div>
                  {document.signedUrl ? <a href={document.signedUrl} target="_blank" rel="noreferrer" className="rounded-md border border-[#174EA6] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#174EA6]">Open</a> : null}
                </div>
                <div className="h-[calc(100%-57px)] p-3">
                  {document.signedUrl ? (
                    isPdf ? <iframe src={document.signedUrl} title={document.file_name} className="h-full min-h-[420px] w-full rounded-lg border border-[#D9E3F0] bg-white" /> : isImage ? <div className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-[#D9E3F0] bg-white p-3"><img src={document.signedUrl} alt={document.file_name} className="max-h-full max-w-full object-contain" /></div> : <div className="grid h-full min-h-[420px] place-items-center rounded-lg border border-[#D9E3F0] bg-white p-6 text-center"><div><p className="text-[14px] font-semibold text-[#071D49]">Preview not available for this file type.</p><a href={document.signedUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-md bg-[#071D49] px-4 py-2 text-[12px] font-semibold text-white">Open Document</a></div></div>
                  ) : <div className="grid h-full min-h-[420px] place-items-center rounded-lg border border-[#D9E3F0] bg-white p-6 text-center text-[13px] font-semibold text-[#526178]">No preview link available.</div>}
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto px-5 py-4">
                <div className={`mb-4 rounded-xl border p-3 ${verification.is_valid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-semibold text-[#071D49]">Verification Result</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${verification.is_valid ? "border-green-200 bg-white text-green-700" : "border-red-200 bg-white text-red-700"}`}>{verification.is_valid ? "Valid / Verified" : "Invalid"}</span>
                  </div>
                  <div className="mt-2 grid gap-2 text-[12px] sm:grid-cols-2">
                    <InfoMini label="Incident Date" value={formatDate(verification.incident_date)} />
                    <InfoMini label="Verified On" value={formatDateTime(verification.created_at)} />
                  </div>
                  {verification.invalid_reason ? <p className="mt-2 text-[12px] font-semibold text-red-700">{verification.invalid_reason}</p> : null}
                </div>

                {verificationType === "rc" ? <VerificationTable title="RC Validity Check" rows={rcRows} details={details} /> : null}
                {verificationType === "insurance" ? <VerificationTable title="Insurance Verification" rows={insuranceRows} details={details} /> : null}
                {verificationType !== "rc" && verificationType !== "insurance" ? <GenericDetails details={details} /> : null}

                <Remarks details={details} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function VerificationTable({ title, rows, details }: { title: string; rows: DetailRow[]; details: Record<string, unknown> }) {
  return (
    <section className="mb-4 rounded-xl border border-[#D9E3F0] bg-white">
      <div className="border-b border-[#E6EEF7] px-4 py-3">
        <h3 className="text-[14px] font-semibold text-[#071D49]">{title}</h3>
      </div>
      <div className="divide-y divide-[#EEF2F7]">
        {rows.map((row) => {
          const value = row.valueKey ? display(details[row.valueKey]) : formatDate(display(details[row.dateKey ?? ""]));
          const status = row.statusKey ? display(details[row.statusKey]) : "";
          const valid = status.toLowerCase() === "valid";
          const invalid = status.toLowerCase() === "invalid";
          return <div key={row.label} className="grid grid-cols-[1fr_120px] gap-3 px-4 py-3 sm:grid-cols-[1fr_150px_110px]"><p className="text-[12px] font-semibold text-[#526178]">{row.label}</p><p className="text-[13px] font-semibold text-[#071D49]">{value || "-"}</p>{row.statusKey ? <span className={`w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${valid ? "border-green-200 bg-green-50 text-green-700" : invalid ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{status || "-"}</span> : null}</div>;
        })}
      </div>
    </section>
  );
}

function GenericDetails({ details }: { details: Record<string, unknown> }) {
  const rows = Object.entries(details).filter(([key]) => !["verification_type", "document_id", "document_type", "verified", "verified_at"].includes(key));
  return <section className="mb-4 rounded-xl border border-[#D9E3F0] bg-white"><div className="border-b border-[#E6EEF7] px-4 py-3"><h3 className="text-[14px] font-semibold text-[#071D49]">Saved Details</h3></div><div className="divide-y divide-[#EEF2F7]">{rows.map(([key, value]) => <div key={key} className="grid grid-cols-[160px_1fr] gap-3 px-4 py-3"><p className="text-[12px] font-semibold capitalize text-[#526178]">{key.replace(/_/g, " ")}</p><p className="text-[13px] font-semibold text-[#071D49]">{display(value)}</p></div>)}</div></section>;
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

function formatDate(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
