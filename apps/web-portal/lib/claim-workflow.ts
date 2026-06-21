export const claimStatuses = [
  "Draft",
  "Accident Reported",
  "Initial Documents Pending",
  "Initial Documents Verification Pending",
  "Initial Documents Submitted",
  "Initial Documents Verified",
  "Documents Pending",
  "Documents Submitted",
  "Claim Intimated",
  "Claim Intimation",
  "Surveyor Appointed",
  "Vehicle Inspected",
  "Final Documents Awaited",
  "Final Documents Verification Pending",
  "Final Documents Submitted",
  "Final Documents Verified",
  "Final Surveyor Details",
  "Survey Status",
  "Survey Done",
  "Work Approval Status",
  "Work Approval Received",
  "Estimate Submitted",
  "Approval Pending",
  "Under Repair",
  "Repair Started",
  "Repair Completed",
  "RA Intimation",
  "RA Intimation Done",
  "DO Status",
  "DO Submitted",
  "Final Bill Submitted",
  "Payment Stage",
  "Settlement Under Process",
  "Claim Complete",
  "Settled",
  "Rejected",
  "Closed"
] as const;

export type ClaimStatus = (typeof claimStatuses)[number];

export const initialDocumentTypes = ["Accident photos", "Registration certificate", "Driving licence", "Policy copy"] as const;
export const finalDocumentTypes = ["Final repair bill", "Satisfaction voucher", "Discharge voucher", "Payment receipt"] as const;

export const customerActionAwaitedStatuses: ClaimStatus[] = ["Initial Documents Pending", "Documents Pending", "Final Documents Awaited"];
export const documentVerificationStatuses: ClaimStatus[] = [
  "Initial Documents Verification Pending",
  "Initial Documents Submitted",
  "Documents Submitted",
  "Final Documents Verification Pending",
  "Final Documents Submitted"
];
export const terminalClaimStatuses: ClaimStatus[] = ["Settled", "Rejected", "Closed"];

const finalDocumentPhaseStatuses: ClaimStatus[] = [
  "Final Documents Awaited",
  "Final Documents Verification Pending",
  "Final Documents Submitted",
  "Final Documents Verified",
  "Claim Intimation",
  "Final Surveyor Details",
  "Survey Status",
  "Survey Done",
  "Work Approval Status",
  "Work Approval Received",
  "Under Repair",
  "RA Intimation",
  "RA Intimation Done",
  "DO Status",
  "Payment Stage",
  "Claim Complete",
  "DO Submitted",
  "Final Bill Submitted",
  "Settlement Under Process",
  "Settled",
  "Closed"
];

export function isClaimStatus(value: string | null | undefined): value is ClaimStatus {
  return Boolean(value && claimStatuses.includes(value as ClaimStatus));
}

export function isOpenClaimStatus(status: string) {
  return !terminalClaimStatuses.includes(status as ClaimStatus);
}

export function isCustomerActionAwaited(status: string) {
  return customerActionAwaitedStatuses.includes(status as ClaimStatus);
}

export function isDocumentVerificationPending(status: string) {
  return documentVerificationStatuses.includes(status as ClaimStatus);
}

export function isManagerActionRequired(status: string) {
  return isOpenClaimStatus(status) && !isCustomerActionAwaited(status);
}

export function requiredDocumentTypesForStatus(status: string) {
  return finalDocumentPhaseStatuses.includes(status as ClaimStatus) ? [...finalDocumentTypes] : [...initialDocumentTypes];
}

export function replacementStatusFor(status: string): ClaimStatus {
  return finalDocumentPhaseStatuses.includes(status as ClaimStatus) ? "Final Documents Awaited" : "Initial Documents Pending";
}

export function verifiedStatusFor(status: string): ClaimStatus | null {
  if (["Initial Documents Pending", "Initial Documents Verification Pending", "Initial Documents Submitted", "Documents Pending", "Documents Submitted", "Accident Reported"].includes(status)) {
    return "Initial Documents Verified";
  }
  if (["Final Documents Awaited", "Final Documents Verification Pending", "Final Documents Submitted"].includes(status)) {
    return "Final Documents Verified";
  }
  return null;
}

export const managerTransitions: Partial<Record<ClaimStatus, ClaimStatus>> = {
  "Initial Documents Verified": "Surveyor Appointed",
  "Surveyor Appointed": "Vehicle Inspected",
  "Final Documents Verified": "Claim Intimation",
  "Claim Intimation": "Final Surveyor Details",
  "Final Surveyor Details": "Survey Status",
  "Survey Status": "Survey Done",
  "Survey Done": "Work Approval Status",
  "Work Approval Status": "Work Approval Received",
  "Work Approval Received": "Under Repair",
  "Under Repair": "RA Intimation",
  "RA Intimation": "RA Intimation Done",
  "RA Intimation Done": "DO Status",
  "DO Status": "Payment Stage",
  "Payment Stage": "Claim Complete",
  "Claim Complete": "Closed",
  "Approval Pending": "Repair Started",
  "Repair Started": "Repair Completed",
  "Repair Completed": "DO Submitted",
  "DO Submitted": "Settlement Under Process",
  "Settlement Under Process": "Settled",
  "Settled": "Closed"
};

export function actionForStatus(status: string) {
  if (isCustomerActionAwaited(status)) return { title: "Waiting for customer", body: "Customer document upload or correction is pending.", button: null };
  if (isDocumentVerificationPending(status)) return { title: "Verify documents", body: "Review every pending document. The claim will advance automatically after all required documents are verified.", button: null };
  if (status === "Vehicle Inspected") return { title: "Request final documents", body: "Ask the customer for final claim documents.", button: "Request final documents" };
  const nextStatus = managerTransitions[status as ClaimStatus];
  if (!nextStatus) return null;
  return { title: nextStatus, body: `Move this claim from ${status} to ${nextStatus}.`, button: nextStatus };
}

export function stageAgeLabel(updatedAt?: string | null) {
  if (!updatedAt) return "New";
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const days = Math.max(0, Math.floor(ageMs / 86_400_000));
  if (days === 0) return "Updated today";
  if (days === 1) return "1 day in stage";
  return `${days} days in stage`;
}
