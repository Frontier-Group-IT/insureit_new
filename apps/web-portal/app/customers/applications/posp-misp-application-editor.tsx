"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FormSubmitButton } from "@/components/form-submit-button";
import { IndianDateField } from "@/components/indian-date-field";
import { IntermediaryDocumentGrid } from "@/components/intermediary-document-grid";
import { inlineFieldErrorId, validateInlineForm } from "@/components/inline-field-validation";
import { buildIntermediaryDocumentSlots, findDocumentForSlot } from "@/lib/intermediary-document-slots";
import { updateIntermediaryApplication } from "./intermediary-edit-actions";
import { retryPospMispPanVerification } from "./posp-misp-workflow-actions";

export type PospMispEditProfile = {
  partner_type: "posp" | "misp";
  partner_id: string | null;
  associate_employee_id: string | null;
  associate_profile_id: string | null;
  external_onboarding_id: string | null;
  document_received_at: string | null;
  pos_name: string | null;
  pos_first_name: string | null;
  pos_middle_name: string | null;
  pos_last_name: string | null;
  misp_name: string | null;
  applicant_phone: string | null;
  applicant_email: string | null;
  date_of_birth: string | null;
  aadhaar_last_four: string | null;
  aadhaar_exists: boolean;
  pan_number: string | null;
  gst_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  bank_id: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  oem_name: string | null;
  dp_name: string | null;
  dp_first_name: string | null;
  dp_middle_name: string | null;
  dp_last_name: string | null;
  dp_phone: string | null;
  dp_email: string | null;
  dp_pan_number: string | null;
};

type WorkflowStage = "pre_iib" | "iib_processing" | "training" | "completed";
type ViewStage = "primary" | "documents" | "review";
type DocumentRecord = { document_type: string; file_name: string; document_label?: string | null };
type Props = {
  applicationId: string;
  profile: PospMispEditProfile;
  workflowStage?: WorkflowStage;
  viewStage?: ViewStage;
  editable: boolean;
  salesManagers: Array<{ value: string; label: string }>;
  banks: Array<{ value: string; label: string }>;
  oems: Array<{ value: string; label: string }>;
  documents: DocumentRecord[];
  legacyDocuments?: boolean;
  actionTargetId?: string;
};

const inputClass = "h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition focus:border-[#635BFF] focus:ring-2 focus:ring-[#E7E5FF] disabled:bg-[#F8FAFC] disabled:text-[#475569] aria-[invalid=true]:border-red-400 aria-[invalid=true]:bg-red-50/40 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-100";
const labelClass = "mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#526178]";
const namePattern = "[A-Za-z ]+";

