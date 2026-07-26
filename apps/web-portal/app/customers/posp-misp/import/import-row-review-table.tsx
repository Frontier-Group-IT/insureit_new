"use client";

import Link from "next/link";
import { useState } from "react";
import { deletePospMispImportRow, updatePospMispImportRow } from "../actions";
import { decidePospMispPartnerRoute } from "../../applications/posp-misp-workflow-actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { IndianDateField } from "@/components/indian-date-field";

type PartnerType = "posp" | "misp";
type PanJob = { status: string; result_message: string | null; last_error: string | null; checked_by_device: string | null };
type RouteProfile = { requested_account_type: "posp" | "misp" | null; final_account_type: "posp" | "misp" | "partner" | null; partner_decision: string; iib_remarks: string | null };
type ImportRow = {
  id: string;
  row_number: number;
  sheet_name: string;
  partner_type: PartnerType;
  source_data: Record<string, unknown>;
  normalized_data: Record<string, unknown>;
  validation_errors: string[] | null;
  status: string;
  application_id: string | null;
  error_message: string | null;
  documents: Array<{ document_type: string; file_name: string }>;
  pan_job: PanJob | null;
  route_profile: RouteProfile | null;
};
type Props = {
  batchId: string;
  batchStatus: string;
  rows: ImportRow[];
  salesManagers: Array<{ id: string; fullName: string; employeeCode: string | null }>;
  oems: Array<{ value: string; label: string }>;
  banks: Array<{ value: string; label: string }>;
};

const inputClass = "h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#E7E5FF] disabled:bg-[#F8FAFC]";
const labelClass = "mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#526178]";
const marksheetOptions = [
  { value: "education_10th_marksheet", label: "10th Marksheet" },
  { value: "education_12th_marksheet", label: "12th Marksheet" },
  { value: "education_graduation_marksheet", label: "Graduation Marksheet" },
  { value: "education_post_graduation_marksheet", label: "Post Graduation Marksheet" }
];
const documentFields = [
  ...["aadhaar_front", "aadhaar_back", "pan_copy", "cancelled_cheque", "photograph", "gst_copy"].map((value) => ({ value, label: value.replaceAll("_", " ") })),
  { value: "agreement_copy", label: "Agreement copy" }
];

