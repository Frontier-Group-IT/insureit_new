import {
  DEFAULT_LEGACY_WORKFLOW,
  LEGACY_AGREEMENT_OPTIONS,
  LEGACY_EXAM_OPTIONS,
  LEGACY_IIB_REGISTRATION_OPTIONS,
  LEGACY_IIB_UPLOAD_OPTIONS,
  LEGACY_TRAINING_OPTIONS,
} from "@/app/customers/posp-misp/legacy-workflow-statuses";
import { LEGACY_ONBOARDING_LABELS, legacyRegistrationLabel } from "@/app/customers/posp-misp/legacy-onboarding-labels";

type Props = {
  applicationId: string;
  accountType: "posp" | "misp";
  values: Record<string, unknown>;
  editable: boolean;
};
type StatusOption = { readonly value: string; readonly label: string };

const inputClass = "h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition focus:border-[#635BFF] focus:ring-2 focus:ring-[#E7E5FF] disabled:bg-[#F8FAFC] disabled:text-[#475569]";
const labelClass = "mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#526178]";

export function ExistingIntermediaryMigrationEditor({ applicationId, accountType, values, editable }: Props) {
  if (!isExistingMigrationRecord(values)) return null;

  const registrationLabel = legacyRegistrationLabel(accountType);
  const formId = `posp-misp-editor-${applicationId}`;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-[#E7ECF3] bg-[#FAFBFD] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[12.5px] font-semibold text-[#17203A]">Existing Intermediary Migration</h2>
          <p className="mt-1 text-[9.5px] font-medium text-[#64748B]">Maintain historical IDs, original dates and workflow completion imported from previous records.</p>
        </div>
        {editable ? <p className="text-[9px] font-semibold text-[#64748B]">Changes save with Save & Exit or Upload Documents.</p> : null}
      </div>
      <div className="space-y-5 p-5">
        <input type="hidden" name="existing_migration_present" value="true" form={formId} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field formId={formId} label={LEGACY_ONBOARDING_LABELS.partnerId} name="legacy_partner_code" defaultValue={value(values, "legacy_partner_code")} disabled={!editable} />
          <Field formId={formId} label={registrationLabel} name="legacy_registration_code" defaultValue={value(values, "legacy_registration_code")} disabled={!editable} />
          <DateField formId={formId} label={LEGACY_ONBOARDING_LABELS.originalOnboardingDate} name="legacy_original_onboarding_date" defaultValue={value(values, "legacy_original_onboarding_date")} disabled={!editable} />
          <DateField formId={formId} label={LEGACY_ONBOARDING_LABELS.originalActivationDate} name="legacy_original_activation_date" defaultValue={value(values, "legacy_original_activation_date")} disabled={!editable} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Select formId={formId} label={LEGACY_ONBOARDING_LABELS.trainingStatus} name="legacy_training_status" defaultValue={selectedValue(LEGACY_TRAINING_OPTIONS, value(values, "legacy_training_status"), DEFAULT_LEGACY_WORKFLOW.trainingStatus)} options={LEGACY_TRAINING_OPTIONS} disabled={!editable} />
          <Select formId={formId} label={LEGACY_ONBOARDING_LABELS.examStatus} name="legacy_exam_status" defaultValue={selectedValue(LEGACY_EXAM_OPTIONS, value(values, "legacy_exam_status"), DEFAULT_LEGACY_WORKFLOW.examStatus)} options={LEGACY_EXAM_OPTIONS} disabled={!editable} />
          <Select formId={formId} label={LEGACY_ONBOARDING_LABELS.agreementStatus} name="legacy_agreement_status" defaultValue={selectedValue(LEGACY_AGREEMENT_OPTIONS, value(values, "legacy_agreement_status"), DEFAULT_LEGACY_WORKFLOW.agreementStatus)} options={LEGACY_AGREEMENT_OPTIONS} disabled={!editable} />
          <Select formId={formId} label={LEGACY_ONBOARDING_LABELS.iibUploadStatus} name="legacy_iib_upload_status" defaultValue={selectedValue(LEGACY_IIB_UPLOAD_OPTIONS, value(values, "legacy_iib_upload_status"), DEFAULT_LEGACY_WORKFLOW.iibUploadStatus)} options={LEGACY_IIB_UPLOAD_OPTIONS} disabled={!editable} />
          <Select formId={formId} label={LEGACY_ONBOARDING_LABELS.iibRegistrationStatus} name="legacy_iib_registration_status" defaultValue={selectedValue(LEGACY_IIB_REGISTRATION_OPTIONS, value(values, "legacy_iib_registration_status"), DEFAULT_LEGACY_WORKFLOW.iibRegistrationStatus)} options={LEGACY_IIB_REGISTRATION_OPTIONS} disabled={!editable} />
        </div>
      </div>
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
function Field({ formId, label, name, defaultValue, disabled }: { formId: string; label: string; name: string; defaultValue: string; disabled: boolean }) {
  return <div><label className={labelClass} htmlFor={name}>{label}</label><input id={name} name={name} form={formId} defaultValue={defaultValue} disabled={disabled} className={inputClass} /></div>;
}
function DateField({ formId, label, name, defaultValue, disabled }: { formId: string; label: string; name: string; defaultValue: string; disabled: boolean }) {
  return <div><label className={labelClass} htmlFor={name}>{label}</label><input id={name} name={name} form={formId} type="date" defaultValue={defaultValue} disabled={disabled} className={inputClass} /></div>;
}
function Select({ formId, label, name, defaultValue, options, disabled }: { formId: string; label: string; name: string; defaultValue: string; options: readonly StatusOption[]; disabled: boolean }) {
  return <div><label className={labelClass} htmlFor={name}>{label}</label><select id={name} name={name} form={formId} defaultValue={defaultValue} disabled={disabled} className={inputClass}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}
function selectedValue(options: readonly StatusOption[], current: string, fallback: string) {
  return options.some((option) => option.value === current) ? current : fallback;
}
function value(values: Record<string, unknown>, key: string) {
  const item = values[key];
  return typeof item === "string" ? item : "";
}
