export const LEGACY_TRAINING_OPTIONS = [
  { value: "not_assigned", label: "Not assigned" },
  { value: "assigned", label: "Assigned" },
  { value: "opened", label: "Opened" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "expired", label: "Expired" },
] as const;

export const LEGACY_EXAM_OPTIONS = [
  { value: "not_allotted", label: "Not allotted" },
  { value: "allotted", label: "Allotted" },
  { value: "locked", label: "Locked" },
  { value: "available", label: "Available" },
  { value: "in_progress", label: "In progress" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "attempts_exhausted", label: "Attempts exhausted" },
] as const;

export const LEGACY_AGREEMENT_OPTIONS = [
  { value: "not_generated", label: "Not generated" },
  { value: "generated", label: "Generated" },
  { value: "sent", label: "Sent" },
  { value: "opened", label: "Opened" },
  { value: "signed", label: "Signed" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
  { value: "failed", label: "Failed" },
] as const;

export const LEGACY_IIB_UPLOAD_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "uploaded", label: "Uploaded" },
] as const;

export const LEGACY_IIB_REGISTRATION_OPTIONS = [
  { value: "not_ready", label: "Not ready" },
  { value: "ready_for_submission", label: "Ready for submission" },
  { value: "submission_in_progress", label: "Submission in progress" },
  { value: "submitted", label: "Submitted" },
  { value: "registered", label: "Registered" },
  { value: "failed", label: "Failed" },
  { value: "manual_review", label: "Manual review" },
] as const;

type OptionValue<T extends readonly { value: string }[]> = T[number]["value"];

export type LegacyTrainingStatus = OptionValue<typeof LEGACY_TRAINING_OPTIONS>;
export type LegacyExamStatus = OptionValue<typeof LEGACY_EXAM_OPTIONS>;
export type LegacyAgreementStatus = OptionValue<typeof LEGACY_AGREEMENT_OPTIONS>;
export type LegacyIibUploadStatus = OptionValue<typeof LEGACY_IIB_UPLOAD_OPTIONS>;
export type LegacyIibRegistrationStatus = OptionValue<typeof LEGACY_IIB_REGISTRATION_OPTIONS>;

export type LegacyWorkflowSelection = {
  trainingStatus: LegacyTrainingStatus;
  examStatus: LegacyExamStatus;
  agreementStatus: LegacyAgreementStatus;
  iibUploadStatus: LegacyIibUploadStatus;
  iibRegistrationStatus: LegacyIibRegistrationStatus;
};

export const DEFAULT_LEGACY_WORKFLOW: LegacyWorkflowSelection = {
  trainingStatus: "not_assigned",
  examStatus: "not_allotted",
  agreementStatus: "not_generated",
  iibUploadStatus: "pending",
  iibRegistrationStatus: "not_ready",
};

const TRAINING_VALUES = new Set(LEGACY_TRAINING_OPTIONS.map((option) => option.value));
const EXAM_VALUES = new Set(LEGACY_EXAM_OPTIONS.map((option) => option.value));
const AGREEMENT_VALUES = new Set(LEGACY_AGREEMENT_OPTIONS.map((option) => option.value));
const IIB_UPLOAD_VALUES = new Set(LEGACY_IIB_UPLOAD_OPTIONS.map((option) => option.value));
const IIB_REGISTRATION_VALUES = new Set(LEGACY_IIB_REGISTRATION_OPTIONS.map((option) => option.value));

export function isLegacyTrainingStatus(value: unknown): value is LegacyTrainingStatus {
  return typeof value === "string" && TRAINING_VALUES.has(value as LegacyTrainingStatus);
}

export function isLegacyExamStatus(value: unknown): value is LegacyExamStatus {
  return typeof value === "string" && EXAM_VALUES.has(value as LegacyExamStatus);
}

export function isLegacyAgreementStatus(value: unknown): value is LegacyAgreementStatus {
  return typeof value === "string" && AGREEMENT_VALUES.has(value as LegacyAgreementStatus);
}

export function isLegacyIibUploadStatus(value: unknown): value is LegacyIibUploadStatus {
  return typeof value === "string" && IIB_UPLOAD_VALUES.has(value as LegacyIibUploadStatus);
}

export function isLegacyIibRegistrationStatus(value: unknown): value is LegacyIibRegistrationStatus {
  return typeof value === "string" && IIB_REGISTRATION_VALUES.has(value as LegacyIibRegistrationStatus);
}

export function readLegacyWorkflow(...sources: Array<Record<string, unknown>>): LegacyWorkflowSelection {
  const value = (key: string) => {
    for (const source of sources) {
      const candidate = source[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
  };

  const training = value("legacy_training_status");
  const exam = value("legacy_exam_status");
  const agreement = value("legacy_agreement_status");
  const iibUpload = value("legacy_iib_upload_status");
  const iibRegistration = value("legacy_iib_registration_status");

  return {
    trainingStatus: isLegacyTrainingStatus(training) ? training : DEFAULT_LEGACY_WORKFLOW.trainingStatus,
    examStatus: isLegacyExamStatus(exam) ? exam : DEFAULT_LEGACY_WORKFLOW.examStatus,
    agreementStatus: isLegacyAgreementStatus(agreement) ? agreement : DEFAULT_LEGACY_WORKFLOW.agreementStatus,
    iibUploadStatus: isLegacyIibUploadStatus(iibUpload) ? iibUpload : DEFAULT_LEGACY_WORKFLOW.iibUploadStatus,
    iibRegistrationStatus: isLegacyIibRegistrationStatus(iibRegistration) ? iibRegistration : DEFAULT_LEGACY_WORKFLOW.iibRegistrationStatus,
  };
}

export function registrationStatusForLegacyWorkflow(workflow: LegacyWorkflowSelection) {
  if (workflow.trainingStatus !== "completed") {
    if (workflow.trainingStatus === "in_progress" || workflow.trainingStatus === "opened") return "training_in_progress";
    if (workflow.trainingStatus === "assigned" || workflow.trainingStatus === "expired") return "training_assigned";
    return "training_pending";
  }

  if (workflow.examStatus !== "passed") {
    if (workflow.examStatus === "in_progress") return "exam_in_progress";
    if (workflow.examStatus === "failed" || workflow.examStatus === "attempts_exhausted") return "exam_failed";
    if (["allotted", "locked", "available"].includes(workflow.examStatus)) return "exam_allotted";
    return "exam_pending";
  }

  if (workflow.agreementStatus !== "signed") {
    if (workflow.agreementStatus === "sent" || workflow.agreementStatus === "opened") return "agreement_sent";
    return "agreement_pending";
  }

  if (workflow.iibUploadStatus !== "uploaded") return "iib_submission_pending";
  if (workflow.iibRegistrationStatus === "registered") return "iib_registered";
  if (workflow.iibRegistrationStatus === "submitted") return "iib_submitted";
  return "iib_submission_pending";
}

export function currentStepForRegistrationStatus(status: string) {
  if (status.startsWith("training_") || status.startsWith("exam_")) return 3;
  if (status.startsWith("agreement_")) return 4;
  return 5;
}

export function isLegacyWorkflowActive(workflow: LegacyWorkflowSelection) {
  return registrationStatusForLegacyWorkflow(workflow) === "iib_registered";
}
