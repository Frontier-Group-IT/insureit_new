export const LEGACY_ONBOARDING_LABELS = {
  sectionTitle: "Existing account details",
  partnerId: "Existing Partner ID",
  originalOnboardingDate: "Original onboarding date",
  originalActivationDate: "Active / associated since",
  workflowTitle: "Workflow status",
  trainingStatus: "Training",
  examStatus: "Exam",
  agreementStatus: "Agreement",
  iibUploadStatus: "IIB file upload",
  iibRegistrationStatus: "IIB registration",
} as const;

export function legacyRegistrationLabel(partnerType: "posp" | "misp") {
  return partnerType === "misp" ? "Existing MISP ID" : "Existing POSP ID";
}