export function PospMispApplicationEditor({ applicationId, profile, workflowStage = "pre_iib", viewStage, editable, salesManagers, banks, oems, documents, legacyDocuments = false, actionTargetId }: Props) {
  const isMisp = profile.partner_type === "misp";
  const fallbackPos = useMemo(() => splitName(profile.pos_name), [profile.pos_name]);
  const fallbackDp = useMemo(() => splitName(profile.dp_name), [profile.dp_name]);
  const [posFirstName, setPosFirstName] = useState(profile.pos_first_name ?? fallbackPos.first);
  const [posMiddleName, setPosMiddleName] = useState(profile.pos_middle_name ?? fallbackPos.middle);
  const [posLastName, setPosLastName] = useState(profile.pos_last_name ?? fallbackPos.last);
  const [dpFirstName, setDpFirstName] = useState(profile.dp_first_name ?? fallbackDp.first);
  const [dpMiddleName, setDpMiddleName] = useState(profile.dp_middle_name ?? fallbackDp.middle);
  const [dpLastName, setDpLastName] = useState(profile.dp_last_name ?? fallbackDp.last);
  const [dpPhone, setDpPhone] = useState(profile.dp_phone ?? profile.applicant_phone ?? "");
  const [dpEmail, setDpEmail] = useState(profile.dp_email ?? profile.applicant_email ?? "");
  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>({});
  const [missingDocument, setMissingDocument] = useState<string | null>(null);
  const [submittingIntent, setSubmittingIntent] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const formId = `posp-misp-editor-${applicationId}`;
  const [actionTarget, setActionTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setActionTarget(actionTargetId ? document.getElementById(actionTargetId) : null);
  }, [actionTargetId]);

  useEffect(() => {
    if (!submittingIntent) return;
    const timeout = window.setTimeout(() => setSubmittingIntent(null), 30000);
    return () => window.clearTimeout(timeout);
  }, [submittingIntent]);

  const activeView = viewStage ?? (workflowStage === "pre_iib" ? "primary" : workflowStage === "iib_processing" ? "documents" : "review");
  const showPrimary = activeView === "primary";
  const showDocuments = activeView === "documents";
  const showReview = activeView === "review";
  const slots = useMemo(() => buildIntermediaryDocumentSlots({ legacy: legacyDocuments, hasGst: Boolean(profile.gst_number) }), [legacyDocuments, profile.gst_number]);
  const requiredSlots = slots.filter((slot) => slot.required);
  const documentsReady = requiredSlots.every((slot) => Boolean(findDocumentForSlot(slot, documents)) || selectedFiles[slot.key]);
  const actionBar = editable && (showPrimary || showDocuments) ? (
    <div className={`${actionTargetId ? "flex flex-col gap-3 rounded-2xl border border-[#DCE5EF] bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between" : "sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-[#DCE5EF] bg-white/95 px-5 py-3 backdrop-blur"}`}>
      {showDocuments ? <Link href={`/intermediaries/applications/${applicationId}/workflow?stage=primary`} className="rounded-xl border px-4 py-2.5 text-[10.5px] font-semibold">Back to Primary</Link> : <span />}
      <div className="text-right">
        {showDocuments && !documentsReady ? <p className="mb-1 text-[8.5px] font-semibold text-amber-700">Attach every mandatory document before saving.</p> : null}
        {showPrimary ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <FormSubmitButton form={formId} name="submit_intent" value="exit" label="Save & Exit" pendingLabel="Saving & exiting…" forcePending={submittingIntent === "exit"} className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10.5px] font-semibold text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC]" />
            <FormSubmitButton form={formId} name="submit_intent" value="documents" label="Save & return to documents" pendingLabel="Saving & opening documents…" forcePending={submittingIntent === "documents"} />
          </div>
        ) : <FormSubmitButton form={formId} label="Save documents" pendingLabel="Saving" />}
      </div>
    </div>
  ) : null;

  function handleFileChange(name: string, selected: boolean) {
    setSelectedFiles((current) => ({ ...current, [name]: selected }));
    if (selected && missingDocument === name) setMissingDocument(null);
  }

  function focusDocument(name: string) {
    setMissingDocument(name);
    requestAnimationFrame(() => document.getElementById(`document-${name}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const native = event.nativeEvent as SubmitEvent;
    const submitter = native.submitter as HTMLElement | null;
    if (submitter?.dataset.skipValidation === "true") return;
    const intent = submitter instanceof HTMLButtonElement ? submitter.value || "save" : "save";
    setSubmittingIntent(intent);
    if (showPrimary && !validateInlineForm(event.currentTarget)) {
      event.preventDefault();
      setSubmittingIntent(null);
      return;
    }
    if (!showDocuments) return;
    const missing = requiredSlots.find((slot) => !findDocumentForSlot(slot, documents) && !selectedFiles[slot.key]);
    if (missing) {
      event.preventDefault();
      setSubmittingIntent(null);
      focusDocument(missing.key);
    }
  }

  return (
    <>
    <form id={formId} ref={formRef} action={editable ? updateIntermediaryApplication : undefined} onSubmitCapture={handleSubmit} noValidate className="bg-[#F4F7FB]">
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="edit_section" value={showDocuments ? "documents" : "primary"} />
      <input type="hidden" name="external_onboarding_id" value={profile.external_onboarding_id ?? `PENDING-${profile.partner_type.toUpperCase()}-${applicationId}`} />
      {isMisp ? <><input type="hidden" name="dp_name" value={[dpFirstName, dpMiddleName, dpLastName].filter(Boolean).join(" ")} /><input type="hidden" name="applicant_phone" value={dpPhone} /><input type="hidden" name="applicant_email" value={dpEmail} /></> : <input type="hidden" name="pos_name" value={[posFirstName, posMiddleName, posLastName].filter(Boolean).join(" ")} />}

      <div className="space-y-4 p-4 sm:p-5">
        {showPrimary ? (
          <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
            <Header number="1" title="Primary information & PAN check" subtitle="POSP/MISP IDs are issued only after successful onboarding." />
            <div className="space-y-0">
              <EditorSection title={isMisp ? "MISP details" : "POSP details"}>
                <div className={`grid gap-4 md:grid-cols-2 xl:col-span-4 ${isMisp ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
                  <Select label="RM Name" name="associate_employee_id" defaultValue={profile.associate_employee_id ?? profile.associate_profile_id ?? ""} options={salesManagers} required disabled={!editable} />
                  {isMisp ? <Field label="MISP Name" name="misp_name" defaultValue={profile.misp_name ?? ""} required disabled={!editable} /> : null}
                  <PanField label={isMisp ? "MISP PAN" : "PAN Number"} name="pan_number" value={profile.pan_number ?? ""} editable={editable} recheck={!isMisp} />
                  <IndianDateField label="Document Received Date" name="document_received_at" defaultValue={profile.document_received_at} disabled={!editable} />
                </div>
                {!isMisp ? <div className="grid gap-4 md:grid-cols-3 xl:col-span-4"><Field label="POS First Name" name="pos_first_name" value={posFirstName} onChange={(event) => setPosFirstName(event.target.value)} required pattern={namePattern} disabled={!editable} /><Field label="POS Middle Name" name="pos_middle_name" value={posMiddleName} onChange={(event) => setPosMiddleName(event.target.value)} pattern={namePattern} disabled={!editable} /><Field label="POS Last Name" name="pos_last_name" value={posLastName} onChange={(event) => setPosLastName(event.target.value)} required pattern={namePattern} disabled={!editable} /></div> : null}
                {isMisp ? <Select label="OEM Name" name="oem_name" defaultValue={profile.oem_name ?? ""} options={oems} required disabled={!editable} /> : null}
                <Field label="Address" name="address" defaultValue={profile.address ?? ""} required disabled={!editable} />
                <Field label="City" name="city" defaultValue={profile.city ?? ""} required disabled={!editable} />
                <Field label="State" name="state" defaultValue={profile.state ?? ""} required disabled={!editable} />
                <Field label="PIN Code" name="postal_code" defaultValue={profile.postal_code ?? ""} required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} disabled={!editable} />
              </EditorSection>
              {!isMisp ? <EditorSection title="POSP contact"><Field label="Mobile Number" name="applicant_phone" defaultValue={profile.applicant_phone ?? ""} required inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" disabled={!editable} /><Field label="Email" name="applicant_email" defaultValue={profile.applicant_email ?? ""} type="email" required disabled={!editable} /><IndianDateField label="Date of Birth" name="date_of_birth" defaultValue={profile.date_of_birth} required disabled={!editable} /><AadhaarReplacementField label="Aadhaar Number" lastFour={profile.aadhaar_last_four} hasExisting={profile.aadhaar_exists} disabled={!editable} /></EditorSection> : null}
              {isMisp ? <EditorSection title="Designated Person (DP)"><Field label="DP First Name" name="dp_first_name" value={dpFirstName} onChange={(event) => setDpFirstName(event.target.value)} required pattern={namePattern} disabled={!editable} /><Field label="DP Middle Name" name="dp_middle_name" value={dpMiddleName} onChange={(event) => setDpMiddleName(event.target.value)} pattern={namePattern} disabled={!editable} /><Field label="DP Last Name" name="dp_last_name" value={dpLastName} onChange={(event) => setDpLastName(event.target.value)} required pattern={namePattern} disabled={!editable} /><Field label="DP Contact" name="dp_phone" value={dpPhone} onChange={(event) => setDpPhone(event.target.value)} required inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" disabled={!editable} /><Field label="DP Email" name="dp_email" value={dpEmail} onChange={(event) => setDpEmail(event.target.value)} required type="email" disabled={!editable} /><PanField label="DP PAN No" name="dp_pan_number" value={profile.dp_pan_number ?? ""} editable={editable} recheck /><IndianDateField label="DP Date of Birth" name="date_of_birth" defaultValue={profile.date_of_birth} required disabled={!editable} /><AadhaarReplacementField label="DP Aadhaar Number" lastFour={profile.aadhaar_last_four} hasExisting={profile.aadhaar_exists} disabled={!editable} /></EditorSection> : null}
              <EditorSection title="Bank details"><Select label="Bank Name" name="bank_id" defaultValue={profile.bank_id ?? ""} options={banks} required disabled={!editable} /><Field label="Account Number" name="bank_account_number" defaultValue={profile.bank_account_number ?? ""} required inputMode="numeric" pattern="[0-9]{6,20}" disabled={!editable} /><Field label="IFSC Code" name="bank_ifsc_code" defaultValue={profile.bank_ifsc_code ?? ""} required maxLength={11} minLength={11} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); }} disabled={!editable} /><Field label="GST Number" name="gst_number" defaultValue={profile.gst_number ?? ""} required={isMisp} maxLength={15} minLength={isMisp ? 15 : undefined} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); }} disabled={!editable} /></EditorSection>
            </div>
          </section>
        ) : null}

        {showDocuments ? <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm"><Header number="2" title="Documents" /><div className="p-4"><IntermediaryDocumentGrid documents={documents} legacy={legacyDocuments} hasGst={Boolean(profile.gst_number)} editable={editable} missingDocument={missingDocument} onFileSelection={handleFileChange} /></div></section> : null}

        {showReview ? <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm"><Header number="3" title="Final review" subtitle="Review the saved details and attached documents." /><div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3"><Summary label="Application type" value={profile.partner_type.toUpperCase()} /><Summary label="Partner ID" value={profile.partner_id ?? "Pending until Stage 2"} /><Summary label="Applicant" value={(isMisp ? profile.misp_name : profile.pos_name) ?? "-"} /><Summary label="Email" value={(isMisp ? profile.dp_email : profile.applicant_email) ?? "-"} /><Summary label="Documents" value={`${documents.length} attached`} /><Summary label="PAN used for IIB" value={(isMisp ? profile.dp_pan_number : profile.pan_number) ?? "-"} /></div></section> : null}
      </div>

      {!actionTargetId ? actionBar : null}
    </form>
    {actionTargetId && actionTarget && actionBar ? createPortal(actionBar, actionTarget) : null}
    </>
  );
}

