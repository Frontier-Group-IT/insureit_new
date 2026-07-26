"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, FileCheck2, UserRound } from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { FeedbackToast } from "@/components/ui-feedback";
import { IndianDateField } from "@/components/indian-date-field";
import type { PospMispState } from "./actions";

type PartnerType = "posp" | "misp";
type DocumentKey = "aadhaar_front" | "aadhaar_back" | "pan_copy" | "education_10th_marksheet" | "education_12th_marksheet" | "education_graduation_marksheet" | "education_post_graduation_marksheet" | "cancelled_cheque" | "photograph" | "gst_copy";
type Props = { action: (state: PospMispState, data: FormData) => Promise<PospMispState>; partnerType: PartnerType; salesManagers: Array<{ id: string; fullName: string; employeeCode: string | null }>; oems: Array<{ value: string; label: string }>; banks: Array<{ value: string; label: string }> };

const inputClass = "h-11 w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-[12px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-4 focus:ring-[#E0E7FF]";
const labelClass = "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.045em] text-[#526178]";
const documentFields: Array<{ key: DocumentKey; label: string }> = [
  { key: "aadhaar_front", label: "Aadhaar front" },
  { key: "aadhaar_back", label: "Aadhaar back" },
  { key: "pan_copy", label: "PAN copy" },
  { key: "cancelled_cheque", label: "Cancelled cheque" },
  { key: "photograph", label: "Photograph" },
  { key: "gst_copy", label: "GST certificate" }
];
const educationOptions: Array<{ value: DocumentKey; label: string }> = [
  { value: "education_10th_marksheet", label: "10th Marksheet" },
  { value: "education_12th_marksheet", label: "12th Marksheet" },
  { value: "education_graduation_marksheet", label: "Graduation Marksheet" },
  { value: "education_post_graduation_marksheet", label: "Post Graduation Marksheet" }
];

