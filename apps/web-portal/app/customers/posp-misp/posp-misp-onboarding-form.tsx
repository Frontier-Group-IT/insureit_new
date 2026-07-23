"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { FeedbackToast } from "@/components/ui-feedback";
import type { PospMispState } from "./actions";

type PartnerType = "posp" | "misp";
type DocumentKey =
  | "aadhaar_front"
  | "aadhaar_back"
  | "pan_copy"
  | "education_certificate"
  | "cancelled_cheque"
  | "photograph"
  | "registration_form"
  | "agreement_copy"
  | "gst_copy";

type Props = {
  action: (state: PospMispState, data: FormData) => Promise<PospMispState>;
  partnerType: PartnerType;
  salesManagers: Array<{ id: string; fullName: string; employeeCode: string | null }>;
  oems: Array<{ value: string; label: string }>;
};

const inputClass = "h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const labelClass = "mb-1 block text-[10.5px] font-semibold text-[#344054]";
const iibRemarks = [
  "Matching Record Found In DataBase",
  "No Data Found In POS System"
];
const documentFields: Array<{ key: DocumentKey; label: string }> = [
  { key: "aadhaar_front", label: "Aadhaar front" },
  { key: "aadhaar_back", label: "Aadhaar back" },
  { key: "pan_copy", label: "PAN copy" },
  { key: "education_certificate", label: "10th / 12th certificate" },
  { key: "cancelled_cheque", label: "Cancelled cheque" },
  { key: "photograph", label: "Photograph" },
  { key: "registration_form", label: "Registration form" },
  { key: "agreement_copy", label: "Agreement copy" },
  { key: "gst_copy", label: "GST certificate" }
];

export function PospMispOnboardingForm({ action, partnerType, salesManagers, oems }: Props) {
  const [state, formAction] = useActionState(action, { error: null, field: null });
  const [showError, setShowError] = useState(false);
  const [files, setFiles] = useState<Partial<Record<DocumentKey, File>>>({});
  const [associateId, setAssociateId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const isMisp = partnerType === "misp";
  const selectedAssociate = salesManagers.find((manager) => manager.id === associateId);

  useEffect(() => {
    setShowError(Boolean(state.error));
    if (!state.field) return;
    requestAnimationFrame(() => {
      const field = formRef.current?.elements.namedItem(state.field ?? "");
      if (field instanceof HTMLElement) {
        field.focus({ preventScroll: true });
        field.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, [state.error, state.field]);

  function submit(data: FormData) {
    for (const [field, selected] of Object.entries(files) as Array<[DocumentKey, File]>) data.set(field, selected, selected.name);
    formAction(data);
  }

  function setFile(field: DocumentKey, selected: File | null) {
    setFiles((current) => {
      const next = { ...current };
      if (selected) next[field] = selected;
      else delete next[field];
      return next;
    });
  }

  return (
    <>
      {state.error && showError ? <FeedbackToast tone="error" message={state.error} onClose={() => setShowError(false)} /> : null}
      <div className="mx-auto max-w-[1240px] space-y-2 pb-20">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <span className="rounded-full border border-[#D8DEE8] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#475569]">New partner type</span>
            <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[10.5px] font-semibold text-[#4338CA]">{partnerType.toUpperCase()}</span>
          </div>
          <div className="flex gap-3">
            <Link href="/customers/posp-misp/import" className="text-[10.5px] font-semibold text-[#4F46E5] hover:underline">Import Excel</Link>
            <Link href="/customers?choose_partner=1" className="text-[10.5px] font-semibold text-[#4F46E5] hover:underline">Change partner type</Link>
          </div>
        </div>

        <form ref={formRef} action={submit} className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
          <input type="hidden" name="partner_type" value={partnerType} />

          <Section title={isMisp ? "MISP Business Details" : "POSP Details"}>
            <SelectField
              label="Associate Name"
              name="associate_profile_id"
              value={associateId}
              onChange={(event) => setAssociateId(event.target.value)}
              required
              options={salesManagers.map((manager) => ({
                value: manager.id,
                label: `${manager.fullName}${manager.employeeCode ? ` - ${manager.employeeCode}` : ""}`
              }))}
              placeholder="Select Sales Manager"
            />
            <ReadOnlyValue label="Associate ID" value={selectedAssociate?.employeeCode ?? "Auto-filled from selected Sales Manager"} />
            <Field label={isMisp ? "MISP ID" : "Onboarding ID"} name="external_onboarding_id" placeholder="External onboarding ID" />
            <Field label="Document Received Date" name="document_received_at" type="date" />
            {isMisp ? <Field label="MISP Name" name="misp_name" required placeholder="MISP name" /> : <Field label="POS Name" name="pos_name" required placeholder="POS name" />}
            {isMisp ? <Field label="MISP PAN" name="pan_number" maxLength={10} placeholder="ABCDE1234F" /> : <Field label="PAN Number" name="pan_number" maxLength={10} placeholder="ABCDE1234F" />}
            {isMisp ? <SelectField label="OEM Name" name="oem_name" required options={oems} placeholder="Select OEM" /> : null}
            <Field label="GST Number" name="gst_number" maxLength={15} placeholder="Optional GSTIN" />
          </Section>

          <Section title={isMisp ? "Primary MISP Contact" : "Contact Details"}>
            <Field label="Mobile Number" name="applicant_phone" required inputMode="tel" placeholder="10-digit mobile" />
            <Field label="Email" name="applicant_email" type="email" placeholder="Email address" />
            <Field label="Date of Birth" name="date_of_birth" type="date" />
            <Field label="Aadhaar Number" name="aadhaar_number" inputMode="numeric" maxLength={12} placeholder="Stored as hash + last 4" />
            <Field label="Address" name="address" placeholder="Address" />
            <Field label="City" name="city" placeholder="City" />
            <Field label="State" name="state" placeholder="State" />
            <Field label="PIN Code" name="postal_code" inputMode="numeric" placeholder="PIN code" />
          </Section>

          {isMisp ? (
            <Section title="DP Contact">
              <Field label="DP Name" name="dp_name" required placeholder="DP name" />
              <Field label="DP Mobile" name="dp_phone" required inputMode="tel" placeholder="10-digit mobile" />
              <Field label="DP Email" name="dp_email" type="email" placeholder="DP email" />
              <Field label="DP PAN" name="dp_pan_number" maxLength={10} placeholder="ABCDE1234F" />
            </Section>
          ) : null}

          <Section title="Bank and IIB Details">
            <ReadOnlyValue label="Education / Marksheet Status" value={files.education_certificate ? "Received" : "Not received"} />
            <Field label="Bank Name" name="bank_name" placeholder="Bank name" />
            <Field label="Account Number" name="bank_account_number" placeholder="Account number" />
            <Field label="IFSC Code" name="bank_ifsc_code" placeholder="IFSC" />
            <SelectField label="IIB Remarks" name="iib_remarks" options={iibRemarks.map((remark) => ({ value: remark, label: remark }))} placeholder="Select IIB remark" />
            <CheckboxField label="IIB uploaded" name="iib_uploaded" helper="Status becomes Uploaded when checked." />
            <Field label="IIB Upload Date" name="iib_uploaded_at" type="date" />
          </Section>

          <Section title="Training and Exam Credentials">
            <CheckboxField label="Credentials shared" name="training_credentials_shared_flag" helper="Marks login details as shared." />
            <Field label="Training Login ID" name="training_login_id" placeholder="Real login ID" />
            <Field label="Training Password" name="training_password" placeholder="Real password" />
            <Field label="Training Start Date" name="training_start_date" type="date" />
            <Field label="Training End Date" name="training_end_date" type="date" />
            <Field label="Training Status" name="training_status" placeholder="Status" />
            <Field label="Training Certificate No." name="training_certificate_number" placeholder="Certificate number" />
            <Field label="Exam Status" name="exam_status" placeholder="Exam status" />
            <Field label="Onboarding Date" name="onboarding_date" type="date" />
          </Section>

          <section className="border-b border-[#E2E8F0] px-5 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-semibold text-[#0F172A]">Documents</h3>
                <p className="mt-1 text-[10px] text-[#64748B]">Status is marked Received only when a file is uploaded here.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {documentFields.map((document) => <FileField key={document.key} label={document.label} name={document.key} file={files[document.key]} onChange={(selected) => setFile(document.key, selected)} />)}
            </div>
          </section>

          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-white/95 px-5 py-3 backdrop-blur">
            <Link href="/customers/posp-misp" className="rounded-md border border-[#CBD5E1] px-4 py-2 text-[11px] font-semibold text-[#334155]">Cancel</Link>
            <FormSubmitButton label="Submit Application" />
          </div>
        </form>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-b border-[#E2E8F0] px-5 py-4"><h3 className="mb-3 text-[13px] font-semibold text-[#0F172A]">{title}</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>;
}

function Field({ label, name, required = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} required={required} className={inputClass} {...props} /></div>;
}

function SelectField({ label, name, required = false, options, placeholder, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: Array<{ value: string; label: string }>; placeholder: string }) {
  return (
    <div>
      <label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label>
      <select id={name} name={name} required={required} className={inputClass} {...props}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function CheckboxField({ label, name, helper }: { label: string; name: string; helper: string }) {
  return (
    <label className="flex h-9 items-center gap-3 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[11px] font-semibold text-[#17203A]">
      <input type="checkbox" name={name} value="true" className="h-4 w-4 rounded border-[#CBD5E1] text-[#4F46E5]" />
      <span className="min-w-0">
        <span className="block">{label}</span>
        <span className="block truncate text-[9px] font-medium text-[#64748B]">{helper}</span>
      </span>
    </label>
  );
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div className="flex h-9 items-center rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[11px] font-semibold text-[#475569]">{value}</div>
    </div>
  );
}

function FileField({ label, name, file, onChange }: { label: string; name: DocumentKey; file?: File; onChange: (file: File | null) => void }) {
  return <div><span className={labelClass}>{label}</span><label htmlFor={name} className={`flex h-9 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-[10.5px] ${file ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B]"}`}><span>{file ? "Received" : "Not received"}</span><span className="min-w-0 flex-1 truncate">{file?.name ?? "Choose file"}</span></label><input id={name} name={name} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(event) => onChange(event.target.files?.[0] ?? null)} /></div>;
}