export function ImportRowReviewTable({ batchId, batchStatus, rows, salesManagers, oems, banks }: Props) {
  const [editingRow, setEditingRow] = useState<ImportRow | null>(null);
  const canEditBatch = ["parsed", "partially_submitted", "failed"].includes(batchStatus);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/80 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 px-4 py-3">
          <div>
            <h2 className="text-[12px] font-semibold text-[#0F172A]">Parsed workbook rows</h2>
            <p className="mt-0.5 text-[9.5px] text-[#64748B]">IIB checking starts automatically after a row is submitted.</p>
          </div>
          <span className="rounded-full border border-[#DCE5EF] bg-white px-2.5 py-1 text-[9px] font-semibold capitalize text-[#475569]">{batchStatus.replaceAll("_", " ")}</span>
        </div>

        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed text-left text-[10px]">
            <thead className="border-b border-[#E2E8F0] bg-white text-[8.5px] uppercase tracking-[0.04em] text-[#64748B]">
              <tr>
                <th className="hidden w-[5%] px-2 py-2.5 lg:table-cell">Row</th>
                <th className="w-[18%] px-2 py-2.5">Application</th>
                <th className="w-[14%] px-2 py-2.5">Contact</th>
                <th className="w-[13%] px-2 py-2.5">IIB Status</th>
                <th className="w-[13%] px-2 py-2.5">Final Route</th>
                <th className="w-[20%] px-2 py-2.5">Validation</th>
                <th className="w-[9%] px-2 py-2.5">Import</th>
                <th className="w-[8%] px-2 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {rows.map((row) => {
                const data = row.normalized_data ?? {};
                const name = stringValue(row.partner_type === "posp" ? data.pos_name : data.misp_name);
                const onboardingId = stringValue(data.external_onboarding_id);
                const editable = canEditBatch && !["submitted", "processing"].includes(row.status);
                return (
                  <tr key={row.id} className={row.validation_errors?.length ? "bg-red-50/30" : "hover:bg-[#FAFCFF]"}>
                    <td className="hidden px-2 py-2.5 lg:table-cell"><p className="font-semibold tabular-nums text-[#0F172A]">{row.row_number}</p><p className="truncate text-[8px] text-[#64748B]">{row.sheet_name}</p></td>
                    <td className="px-2 py-2.5"><div className="flex min-w-0 items-start gap-1.5"><span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[7.5px] font-bold ${row.partner_type === "misp" ? "bg-[#FFF7D6] text-[#8A6500]" : "bg-[#E8F0FF] text-[#174EA6]"}`}>{row.partner_type.toUpperCase()}</span><div className="min-w-0"><p className="truncate font-semibold text-[#0F172A]">{name ?? "Name missing"}</p><p className="truncate text-[8px] font-semibold text-[#475569]">ID: {onboardingId ?? "Not entered"}</p><p className="truncate text-[8px] text-[#64748B]">{maskPan(stringValue(data.pan_number))}</p></div></div></td>
                    <td className="px-2 py-2.5"><p className="truncate tabular-nums">{stringValue(data.applicant_phone) ?? "-"}</p><p className="truncate text-[8px] text-[#64748B]">{stringValue(data.applicant_email) ?? "Email not provided"}</p></td>
                    <td className="px-2 py-2.5"><IibStatus row={row} /></td>
                    <td className="px-2 py-2.5"><RouteStatus row={row} /></td>
                    <td className="px-2 py-2.5">{row.validation_errors?.length ? <ul className="space-y-0.5">{row.validation_errors.slice(0, 2).map((error, index) => <li key={index} className="break-words text-[8.5px] font-medium leading-4 text-red-700">• {error}</li>)}</ul> : <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-semibold text-emerald-700">Ready</span>}</td>
                    <td className="px-2 py-2.5"><RowStatus row={row} /></td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        {row.application_id ? <Link href={`/customers/applications/${row.application_id}`} title="Open application" aria-label="Open application" className="grid h-8 w-8 place-items-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100"><OpenIcon /></Link> : null}
                        <button type="button" onClick={() => setEditingRow(row)} title={editable ? "Review or correct row" : "View row"} aria-label={editable ? "Review or correct row" : "View row"} className="grid h-8 w-8 place-items-center rounded-lg border border-[#CBD5E1] bg-white text-[#334155] transition hover:border-[#94A3B8] hover:bg-[#F8FAFC]"><ReviewIcon /></button>
                        {editable ? <form action={deletePospMispImportRow} onSubmit={(event) => { if (!window.confirm(`Remove row ${row.row_number}?`)) event.preventDefault(); }}><input type="hidden" name="batch_id" value={batchId} /><input type="hidden" name="row_id" value={row.id} /><button type="submit" title="Remove row" aria-label="Remove row" className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100"><TrashIcon /></button></form> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editingRow ? <EditRowModal batchId={batchId} row={editingRow} editable={canEditBatch && !["submitted", "processing"].includes(editingRow.status)} salesManagers={salesManagers} oems={oems} banks={banks} onClose={() => setEditingRow(null)} /> : null}
    </>
  );
}

function IibStatus({ row }: { row: ImportRow }) {
  if (!row.application_id) return <span className="inline-flex rounded-full bg-slate-100 px-1.5 py-1 text-[8px] font-semibold leading-3 text-slate-600">Starts after submission</span>;
  const status = row.pan_job?.status ?? "pending";
  const style = status === "not_found" ? "bg-emerald-50 text-emerald-700" : status === "matched" ? "bg-amber-50 text-amber-800" : status === "failed" || status === "invalid" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700";
  const label: Record<string, string> = { pending: "Waiting", queued: "Waiting", checking: "Checking", not_found: "No data found", matched: "Match found", invalid: "Invalid PAN", failed: "Check failed" };
  return <div><span className={`inline-flex rounded-full px-1.5 py-1 text-[8px] font-semibold leading-3 ${style}`}>{label[status] ?? status.replaceAll("_", " ")}</span>{row.pan_job?.checked_by_device ? <p className="mt-1 truncate text-[7.5px] text-[#64748B]">{row.pan_job.checked_by_device}</p> : null}</div>;
}

function RouteStatus({ row }: { row: ImportRow }) {
  const profile = row.route_profile;
  if (!row.application_id) return <span className="text-[8px] text-[#94A3B8]">Pending</span>;
  if (row.pan_job?.status === "matched" && profile?.partner_decision === "pending") {
    return <div className="space-y-1"><p className="text-[8px] font-semibold text-amber-800">Route decision</p><form action={decidePospMispPartnerRoute}><input type="hidden" name="application_id" value={row.application_id} /><input type="hidden" name="partner_decision" value="convert_to_partner" /><FormSubmitButton label="Partner" pendingLabel="Converting" className="w-full rounded-md bg-[#635BFF] px-1.5 py-1 text-[8px] font-semibold text-white" /></form><form action={decidePospMispPartnerRoute}><input type="hidden" name="application_id" value={row.application_id} /><input type="hidden" name="partner_decision" value="do_not_proceed" /><FormSubmitButton label="Close" pendingLabel="Closing" className="w-full rounded-md border border-red-200 bg-red-50 px-1.5 py-1 text-[8px] font-semibold text-red-700" /></form></div>;
  }
  const finalType = profile?.final_account_type;
  if (finalType) return <span className={`inline-flex rounded-full px-1.5 py-1 text-[8px] font-semibold ${finalType === "partner" ? "bg-violet-50 text-violet-700" : "bg-emerald-50 text-emerald-700"}`}>{finalType === "partner" ? "Partner" : `${finalType.toUpperCase()} cleared`}</span>;
  return <span className="text-[8px] text-[#64748B]">Awaiting IIB</span>;
}

function EditRowModal({ batchId, row, editable, salesManagers, oems, banks, onClose }: { batchId: string; row: ImportRow; editable: boolean; salesManagers: Props["salesManagers"]; oems: Props["oems"]; banks: Props["banks"]; onClose: () => void }) {
  const data = row.normalized_data ?? {};
  const isMisp = row.partner_type === "misp";
  const selectedManagerId = stringValue(data.associate_employee_id) ?? stringValue(data.associate_profile_id) ?? "";
  const currentMarksheet = row.documents.find((document) => document.document_type.startsWith("education_"));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    const fallbackUrl = `/customers/posp-misp/import/${batchId}?success=row_updated`;
    let destination = fallbackUrl;
    const safetyTimer = window.setTimeout(() => window.location.assign(destination), 12000);

    try {
      await updatePospMispImportRow(new FormData(event.currentTarget));
    } catch (error) {
      const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
      const redirectMatch = digest.match(/NEXT_REDIRECT;[^;]*;([^;]+);/);
      if (redirectMatch?.[1]) destination = redirectMatch[1];
      else setSaveError("The row was saved, but the page could not return automatically. Redirecting now…");
    } finally {
      window.clearTimeout(safetyTimer);
      window.location.assign(destination);
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-[#0F172A]/45 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-[1080px] overflow-hidden rounded-3xl border border-white/60 bg-[#F4F7FB] shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#DCE5EF] bg-white px-5 py-4"><div><p className="text-[9px] font-semibold uppercase tracking-[.1em] text-[#64748B]">Step 1 · Primary information</p><h3 className="mt-1 text-lg font-semibold text-[#071D49]">{isMisp ? "MISP" : "POSP"} row {row.row_number}</h3><p className="mt-1 text-[10px] text-[#64748B]">Onboarding ID remains visible and editable. IIB status is automatic.</p></div><button type="button" onClick={onClose} disabled={saving} className="grid h-8 w-8 place-items-center rounded-lg border border-[#CBD5E1] disabled:opacity-50">×</button></div>

        <form onSubmit={handleSubmit}>
          <input type="hidden" name="batch_id" value={batchId} /><input type="hidden" name="row_id" value={row.id} /><input type="hidden" name="partner_type" value={row.partner_type} />
          <div className="space-y-4 p-4">
            {saveError ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-800">{saveError}</div> : null}
            <Section title="Primary information"><SelectField label="Associate" name="associate_employee_id" defaultValue={selectedManagerId} required disabled={!editable || saving} options={salesManagers.map((manager) => ({ value: manager.id, label: `${manager.fullName}${manager.employeeCode ? ` - ${manager.employeeCode}` : ""}` }))} placeholder="Select associate" /><Field label="Onboarding ID" name="external_onboarding_id" defaultValue={stringValue(data.external_onboarding_id) ?? ""} placeholder="Enter onboarding ID" disabled={!editable || saving} /><Field label={isMisp ? "MISP Name" : "POS Name"} name={isMisp ? "misp_name" : "pos_name"} required defaultValue={stringValue(isMisp ? data.misp_name : data.pos_name) ?? ""} disabled={!editable || saving} /><Field label="PAN Number" name="pan_number" maxLength={10} defaultValue={stringValue(data.pan_number) ?? ""} disabled={!editable || saving} />{isMisp ? <SelectField label="OEM" name="oem_name" required defaultValue={stringValue(data.oem_name) ?? ""} disabled={!editable || saving} options={oems} placeholder="Select OEM" /> : null}<IndianDateField label="Document Received Date" name="document_received_at" defaultValue={stringValue(data.document_received_at)} disabled={!editable || saving} /></Section>
            <Section title="Contact and address"><Field label="Mobile Number" name="applicant_phone" required defaultValue={stringValue(data.applicant_phone) ?? ""} disabled={!editable || saving} /><Field label="Email" name="applicant_email" type="email" defaultValue={stringValue(data.applicant_email) ?? ""} disabled={!editable || saving} /><IndianDateField label="Date of Birth" name="date_of_birth" defaultValue={stringValue(data.date_of_birth)} disabled={!editable || saving} /><Field label="Aadhaar Number" name="aadhaar_number" maxLength={12} defaultValue={stringValue(data.aadhaar_number) ?? ""} disabled={!editable || saving} /><Field label="Address" name="address" defaultValue={stringValue(data.address) ?? ""} disabled={!editable || saving} /><Field label="City" name="city" defaultValue={stringValue(data.city) ?? ""} disabled={!editable || saving} /><Field label="State" name="state" defaultValue={stringValue(data.state) ?? ""} disabled={!editable || saving} /><Field label="PIN Code" name="postal_code" defaultValue={stringValue(data.postal_code) ?? ""} disabled={!editable || saving} /></Section>
            {isMisp ? <Section title="Designated person"><Field label="DP Name" name="dp_name" required defaultValue={stringValue(data.dp_name) ?? ""} disabled={!editable || saving} /><Field label="DP Mobile" name="dp_phone" required defaultValue={stringValue(data.dp_phone) ?? ""} disabled={!editable || saving} /><Field label="DP Email" name="dp_email" type="email" defaultValue={stringValue(data.dp_email) ?? ""} disabled={!editable || saving} /><Field label="DP PAN" name="dp_pan_number" maxLength={10} defaultValue={stringValue(data.dp_pan_number) ?? ""} disabled={!editable || saving} /></Section> : null}
            <Section title="Bank particulars"><SelectField label="Bank Name" name="bank_id" required defaultValue={stringValue(data.bank_id) ?? ""} disabled={!editable || saving} options={banks} placeholder="Select bank" /><Field label="Account Number" name="bank_account_number" defaultValue={stringValue(data.bank_account_number) ?? ""} disabled={!editable || saving} /><Field label="IFSC Code" name="bank_ifsc_code" defaultValue={stringValue(data.bank_ifsc_code) ?? ""} disabled={!editable || saving} /><Field label="GST Number" name="gst_number" maxLength={15} defaultValue={stringValue(data.gst_number) ?? ""} disabled={!editable || saving} /></Section>
            <section className="rounded-2xl border border-[#DCE5EF] bg-white"><div className="border-b bg-[#F8FAFC] px-4 py-3"><h4 className="text-[12px] font-semibold">Step 2 · Documents</h4></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3"><DocumentBox label="Marksheet" current={currentMarksheet?.file_name}><SelectField label="Marksheet type" name="education_document_type" defaultValue={currentMarksheet?.document_type ?? ""} disabled={!editable || saving} options={marksheetOptions} placeholder="Select marksheet" />{editable ? <input name="education_marksheet" type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={saving} className="mt-2 block w-full text-[9px]" /> : null}</DocumentBox>{documentFields.map((document) => { const current = row.documents.find((item) => item.document_type === document.value); return <DocumentBox key={document.value} label={document.label} current={current?.file_name}>{editable ? <input name={document.value} type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={saving} className="mt-2 block w-full text-[9px]" /> : null}</DocumentBox>; })}</div></section>
          </div>
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-white/95 px-5 py-3 backdrop-blur"><button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-[#CBD5E1] px-4 py-2 text-[10.5px] font-semibold disabled:opacity-50">Close</button>{editable ? <button type="submit" disabled={saving} className="inline-flex min-w-[155px] items-center justify-center rounded-xl bg-[#635BFF] px-4 py-2 text-[10.5px] font-semibold text-white disabled:opacity-70">{saving ? "Saving corrections…" : "Save row corrections"}</button> : null}</div>
        </form>
      </div>
    </div>
  );
}

function RowStatus({ row }: { row: ImportRow }) {
  const label = row.status.replaceAll("_", " ");
  const style = row.status === "submitted" ? "bg-emerald-50 text-emerald-700" : row.status === "failed" ? "bg-red-50 text-red-700" : row.status === "processing" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700";
  return <div className="space-y-1"><span className={`inline-flex rounded-full px-1.5 py-1 text-[8px] font-semibold capitalize ${style}`}>{label}</span>{row.status === "failed" ? <p className="break-words text-[8px] font-medium leading-3 text-red-700" title={row.error_message ?? "No failure reason was saved."}>{row.error_message ?? "No failure reason was saved. Retry the row to capture the backend error."}</p> : null}</div>;
}
function OpenIcon(){return <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3h7v7"/><path d="m10 14 11-11"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>}
function ReviewIcon(){return <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/><path d="m15 5 3 3"/></svg>}
function TrashIcon(){return <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>}
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-[#DCE5EF] bg-white"><div className="border-b bg-[#F8FAFC] px-4 py-3"><h4 className="text-[12px] font-semibold">{title}</h4></div><div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>; }
function DocumentBox({ label, current, children }: { label: string; current?: string; children: React.ReactNode }) { return <div className={`rounded-xl border p-3 ${current ? "border-emerald-200 bg-emerald-50/35" : "border-amber-200 bg-amber-50/30"}`}><div className="flex justify-between"><span className="text-[10px] font-semibold capitalize">{label}</span><span className="text-[8px] font-semibold">{current ? "Received" : "Pending"}</span></div><p className="mt-1 truncate text-[9px] text-[#64748B]">{current ?? "No file attached"}</p><div className="mt-2">{children}</div></div>; }
function Field({ label, name, required = false, disabled = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) { return <div><label className={labelClass}>{label}{required ? " *" : ""}</label><input name={name} required={required} disabled={disabled} className={inputClass} {...props} /></div>; }
function SelectField({ label, name, required = false, options, placeholder, disabled = false, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: Array<{ value: string; label: string }>; placeholder: string }) { return <div><label className={labelClass}>{label}{required ? " *" : ""}</label><select name={name} required={required} disabled={disabled} className={inputClass} {...props}><option value="">{placeholder}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>; }
function stringValue(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function maskPan(value: string | null) { return value?.length === 10 ? `${value.slice(0, 2)}***${value.slice(5, 8)}${value.slice(-1)}` : value ?? "PAN pending"; }