export function PospMispOnboardingForm({ action, partnerType, salesManagers, oems, banks }: Props) {
  const [state, formAction] = useActionState(action, { error: null, field: null });
  const [showError, setShowError] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [files, setFiles] = useState<Partial<Record<DocumentKey, File>>>({});
  const [marksheetType, setMarksheetType] = useState<DocumentKey | "">("");
  const [marksheetFile, setMarksheetFile] = useState<File | null>(null);
  const [associateId, setAssociateId] = useState("");
  const [dpFirstName, setDpFirstName] = useState("");
  const [dpMiddleName, setDpMiddleName] = useState("");
  const [dpLastName, setDpLastName] = useState("");
  const [dpPhone, setDpPhone] = useState("");
  const [dpEmail, setDpEmail] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const stageOneRef = useRef<HTMLDivElement>(null);
  const isMisp = partnerType === "misp";

  useEffect(() => {
    setShowError(Boolean(state.error));
    if (!state.field) return;
    setStep(1);
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
    if (marksheetType && marksheetFile) data.set(marksheetType, marksheetFile, marksheetFile.name);
    if (isMisp) {
      data.set("dp_name", [dpFirstName, dpMiddleName, dpLastName].filter(Boolean).join(" "));
      data.set("applicant_phone", dpPhone);
      data.set("applicant_email", dpEmail);
    }
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

  function continueFromPrimary() {
    const controls = Array.from(stageOneRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select") ?? []);
    const invalid = controls.find((control) => !control.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const attachedCount = Object.keys(files).length + (marksheetFile ? 1 : 0);

  return <>
    {state.error && showError ? <FeedbackToast tone="error" message={state.error} onClose={() => setShowError(false)} /> : null}
    <div className="mx-auto max-w-[1120px] space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2"><span className="rounded-full border border-[#D8DEE8] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#475569]">New application</span><span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[10.5px] font-semibold text-[#4338CA]">{partnerType.toUpperCase()}</span></div>
        <div className="flex gap-3"><Link href="/customers/posp-misp/import" className="text-[10.5px] font-semibold text-[#4F46E5] hover:underline">Import Excel</Link><Link href="/customers/posp-misp" className="text-[10.5px] font-semibold text-[#4F46E5] hover:underline">Back</Link></div>
      </div>

      <StageHeader step={step} />

      <form ref={formRef} action={submit} className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-[0_18px_50px_rgba(15,23,42,.07)]">
        <input type="hidden" name="partner_type" value={partnerType} />

        <div className={step === 1 ? "block" : "hidden"} ref={stageOneRef}>
          <StageTitle number="1" title="Primary information" description="Identity, contact, address and bank details" icon={<UserRound className="h-4 w-4" />} />
          <Section title={isMisp ? "MISP details" : "POSP details"}>
            <SelectField label="RM Name" name="associate_employee_id" value={associateId} onChange={(event) => setAssociateId(event.target.value)} required options={salesManagers.map((manager) => ({ value: manager.id, label: `${manager.fullName}${manager.employeeCode ? ` - ${manager.employeeCode}` : ""}` }))} placeholder="Select RM" />
            <Field label={isMisp ? "MISP ID" : "POSP ID"} name="external_onboarding_id" required placeholder={isMisp ? "Enter MISP ID" : "Enter POSP ID"} />
            <IndianDateField label="Document Received Date" name="document_received_at" />
            {isMisp ? <Field label="MISP Name" name="misp_name" required placeholder="MISP name" /> : <Field label="POS Name" name="pos_name" required placeholder="POS name" />}
            <Field label={isMisp ? "MISP PAN" : "PAN Number"} name="pan_number" required maxLength={10} minLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" placeholder="ABCDE1234F" title="Enter a valid PAN" />
            {isMisp ? <SelectField label="OEM Name" name="oem_name" required options={oems} placeholder="Select OEM" /> : null}
            <Field label="GST Number" name="gst_number" maxLength={15} placeholder="GSTIN" />
          </Section>

          <Section title={isMisp ? "Designated person" : "Contact details"}>
            {isMisp ? <>
              <Field label="DP First Name" name="dp_first_name" value={dpFirstName} onChange={(event) => setDpFirstName(event.target.value)} required />
              <Field label="DP Middle Name" name="dp_middle_name" value={dpMiddleName} onChange={(event) => setDpMiddleName(event.target.value)} required />
              <Field label="DP Last Name" name="dp_last_name" value={dpLastName} onChange={(event) => setDpLastName(event.target.value)} required />
              <Field label="DP Contact" name="dp_phone" value={dpPhone} onChange={(event) => setDpPhone(event.target.value)} required inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" placeholder="10-digit mobile" />
              <Field label="DP Email" name="dp_email" value={dpEmail} onChange={(event) => setDpEmail(event.target.value)} required type="email" placeholder="Email address" />
              <Field label="DP PAN No" name="dp_pan_number" required maxLength={10} minLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" placeholder="ABCDE1234F" title="Enter a valid PAN" />
              <IndianDateField label="Date of Birth" name="date_of_birth" required />
              <Field label="DP Aadhaar Number" name="aadhaar_number" required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} minLength={12} placeholder="12-digit Aadhaar" title="Enter exactly 12 digits" />
            </> : <>
              <Field label="Mobile Number" name="applicant_phone" required inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" placeholder="10-digit mobile" />
              <Field label="Email" name="applicant_email" type="email" required placeholder="Email address" />
              <IndianDateField label="Date of Birth" name="date_of_birth" required />
              <Field label="Aadhaar Number" name="aadhaar_number" required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} minLength={12} placeholder="12-digit Aadhaar" title="Enter exactly 12 digits" />
            </>}
          </Section>

          <Section title="Address">
            <div className="md:col-span-2"><Field label="Address" name="address" required placeholder="Address" /></div>
            <Field label="City" name="city" required placeholder="City" />
            <Field label="State" name="state" required placeholder="State" />
            <Field label="PIN Code" name="postal_code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} placeholder="6-digit PIN" title="Enter a valid 6-digit PIN code" />
          </Section>

          <Section title="Bank details">
            <SelectField label="Bank Name" name="bank_id" required options={banks} placeholder="Select bank" />
            <Field label="Account Number" name="bank_account_number" required inputMode="numeric" pattern="[0-9]{6,20}" placeholder="Account number" title="Enter a valid bank account number" />
            <Field label="IFSC Code" name="bank_ifsc_code" required maxLength={11} minLength={11} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" placeholder="ABCD0123456" title="Enter a valid 11-character IFSC code" />
          </Section>

          <StageFooter><Link href="/customers/posp-misp" className="rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-[11px] font-semibold text-[#334155]">Cancel</Link><button type="button" onClick={continueFromPrimary} className="inline-flex items-center gap-2 rounded-xl bg-[#0F2A55] px-5 py-2.5 text-[11px] font-semibold text-white">Continue to documents <ChevronRight className="h-4 w-4" /></button></StageFooter>
        </div>

        <div className={step === 2 ? "block" : "hidden"}>
          <StageTitle number="2" title="Documents" description="Attach the documents currently available" icon={<FileCheck2 className="h-4 w-4" />} />
          <section className="p-5"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><SelectField label="Marksheet Type" name="education_document_type" value={marksheetType} onChange={(event) => setMarksheetType(event.target.value as DocumentKey | "")} required={Boolean(marksheetFile)} options={educationOptions} placeholder="Select marksheet type" /><FileField label="Marksheet" name="education_marksheet" file={marksheetFile ?? undefined} onChange={setMarksheetFile} />{documentFields.map((document) => <FileField key={document.key} label={document.label} name={document.key} file={files[document.key]} onChange={(selected) => setFile(document.key, selected)} />)}</div></section>
          <StageFooter><button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-2 rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-[11px] font-semibold text-[#334155]"><ChevronLeft className="h-4 w-4" /> Back</button><button type="button" onClick={() => { setStep(3); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex items-center gap-2 rounded-xl bg-[#0F2A55] px-5 py-2.5 text-[11px] font-semibold text-white">Continue to review <ChevronRight className="h-4 w-4" /></button></StageFooter>
        </div>

        <div className={step === 3 ? "block" : "hidden"}>
          <StageTitle number="3" title="Review and submit" description="Confirm the application before creating the onboarding file" icon={<Check className="h-4 w-4" />} />
          <div className="grid gap-3 p-5 sm:grid-cols-3"><ReviewCard label="Application type" value={partnerType.toUpperCase()} /><ReviewCard label="Primary information" value="Complete" tone="success" /><ReviewCard label="Documents attached" value={String(attachedCount)} /></div>
          <div className="mx-5 mb-5 rounded-xl border border-[#DCE5EF] bg-[#F8FAFC] px-4 py-3 text-[10.5px] leading-5 text-[#526178]">Submitting creates the onboarding application and starts automatic PAN verification when the required PAN and bank details are available.</div>
          <StageFooter><button type="button" onClick={() => setStep(2)} className="inline-flex items-center gap-2 rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-[11px] font-semibold text-[#334155]"><ChevronLeft className="h-4 w-4" /> Back</button><FormSubmitButton label="Submit Application" pendingLabel="Submitting application" className="inline-flex min-w-[170px] items-center justify-center rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4285F4] px-5 py-2.5 text-[11px] font-semibold text-white disabled:opacity-70" /></StageFooter>
        </div>
      </form>
    </div>
  </>;
}

function StageHeader({ step }: { step: 1 | 2 | 3 }) {
  const stages = ["Primary information", "Documents", "Review"];
  return <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">{stages.map((label, index) => { const number = index + 1; const complete = number < step; const active = number === step; return <div key={label} className={`flex items-center gap-3 border-r border-[#E2E8F0] px-4 py-3 last:border-r-0 ${active ? "bg-[#EEF2FF]" : ""}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${complete ? "bg-emerald-600 text-white" : active ? "bg-[#4F46E5] text-white" : "bg-[#F1F5F9] text-[#94A3B8]"}`}>{complete ? <Check className="h-3.5 w-3.5" /> : number}</span><span className={`hidden text-[10.5px] font-semibold sm:block ${active ? "text-[#3730A3]" : complete ? "text-emerald-700" : "text-[#94A3B8]"}`}>{label}</span></div>; })}</div>;
}
function StageTitle({ number, title, description, icon }: { number: string; title: string; description: string; icon: React.ReactNode }) { return <div className="flex items-center gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0F2A55] text-white">{icon}</span><div><p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#64748B]">Stage {number}</p><h2 className="text-[14px] font-semibold text-[#0F172A]">{title}</h2><p className="text-[9.5px] text-[#64748B]">{description}</p></div></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-[#E2E8F0] px-5 py-5"><h3 className="mb-4 text-[11px] font-bold uppercase tracking-[.055em] text-[#334155]">{title}</h3><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>; }
function StageFooter({ children }: { children: React.ReactNode }) { return <div className="flex items-center justify-between gap-2 border-t border-[#E2E8F0] bg-white px-5 py-4">{children}</div>; }
function ReviewCard({ label, value, tone }: { label: string; value: string; tone?: "success" }) { return <div className={`rounded-xl border p-4 ${tone === "success" ? "border-emerald-200 bg-emerald-50" : "border-[#DCE5EF] bg-white"}`}><p className="text-[9px] font-bold uppercase tracking-[.05em] text-[#64748B]">{label}</p><p className={`mt-1 text-[13px] font-semibold ${tone === "success" ? "text-emerald-700" : "text-[#0F172A]"}`}>{value}</p></div>; }
function Field({ label, name, required = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) { return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} required={required} className={inputClass} {...props} /></div>; }
function SelectField({ label, name, required = false, options, placeholder, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: Array<{ value: string; label: string }>; placeholder: string }) { return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><select id={name} name={name} required={required} className={inputClass} {...props}><option value="">{placeholder}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>; }
function FileField({ label, name, file, onChange }: { label: string; name: string; file?: File; onChange: (file: File | null) => void }) { return <div><span className={labelClass}>{label}</span><label htmlFor={name} className={`flex h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[10.5px] transition ${file ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B] hover:border-[#94A3B8]"}`}><span className={`h-2 w-2 rounded-full ${file ? "bg-emerald-500" : "bg-[#CBD5E1]"}`} /><span className="min-w-0 flex-1 truncate">{file?.name ?? "Choose file"}</span><span className="font-semibold">{file ? "Attached" : "Browse"}</span></label><input id={name} name={name} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(event) => onChange(event.target.files?.[0] ?? null)} /></div>; }
