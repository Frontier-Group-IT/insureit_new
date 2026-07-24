"use client";

import Link from "next/link";
import { useState } from "react";
import { deletePospMispImportRow, updatePospMispImportRow } from "../actions";
import { IndianDateField } from "@/components/indian-date-field";

type PartnerType = "posp" | "misp";
type ImportRow = {
  id: string;
  row_number: number;
  sheet_name: string;
  partner_type: PartnerType;
  normalized_data: Record<string, unknown>;
  validation_errors: string[] | null;
  status: string;
  application_id: string | null;
  error_message: string | null;
  documents: Array<{ document_type: string; file_name: string }>;
};

type Props = {
  batchId: string;
  batchStatus: string;
  rows: ImportRow[];
  salesManagers: Array<{ id: string; fullName: string; employeeCode: string | null }>;
  oems: Array<{ value: string; label: string }>;
  banks: Array<{ value: string; label: string }>;
};

const inputClass = "h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const labelClass = "mb-1 block text-[10.5px] font-semibold text-[#344054]";
const iibRemarks = ["Matching Record Found In DataBase", "No Data Found In POS System"];
const preIibDocumentFields = [
  ["aadhaar_front", "Aadhaar front"],
  ["aadhaar_back", "Aadhaar back"],
  ["pan_copy", "PAN copy"],
  ["education_10th_marksheet", "10th Marksheet"],
  ["education_12th_marksheet", "12th Marksheet"],
  ["education_graduation_marksheet", "Graduation Marksheet"],
  ["education_post_graduation_marksheet", "Post Graduation Marksheet"],
  ["cancelled_cheque", "Cancelled cheque"],
  ["photograph", "Photograph"],
  ["gst_copy", "GST certificate"]
] as const;
const postIibDocumentFields = [["agreement_copy", "Agreement copy"]] as const;
const educationDocumentTypes = new Set<string>(
  preIibDocumentFields.filter(([key]) => key.startsWith("education_")).map(([key]) => key)
);

export function ImportRowReviewTable({ batchId, batchStatus, rows, salesManagers, oems, banks }: Props) {
  const [editingRow, setEditingRow] = useState<ImportRow | null>(null);
  const canEditBatch = ["parsed", "partially_submitted", "failed"].includes(batchStatus);

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1220px] text-left text-[11px]">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9.5px] uppercase tracking-[0.04em] text-[#64748B]">
              <tr><th className="px-3 py-2.5">Row</th><th className="px-3 py-2.5">Sheet</th><th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Mobile</th><th className="px-3 py-2.5">PAN</th><th className="px-3 py-2.5">Documents</th><th className="px-3 py-2.5">Training</th><th className="px-3 py-2.5">Validation</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {rows.map((row) => {
                const normalized = row.normalized_data ?? {};
                const name = stringValue(row.partner_type === "posp" ? normalized.pos_name : normalized.misp_name);
                const editable = canEditBatch && !["submitted", "processing"].includes(row.status);
                return (
                  <tr key={row.id} className="hover:bg-[#FAFCFF]">
                    <td className="px-3 py-3 tabular-nums">{row.row_number}</td>
                    <td className="px-3 py-3">{row.sheet_name}</td>
                    <td className="px-3 py-3 font-semibold text-[#0F172A]">{name ?? "-"}</td>
                    <td className="px-3 py-3 tabular-nums">{stringValue(normalized.applicant_phone) ?? "-"}</td>
                    <td className="px-3 py-3">{stringValue(normalized.pan_number) ?? "-"}</td>
                    <td className="px-3 py-3"><span className={row.documents.length ? "font-semibold text-emerald-700" : "text-amber-700"}>{row.documents.length} attached</span></td>
                    <td className="px-3 py-3">{stringValue(normalized.training_status) ?? "-"}</td>
                    <td className="max-w-[280px] px-3 py-3">{row.validation_errors?.length ? <span className="text-red-700">{row.validation_errors.join(" ")}</span> : <span className="text-emerald-700">Ready</span>}</td>
                    <td className="px-3 py-3">{rowStatus(row)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {row.application_id ? <Link href={`/customers/applications/${row.application_id}`} className="font-semibold text-[#4F46E5] hover:underline">Review</Link> : null}
                        <button type="button" onClick={() => setEditingRow(row)} className="rounded-md border border-[#CBD5E1] px-2.5 py-1 text-[10px] font-semibold text-[#334155]">{editable ? "View / Edit" : "View"}</button>
                        {editable ? (
                          <form action={deletePospMispImportRow}>
                            <input type="hidden" name="batch_id" value={batchId} />
                            <input type="hidden" name="row_id" value={row.id} />
                            <button type="submit" onClick={(event) => { if (!window.confirm(`Remove row ${row.row_number} from this import batch?`)) event.preventDefault(); }} className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-700">Remove</button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {editingRow ? (
        <EditRowModal
          batchId={batchId}
          row={editingRow}
          editable={canEditBatch && !["submitted", "processing"].includes(editingRow.status)}
          salesManagers={salesManagers}
          oems={oems}
          banks={banks}
          onClose={() => setEditingRow(null)}
        />
      ) : null}
    </>
  );
}

function EditRowModal({ batchId, row, editable, salesManagers, oems, banks, onClose }: { batchId: string; row: ImportRow; editable: boolean; salesManagers: Props["salesManagers"]; oems: Props["oems"]; banks: Props["banks"]; onClose: () => void }) {
  const data = row.normalized_data ?? {};
  const isMisp = row.partner_type === "misp";
  const selectedManagerId = stringValue(data.associate_profile_id) ?? "";

  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-[#0F172A]/40 px-4 py-8 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <div className="w-full max-w-[1120px] overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Imported {row.sheet_name} row {row.row_number}</p>
            <h3 className="mt-1 text-base font-semibold text-[#0F172A]">{editable ? "View and edit parsed details" : "View parsed details"}</h3>
            {row.validation_errors?.length ? <p className="mt-1 text-[10.5px] font-medium text-red-700">{row.validation_errors.join(" ")}</p> : <p className="mt-1 text-[10.5px] font-medium text-emerald-700">This row is ready for submission.</p>}
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md border border-[#CBD5E1] text-[#64748B]">x</button>
        </div>

        <form action={updatePospMispImportRow}>
          <input type="hidden" name="batch_id" value={batchId} />
          <input type="hidden" name="row_id" value={row.id} />
          <input type="hidden" name="partner_type" value={row.partner_type} />
          <Section title={isMisp ? "MISP Business Details" : "POSP Details"}>
            <SelectField label="Associate Name" name="associate_profile_id" defaultValue={selectedManagerId} required disabled={!editable} options={salesManagers.map((manager) => ({ value: manager.id, label: `${manager.fullName}${manager.employeeCode ? ` - ${manager.employeeCode}` : ""}` }))} placeholder="Select Sales Manager" />
            <ReadOnlyValue label="Current Associate ID" value={stringValue(data.associate_id) ?? "Auto-filled when saved"} />
            <Field label={isMisp ? "MISP ID" : "Onboarding ID"} name="external_onboarding_id" defaultValue={stringValue(data.external_onboarding_id) ?? ""} disabled={!editable} />
            <IndianDateField label="Document Received Date" name="document_received_at" defaultValue={stringValue(data.document_received_at)} disabled={!editable} />
            {isMisp ? <Field label="MISP Name" name="misp_name" required defaultValue={stringValue(data.misp_name) ?? ""} disabled={!editable} /> : <Field label="POS Name" name="pos_name" required defaultValue={stringValue(data.pos_name) ?? ""} disabled={!editable} />}
            <Field label={isMisp ? "MISP PAN" : "PAN Number"} name="pan_number" maxLength={10} defaultValue={stringValue(data.pan_number) ?? ""} disabled={!editable} />
            {isMisp ? <SelectField label="OEM Name" name="oem_name" required defaultValue={stringValue(data.oem_name) ?? ""} disabled={!editable} options={oems} placeholder="Select OEM" /> : null}
            <Field label="GST Number" name="gst_number" maxLength={15} defaultValue={stringValue(data.gst_number) ?? ""} disabled={!editable} />
          </Section>

          <Section title={isMisp ? "Primary MISP Contact" : "Contact Details"}>
            <Field label="Mobile Number" name="applicant_phone" required inputMode="tel" defaultValue={stringValue(data.applicant_phone) ?? ""} disabled={!editable} />
            <Field label="Email" name="applicant_email" type="email" defaultValue={stringValue(data.applicant_email) ?? ""} disabled={!editable} />
            <IndianDateField label="Date of Birth" name="date_of_birth" defaultValue={stringValue(data.date_of_birth)} disabled={!editable} />
            <Field label="Replace Aadhaar Number" name="aadhaar_number" inputMode="numeric" maxLength={12} placeholder={stringValue(data.aadhaar_last_four) ? `Stored ending ${stringValue(data.aadhaar_last_four)}` : "Optional"} disabled={!editable} />
            <Field label="Address" name="address" defaultValue={stringValue(data.address) ?? ""} disabled={!editable} />
            <Field label="City" name="city" defaultValue={stringValue(data.city) ?? ""} disabled={!editable} />
            <Field label="State" name="state" defaultValue={stringValue(data.state) ?? ""} disabled={!editable} />
            <Field label="PIN Code" name="postal_code" inputMode="numeric" defaultValue={stringValue(data.postal_code) ?? ""} disabled={!editable} />
          </Section>

          {isMisp ? (
            <Section title="DP Contact">
              <Field label="DP Name" name="dp_name" required defaultValue={stringValue(data.dp_name) ?? ""} disabled={!editable} />
              <Field label="DP Mobile" name="dp_phone" required inputMode="tel" defaultValue={stringValue(data.dp_phone) ?? ""} disabled={!editable} />
              <Field label="DP Email" name="dp_email" type="email" defaultValue={stringValue(data.dp_email) ?? ""} disabled={!editable} />
              <Field label="DP PAN" name="dp_pan_number" maxLength={10} defaultValue={stringValue(data.dp_pan_number) ?? ""} disabled={!editable} />
            </Section>
          ) : null}

          <Section title="Bank Details">
            <ReadOnlyValue label="Education / Marksheet Status" value={row.documents.some((document) => educationDocumentTypes.has(document.document_type)) ? "Received" : "Not received"} />
            <SelectField label="Bank Name" name="bank_id" required defaultValue={stringValue(data.bank_id) ?? ""} disabled={!editable} options={banks} placeholder="Select bank" />
            <Field label="Account Number" name="bank_account_number" defaultValue={stringValue(data.bank_account_number) ?? ""} disabled={!editable} />
            <Field label="IFSC Code" name="bank_ifsc_code" defaultValue={stringValue(data.bank_ifsc_code) ?? ""} disabled={!editable} />
          </Section>

          <Section title="IIB Portal Processing">
            <SelectField label="IIB Remarks" name="iib_remarks" defaultValue={stringValue(data.iib_remarks) ?? ""} disabled={!editable} options={iibRemarks.map((remark) => ({ value: remark, label: remark }))} placeholder="Select IIB remark" />
            <CheckboxField label="IIB uploaded" name="iib_uploaded" defaultChecked={data.iib_uploaded === true} disabled={!editable} />
            <IndianDateField label="IIB Upload Date" name="iib_uploaded_at" defaultValue={stringValue(data.iib_uploaded_at)} disabled={!editable} />
          </Section>

          <section className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
            <div className="mb-3">
              <h3 className="text-[13px] font-semibold text-[#0F172A]">Pre-IIB Documents</h3>
              <p className="mt-1 text-[10.5px] text-[#64748B]">Documents collected before IIB submission. Education status is calculated from the marksheets attached here.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {preIibDocumentFields.map(([key, label]) => {
                const current = row.documents.find((document) => document.document_type === key);
                return (
                  <label key={key} className="rounded-lg border border-[#DCE5EF] bg-white p-3">
                    <span className="block text-[10.5px] font-semibold text-[#344054]">{label}</span>
                    <span className={`mt-1 block truncate text-[9.5px] ${current ? "text-emerald-700" : "text-[#64748B]"}`}>{current ? current.file_name : "Not received"}</span>
                    {editable ? <input name={key} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="mt-2 block w-full text-[10px] text-[#475569] file:mr-2 file:rounded-md file:border-0 file:bg-[#EEF2FF] file:px-2.5 file:py-1.5 file:text-[9.5px] file:font-semibold file:text-[#4338CA]" /> : null}
                  </label>
                );
              })}
            </div>
          </section>

          <section className="border-b border-[#E2E8F0] px-5 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="text-[13px] font-semibold text-[#0F172A]">Registration Form</h3><p className="mt-1 text-[10px] text-[#64748B]">The form is generated from the submitted onboarding record.</p></div>
              {row.application_id ? <a href={`/customers/applications/${row.application_id}/registration-form`} download className="rounded-md bg-[#0F2A55] px-3 py-2 text-[10.5px] font-semibold text-white">Download PDF</a> : <span className="rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[10px] font-semibold text-[#64748B]">Available after submission</span>}
            </div>
          </section>

          <Section title="Training and Exam">
            <CheckboxField label="Credentials shared" name="training_credentials_shared_flag" defaultChecked={data.training_credentials_shared_flag === true} disabled={!editable} />
            <Field label="Training Login ID" name="training_login_id" defaultValue={stringValue(data.training_login_id) ?? ""} disabled={!editable} />
            <Field label="Training Password" name="training_password" type="password" defaultValue={stringValue(data.training_password) ?? ""} disabled={!editable} />
            <IndianDateField label="Training Start Date" name="training_start_date" defaultValue={stringValue(data.training_start_date)} disabled={!editable} />
            <IndianDateField label="Training End Date" name="training_end_date" defaultValue={stringValue(data.training_end_date)} disabled={!editable} />
            <Field label="Training Status" name="training_status" defaultValue={stringValue(data.training_status) ?? ""} disabled={!editable} />
            <Field label="Training Certificate No." name="training_certificate_number" defaultValue={stringValue(data.training_certificate_number) ?? ""} disabled={!editable} />
            <Field label="Exam Status" name="exam_status" defaultValue={stringValue(data.exam_status) ?? ""} disabled={!editable} />
            <IndianDateField label="Onboarding Date" name="onboarding_date" defaultValue={stringValue(data.onboarding_date)} disabled={!editable} />
          </Section>

          <section className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
            <h3 className="text-[13px] font-semibold text-[#0F172A]">Post-IIB Documents</h3>
            <p className="mt-1 text-[10px] text-[#64748B]">Agreement copy is collected after IIB processing.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {postIibDocumentFields.map(([key, label]) => {
                const current = row.documents.find((document) => document.document_type === key);
                return <label key={key} className="rounded-lg border border-[#DCE5EF] bg-white p-3"><span className="block text-[10.5px] font-semibold text-[#344054]">{label}</span><span className={`mt-1 block truncate text-[9.5px] ${current ? "text-emerald-700" : "text-[#64748B]"}`}>{current ? current.file_name : "Not received"}</span>{editable ? <input name={key} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="mt-2 block w-full text-[10px] text-[#475569] file:mr-2 file:rounded-md file:border-0 file:bg-[#EEF2FF] file:px-2.5 file:py-1.5 file:text-[9.5px] file:font-semibold file:text-[#4338CA]" /> : null}</label>;
              })}
            </div>
          </section>

          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-white/95 px-5 py-3 backdrop-blur">
            <button type="button" onClick={onClose} className="rounded-md border border-[#CBD5E1] px-4 py-2 text-[11px] font-semibold text-[#334155]">Close</button>
            {editable ? <button className="rounded-md bg-[#4F46E5] px-4 py-2 text-[11px] font-semibold text-white">Save Row</button> : null}
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-b border-[#E2E8F0] px-5 py-4"><h3 className="mb-3 text-[13px] font-semibold text-[#0F172A]">{title}</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>;
}

function Field({ label, name, required = false, disabled = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <div><label className={labelClass} htmlFor={`${name}-${label}`}>{label}{required ? " *" : ""}</label><input id={`${name}-${label}`} name={name} required={required} disabled={disabled} className={inputClass} {...props} /></div>;
}

function SelectField({ label, name, required = false, options, placeholder, disabled = false, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: Array<{ value: string; label: string }>; placeholder: string }) {
  return <div><label className={labelClass} htmlFor={`${name}-${label}`}>{label}{required ? " *" : ""}</label><select id={`${name}-${label}`} name={name} required={required} disabled={disabled} className={inputClass} {...props}><option value="">{placeholder}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}

function CheckboxField({ label, name, defaultChecked, disabled }: { label: string; name: string; defaultChecked?: boolean; disabled?: boolean }) {
  return <label className="flex h-9 items-center gap-3 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[11px] font-semibold text-[#17203A]"><input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} disabled={disabled} className="h-4 w-4 rounded border-[#CBD5E1] text-[#4F46E5]" /><span>{label}</span></label>;
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return <div><span className={labelClass}>{label}</span><div className="flex h-9 items-center rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[11px] font-semibold text-[#475569]">{value}</div></div>;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rowStatus(row: ImportRow) {
  if (row.status !== "failed") return row.status.replaceAll("_", " ");
  const reference = row.error_message?.match(/Reference ([A-Za-z0-9-]+)/)?.[1];
  return reference ? `Failed · Ref ${reference}` : "Failed · review or retry";
}