function PanField({ label, name, value, editable, recheck }: { label: string; name: string; value: string; editable: boolean; recheck: boolean }) { const errorId = inlineFieldErrorId(name); return <div data-field-container className="min-w-0"><label className={labelClass} htmlFor={name}>{label} *</label><div className="flex gap-2"><input id={name} name={name} defaultValue={value} required maxLength={10} minLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" disabled={!editable} onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); }} className={`${inputClass} flex-1 font-mono`} />{recheck ? <button type="submit" data-skip-validation="true" formAction={retryPospMispPanVerification} className="h-10 w-10 rounded-xl border bg-[#EEF2FF]">↻</button> : null}</div><p id={errorId} data-field-error hidden className="mt-1.5 text-[9.5px] font-semibold normal-case tracking-normal text-red-600" /></div>; }
function AadhaarReplacementField({ label, lastFour, hasExisting, disabled }: { label: string; lastFour: string | null; hasExisting: boolean; disabled: boolean }) { const masked = lastFour ? `•••• •••• ${lastFour}` : "Aadhaar stored securely"; const name = "aadhaar_number"; const errorId = inlineFieldErrorId(name); return <div data-field-container className="min-w-0"><label className={labelClass} htmlFor={name}>{hasExisting ? `Replace ${label}` : label}{hasExisting ? "" : " *"}</label>{hasExisting ? <p className="mb-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-mono text-[10px] font-semibold tracking-[.08em] text-emerald-800">On file: {masked}</p> : null}<input id={name} name={name} defaultValue="" required={!hasExisting} maxLength={12} minLength={hasExisting ? undefined : 12} pattern="[0-9]{12}" inputMode="numeric" autoComplete="off" placeholder={hasExisting ? "Enter 12 digits only to replace" : "Enter 12-digit Aadhaar"} disabled={disabled} className={`${inputClass} font-mono`} /><p id={errorId} data-field-error hidden className="mt-1.5 text-[9.5px] font-semibold normal-case tracking-normal text-red-600" />{hasExisting ? <p className="mt-1 text-[8.5px] text-[#64748B]">Leave blank to keep the current Aadhaar.</p> : null}</div>; }
function splitName(value: string | null) { const parts = (value ?? "").trim().split(/\s+/).filter(Boolean); if (!parts.length) return { first: "", middle: "", last: "" }; if (parts.length === 1) return { first: parts[0], middle: "", last: "" }; return { first: parts[0], middle: parts.slice(1, -1).join(" "), last: parts.at(-1) ?? "" }; }
function Header({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) { return <div className="flex items-start gap-3 border-b border-[#DCE5EF] bg-[#F4F7FB] px-4 py-3 text-[#0F172A]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#071D49] text-[9px] font-bold text-white">{number}</span><div><h3 className="text-[12.5px] font-semibold text-[#0F172A]">{title}</h3>{subtitle ? <p className="mt-0.5 text-[9.8px] text-[#64748B]">{subtitle}</p> : null}</div></div>; }
function EditorSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-[#E2E8F0] px-4 py-4"><h4 className="mb-3 text-[11px] font-semibold text-[#0F172A]">{title}</h4><div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-[#F8FAFC] p-3"><p className="text-[8.5px] uppercase text-[#64748B]">{label}</p><p className="mt-1 text-[10.5px] font-semibold">{value}</p></div>; }
function Field({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) { const errorId = inlineFieldErrorId(name); return <div data-field-container className="min-w-0"><label className={labelClass} htmlFor={name}>{label}{props.required ? " *" : ""}</label><input id={name} name={name} className={inputClass} {...props} /><p id={errorId} data-field-error hidden className="mt-1.5 text-[9.5px] font-semibold normal-case tracking-normal text-red-600" /></div>; }
function Select({ label, name, options, required, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: ReadonlyArray<{ value: string; label: string }>; required?: boolean }) { const errorId = inlineFieldErrorId(name); return <div data-field-container className="min-w-0"><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><select id={name} name={name} required={required} className={inputClass} {...props}><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><p id={errorId} data-field-error hidden className="mt-1.5 text-[9.5px] font-semibold normal-case tracking-normal text-red-600" /></div>; }
