"use client";

import { useState } from "react";
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
  const [trainingStatus, setTrainingStatus] = useState(() => initialStatus(LEGACY_TRAINING_OPTIONS, initialValues.legacy_training_status, DEFAULT_LEGACY_WORKFLOW.trainingStatus));
  const [examStatus, setExamStatus] = useState(() => initialStatus(LEGACY_EXAM_OPTIONS, initialValues.legacy_exam_status, DEFAULT_LEGACY_WORKFLOW.examStatus));
  const [agreementStatus, setAgreementStatus] = useState(() => initialStatus(LEGACY_AGREEMENT_OPTIONS, initialValues.legacy_agreement_status, DEFAULT_LEGACY_WORKFLOW.agreementStatus));
  const [iibUploadStatus, setIibUploadStatus] = useState(() => initialStatus(LEGACY_IIB_UPLOAD_OPTIONS, initialValues.legacy_iib_upload_status, DEFAULT_LEGACY_WORKFLOW.iibUploadStatus));
  const [iibRegistrationStatus, setIibRegistrationStatus] = useState(() => initialStatus(LEGACY_IIB_REGISTRATION_OPTIONS, initialValues.legacy_iib_registration_status, DEFAULT_LEGACY_WORKFLOW.iibRegistrationStatus));
  const registrationLabel = partnerType === "misp" ? "Existing MISP ID" : "Existing POSP ID";

  return (
    <section className="border-t border-amber-200 bg-amber-50/70 px-3 py-4 sm:px-5 sm:py-5" data-legacy-onboarding-fields="true">
      <div className="mb-4">
        <h3 className="text-[12px] font-semibold text-[#0F172A]">Existing account details</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Existing Partner ID" name="legacy_partner_code" defaultValue={initialValues.legacy_partner_code} placeholder="PART-2024-00127" required />
        <Field label={registrationLabel} name="legacy_registration_code" defaultValue={initialValues.legacy_registration_code} placeholder={partnerType === "misp" ? "MISP-2023-00018" : "POSP-2024-00481"} required />
        <Field label="Original onboarding date" name="legacy_original_onboarding_date" type="date" defaultValue={initialValues.legacy_original_onboarding_date} required />
        <Field label="Active / associated since" name="legacy_original_activation_date" type="date" defaultValue={initialValues.legacy_original_activation_date} required />
      </div>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-white p-3.5 sm:p-4">
        <p className="text-[10.5px] font-semibold text-[#17203A]">Workflow status</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatusSelect label="Training" name="legacy_training_status" value={trainingStatus} options={LEGACY_TRAINING_OPTIONS} onChange={setTrainingStatus} />
          <StatusSelect label="Exam" name="legacy_exam_status" value={examStatus} options={LEGACY_EXAM_OPTIONS} onChange={setExamStatus} />
          <StatusSelect label="Agreement" name="legacy_agreement_status" value={agreementStatus} options={LEGACY_AGREEMENT_OPTIONS} onChange={setAgreementStatus} />
          <StatusSelect label="IIB file upload" name="legacy_iib_upload_status" value={iibUploadStatus} options={LEGACY_IIB_UPLOAD_OPTIONS} onChange={setIibUploadStatus} />
          <StatusSelect label="IIB registration" name="legacy_iib_registration_status" value={iibRegistrationStatus} options={LEGACY_IIB_REGISTRATION_OPTIONS} onChange={setIibRegistrationStatus} />
        </div>
      </div>

      <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 text-[10px] leading-5 text-amber-950">
        <input type="checkbox" name="legacy_confirmation" value="yes" required className="mt-1 h-4 w-4 shrink-0" />
        <span>I confirm that the permanent IDs and selected workflow statuses were verified against previous records.</span>
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

function StatusSelect({ label, name, value, options, onChange }: { label:string; name:string; value:string; options:readonly StatusOption[]; onChange:(value:string)=>void }) {
  return (
    <label className="min-w-0 rounded-xl border border-[#E2E8F0] bg-[#FAFBFD] p-3">
      <span className="mb-1.5 block text-[10px] font-semibold text-[#344054]">{label} *</span>
      <select name={name} value={value} required onChange={(event) => onChange(event.currentTarget.value)} className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-[10.5px] font-medium text-[#17203A] outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function initialStatus(options:readonly StatusOption[], value:string|undefined, fallback:string) {
  return options.some((option) => option.value === value) ? value! : fallback;
}
