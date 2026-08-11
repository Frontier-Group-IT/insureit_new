"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  DEFAULT_LEGACY_WORKFLOW,
  LEGACY_AGREEMENT_OPTIONS,
  LEGACY_EXAM_OPTIONS,
  LEGACY_IIB_REGISTRATION_OPTIONS,
  LEGACY_IIB_UPLOAD_OPTIONS,
  LEGACY_TRAINING_OPTIONS,
} from "@/app/customers/posp-misp/legacy-workflow-statuses";
import { LEGACY_ONBOARDING_LABELS, legacyRegistrationLabel } from "@/app/customers/posp-misp/legacy-onboarding-labels";
import { updateExistingIntermediaryMigrationDetails, type MigrationSaveState } from "./existing-intermediary-migration-actions";

type Props = {
  applicationId: string;
  accountType: "posp" | "misp";
  values: Record<string, unknown>;
  editable: boolean;
};
type StatusOption = { readonly value: string; readonly label: string };

const inputClass = "h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition focus:border-[#635BFF] focus:ring-2 focus:ring-[#E7E5FF] disabled:bg-[#F8FAFC] disabled:text-[#475569]";
const labelClass = "mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#526178]";
const initialState: MigrationSaveState = { ok: true, message: "Migration fields save automatically." };

export function ExistingIntermediaryMigrationEditor({ applicationId, accountType, values, editable }: Props) {
  const registrationLabel = legacyRegistrationLabel(accountType);
  const [state, formAction, pending] = useActionState(updateExistingIntermediaryMigrationDetails, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    if (!editable || pending || !dirtyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      submitDirtyForm();
    }, 50);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [editable, pending, state.savedAt]);

  if (!isExistingMigrationRecord(values)) return null;

  function submitDirtyForm() {
    if (!dirtyRef.current || !formRef.current || pending) return;
    dirtyRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    formRef.current.requestSubmit();
  }

  function scheduleSave() {
    if (!editable) return;
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      submitDirtyForm();
    }, 700);
  }

  function flushOnFocusLeave(event: React.FocusEvent<HTMLFormElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    submitDirtyForm();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-[#E7ECF3] bg-[#FAFBFD] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[12.5px] font-semibold text-[#17203A]">Existing Intermediary Migration</h2>
          <p className="mt-1 text-[9.5px] font-medium text-[#64748B]">Maintain historical IDs, original dates and workflow completion imported from previous records.</p>
        </div>
        <p className={`text-[9px] font-semibold ${pending ? "text-indigo-600" : state.ok ? "text-emerald-700" : "text-red-700"}`} aria-live="polite">
          {pending ? "Saving migration changes…" : state.message}
        </p>
      </div>
      <form ref={formRef} action={formAction} onChange={scheduleSave} onBlur={flushOnFocusLeave} className="space-y-5 p-5">
        <input type="hidden" name="application_id" value={applicationId} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label={LEGACY_ONBOARDING_LABELS.partnerId} name="legacy_partner_code" defaultValue={value(values, "legacy_partner_code")} disabled={!editable} />
          <Field label={registrationLabel} name="legacy_registration_code" defaultValue={value(values, "legacy_registration_code")} disabled={!editable} />
          <DateField label={LEGACY_ONBOARDING_LABELS.originalOnboardingDate} name="legacy_original_onboarding_date" defaultValue={value(values, "legacy_original_onboarding_date")} disabled={!editable} />
          <DateField label={LEGACY_ONBOARDING_LABELS.originalActivationDate} name="legacy_original_activation_date" defaultValue={value(values, "legacy_original_activation_date")} disabled={!editable} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Select label={LEGACY_ONBOARDING_LABELS.trainingStatus} name="legacy_training_status" defaultValue={selectedValue(LEGACY_TRAINING_OPTIONS, value(values, "legacy_training_status"), DEFAULT_LEGACY_WORKFLOW.trainingStatus)} options={LEGACY_TRAINING_OPTIONS} disabled={!editable} />
          <Select label={LEGACY_ONBOARDING_LABELS.examStatus} name="legacy_exam_status" defaultValue={selectedValue(LEGACY_EXAM_OPTIONS, value(values, "legacy_exam_status"), DEFAULT_LEGACY_WORKFLOW.examStatus)} options={LEGACY_EXAM_OPTIONS} disabled={!editable} />
          <Select label={LEGACY_ONBOARDING_LABELS.agreementStatus} name="legacy_agreement_status" defaultValue={selectedValue(LEGACY_AGREEMENT_OPTIONS, value(values, "legacy_agreement_status"), DEFAULT_LEGACY_WORKFLOW.agreementStatus)} options={LEGACY_AGREEMENT_OPTIONS} disabled={!editable} />
          <Select label={LEGACY_ONBOARDING_LABELS.iibUploadStatus} name="legacy_iib_upload_status" defaultValue={selectedValue(LEGACY_IIB_UPLOAD_OPTIONS, value(values, "legacy_iib_upload_status"), DEFAULT_LEGACY_WORKFLOW.iibUploadStatus)} options={LEGACY_IIB_UPLOAD_OPTIONS} disabled={!editable} />
          <Select label={LEGACY_ONBOARDING_LABELS.iibRegistrationStatus} name="legacy_iib_registration_status" defaultValue={selectedValue(LEGACY_IIB_REGISTRATION_OPTIONS, value(values, "legacy_iib_registration_status"), DEFAULT_LEGACY_WORKFLOW.iibRegistrationStatus)} options={LEGACY_IIB_REGISTRATION_OPTIONS} disabled={!editable} />
        </div>

      </form>
    </section>
  );
}

