"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_LEGACY_WORKFLOW,
  LEGACY_AGREEMENT_OPTIONS,
  LEGACY_EXAM_OPTIONS,
  LEGACY_IIB_REGISTRATION_OPTIONS,
  LEGACY_IIB_UPLOAD_OPTIONS,
  LEGACY_TRAINING_OPTIONS,
} from "./legacy-workflow-statuses";

type Props = { partnerType:"posp"|"misp"; initialValues?:Record<string,string> };
type StatusOption = { readonly value:string; readonly label:string };

export function LegacyOnboardingFields({ partnerType, initialValues = {} }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const remarksRef = useRef<HTMLTextAreaElement>(null);
  const [remarksError, setRemarksError] = useState<string | null>(null);
  const [trainingStatus, setTrainingStatus] = useState(() => initialStatus(LEGACY_TRAINING_OPTIONS, initialValues.legacy_training_status, DEFAULT_LEGACY_WORKFLOW.trainingStatus));
  const [examStatus, setExamStatus] = useState(() => initialStatus(LEGACY_EXAM_OPTIONS, initialValues.legacy_exam_status, DEFAULT_LEGACY_WORKFLOW.examStatus));
  const [agreementStatus, setAgreementStatus] = useState(() => initialStatus(LEGACY_AGREEMENT_OPTIONS, initialValues.legacy_agreement_status, DEFAULT_LEGACY_WORKFLOW.agreementStatus));
  const [iibUploadStatus, setIibUploadStatus] = useState(() => initialStatus(LEGACY_IIB_UPLOAD_OPTIONS, initialValues.legacy_iib_upload_status, DEFAULT_LEGACY_WORKFLOW.iibUploadStatus));
  const [iibRegistrationStatus, setIibRegistrationStatus] = useState(() => initialStatus(LEGACY_IIB_REGISTRATION_OPTIONS, initialValues.legacy_iib_registration_status, DEFAULT_LEGACY_WORKFLOW.iibRegistrationStatus));
  const registrationLabel = partnerType === "misp" ? "Existing MISP ID" : "Existing POSP ID";
  const finalOutcomes = [trainingStatus === "completed", examStatus === "passed", agreementStatus === "signed", iibUploadStatus === "uploaded", iibRegistrationStatus === "registered"].filter(Boolean).length;

  useEffect(() => {
    const section = sectionRef.current;
    const form = section?.closest("form");
    if (!form) return;

    const interceptInvalidLegacySubmit = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button || !/save\s*&\s*check\s*pan/i.test(button.textContent ?? "")) return;

      const remarks = remarksRef.current;
      if (!remarks || remarks.value.trim().length >= 10) return;

      event.preventDefault();
      event.stopPropagation();
      if ("stopImmediatePropagation" in event) event.stopImmediatePropagation();
      setRemarksError("Enter at least 10 characters explaining how the previous record was verified.");
      requestAnimationFrame(() => {
        remarks.focus({ preventScroll: true });
        remarks.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    };

    form.addEventListener("click", interceptInvalidLegacySubmit, true);
    return () => form.removeEventListener("click", interceptInvalidLegacySubmit, true);
  }, []);

  return (
    <section ref={sectionRef} className="border-t border-amber-200 bg-amber-50/70 px-3 py-4 sm:px-5 sm:py-5" data-legacy-onboarding-fields="true">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[.08em] text-amber-700">Existing intermediary migration</p>
          <h3 className="mt-1 text-[12px] font-semibold text-[#0F172A]">Previously issued IDs and actual workflow position</h3>
          <p className="mt-1 max-w-4xl text-[9.5px] leading-4 text-[#64748B]">Enter the permanent Partner and POSP/MISP IDs, then record the real status of every historical stage. The linked account will use these exact selections; no training, exam, agreement or IIB stage will be completed automatically.</p>
        </div>
        <span className="w-fit rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[8.5px] font-semibold text-amber-800">Legacy mode</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Existing Partner ID" name="legacy_partner_code" defaultValue={initialValues.legacy_partner_code} placeholder="PART-2024-00127" required />
        <Field label={registrationLabel} name="legacy_registration_code" defaultValue={initialValues.legacy_registration_code} placeholder={partnerType === "misp" ? "MISP-2023-00018" : "POSP-2024-00481"} required />
        <Field label="Original onboarding date" name="legacy_original_onboarding_date" type="date" defaultValue={initialValues.legacy_original_onboarding_date} required />
        <Field label="Active / associated since" name="legacy_original_activation_date" type="date" defaultValue={initialValues.legacy_original_activation_date} required />
      </div>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-white p-3.5 sm:p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10.5px] font-semibold text-[#17203A]">Existing workflow status</p>
            <p className="mt-0.5 text-[9.5px] leading-4 text-[#64748B]">Dropdown values match the statuses accepted by the live database. Select what is true for this existing account today.</p>
          </div>
          <span className="w-fit rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[8.5px] font-semibold text-[#4338CA]">{finalOutcomes} of 5 final outcomes reached</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatusSelect label="Training" name="legacy_training_status" value={trainingStatus} options={LEGACY_TRAINING_OPTIONS} onChange={setTrainingStatus} help="Use Completed only when training is actually finished." />
          <StatusSelect label="Exam" name="legacy_exam_status" value={examStatus} options={LEGACY_EXAM_OPTIONS} onChange={setExamStatus} help="Passed is treated as the completed exam outcome." />
          <StatusSelect label="Agreement" name="legacy_agreement_status" value={agreementStatus} options={LEGACY_AGREEMENT_OPTIONS} onChange={setAgreementStatus} help="Signed is treated as the completed agreement outcome." />
          <StatusSelect label="IIB file upload" name="legacy_iib_upload_status" value={iibUploadStatus} options={LEGACY_IIB_UPLOAD_OPTIONS} onChange={setIibUploadStatus} help="Choose Uploaded when the IIB file has already been uploaded." />
          <StatusSelect label="IIB registration" name="legacy_iib_registration_status" value={iibRegistrationStatus} options={LEGACY_IIB_REGISTRATION_OPTIONS} onChange={setIibRegistrationStatus} help="Registered activates the account only when earlier stages are also complete." />
        </div>

        <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[9px] leading-4 text-blue-800">Partial historical records are supported. For example, IIB file upload can be marked Uploaded while Training, Exam or Agreement remains pending. The account journey will continue from the earliest unfinished stage.</p>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[10.5px] font-semibold text-[#344054]">Migration verification remarks *</span>
        <textarea
          ref={remarksRef}
          name="legacy_migration_remarks"
          required
          minLength={10}
          data-label="Migration verification remarks"
          defaultValue={initialValues.legacy_migration_remarks}
          onChange={(event) => {
            if (event.currentTarget.value.trim().length >= 10) setRemarksError(null);
          }}
          className={`min-h-24 w-full rounded-xl border bg-white px-3.5 py-2.5 text-[12px] text-[#17203A] outline-none focus:ring-2 ${remarksError ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-[#CBD5E1] focus:border-[#4F46E5] focus:ring-[#E0E7FF]"}`}
          placeholder="Example: Verified from the previous POSP register and agreement file."
        />
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className={`text-[9.5px] ${remarksError ? "font-semibold text-red-600" : "text-[#64748B]"}`}>{remarksError ?? "Minimum 10 characters required."}</span>
          <span className="text-[9px] text-[#94A3B8]">Do not enter only “OK”.</span>
        </div>
      </label>

      <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 text-[10px] leading-5 text-amber-950">
        <input type="checkbox" name="legacy_confirmation" value="yes" required className="mt-1 h-4 w-4 shrink-0" />
        <span>I confirm that the permanent IDs and the selected Training, Exam, Agreement and IIB statuses were verified against the previous records.</span>
      </label>
    </section>
  );
}

function Field({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label:string; name:string }) {
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-[10.5px] font-semibold text-[#344054]">{label}{props.required ? " *" : ""}</span>
      <input name={name} data-label={label} className="h-11 w-full min-w-0 rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-[12px] text-[#17203A] outline-none placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]" {...props} />
    </label>
  );
}

function StatusSelect({ label, name, value, options, onChange, help }: { label:string; name:string; value:string; options:readonly StatusOption[]; onChange:(value:string)=>void; help:string }) {
  return (
    <label className="min-w-0 rounded-xl border border-[#E2E8F0] bg-[#FAFBFD] p-3">
      <span className="mb-1.5 block text-[10px] font-semibold text-[#344054]">{label} *</span>
      <select name={name} value={value} required onChange={(event) => onChange(event.currentTarget.value)} className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-[10.5px] font-medium text-[#17203A] outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <span className="mt-1.5 block text-[8.5px] leading-3.5 text-[#64748B]">{help}</span>
    </label>
  );
}

function initialStatus(options:readonly StatusOption[], value:string|undefined, fallback:string) {
  return options.some((option) => option.value === value) ? value! : fallback;
}