function isExistingMigrationRecord(values: Record<string, unknown>) {
  const sourceKeys = ["draft_onboarding_mode", "onboarding_mode", "record_source", "source"];
  if (sourceKeys.some((key) => typeof values[key] === "string" && /(legacy|existing|excel|historical)/i.test(String(values[key])))) return true;
  if (values.existing_registration_confirmed === true || values.existing_registration_confirmed === "true") return true;

  const identityAndDateKeys = [
    "legacy_partner_code",
    "legacy_registration_code",
    "existing_registration_code",
    "legacy_original_onboarding_date",
    "legacy_original_activation_date",
    "legacy_verification_remarks",
    "legacy_migration_remarks",
  ];
  if (identityAndDateKeys.some((key) => hasMeaningfulValue(values[key]))) return true;

  const statusKeys = [
    "legacy_training_status",
    "legacy_exam_status",
    "legacy_agreement_status",
    "legacy_iib_upload_status",
    "legacy_iib_registration_status",
  ];
  return statusKeys.some((key) => hasMeaningfulValue(values[key]));
}

function hasMeaningfulValue(item: unknown) {
  return typeof item === "string" ? item.trim().length > 0 : item !== null && item !== undefined && item !== false;
}
function Field({ label, name, defaultValue, disabled }: { label: string; name: string; defaultValue: string; disabled: boolean }) {
  return <div><label className={labelClass} htmlFor={name}>{label}</label><input id={name} name={name} defaultValue={defaultValue} disabled={disabled} className={inputClass} /></div>;
}
function DateField({ label, name, defaultValue, disabled }: { label: string; name: string; defaultValue: string; disabled: boolean }) {
  return <div><label className={labelClass} htmlFor={name}>{label}</label><input id={name} name={name} type="date" defaultValue={defaultValue} disabled={disabled} className={inputClass} /></div>;
}
function Select({ label, name, defaultValue, options, disabled }: { label: string; name: string; defaultValue: string; options: readonly StatusOption[]; disabled: boolean }) {
  return <div><label className={labelClass} htmlFor={name}>{label}</label><select id={name} name={name} defaultValue={defaultValue} disabled={disabled} className={inputClass}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}
function selectedValue(options: readonly StatusOption[], current: string, fallback: string) {
  return options.some((option) => option.value === current) ? current : fallback;
}
function value(values: Record<string, unknown>, key: string) {
  const item = values[key];
  return typeof item === "string" ? item : "";
}
