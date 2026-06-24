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
  "Surveyor Appointed",
  "Vehicle Inspected",
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
  "Repair Done",
  "RA Intimation",
  "RA Intimation Done",
  "DO Status",
  "Payment Stage",
  "Claim Completion In Progress",
  "Claim Complete",
  "Estimate Submitted",
  "Approval Pending",
  "Repair Started",
  "Repair Completed",
  "DO Submitted",
  "Final Bill Submitted",
  "Settlement Under Process",
  "Settled",
  "Rejected",
  "Closed"
] as const;

export type ClaimStatus = (typeof claimStatuses)[number];

export type RequiredDocument = {
  type: string;
  title: string;
  body: string;
  icon: string;
};

export const initialClaimDocuments: RequiredDocument[] = [
  { type: "Spot Photo", title: "Spot Photo", body: "Damage, vehicle position and number plate", icon: "camera-burst" },
  { type: "Registration certificate", title: "Registration certificate", body: "RC copy", icon: "card-account-details-outline" },
  { type: "Driving licence", title: "Driving licence", body: "Front and back", icon: "badge-account-horizontal-outline" },
  { type: "Policy copy", title: "Policy copy", body: "Policy PDF or photo", icon: "shield-file-outline" },
  { type: "GR Copy / Road Challan", title: "GR Copy / Road Challan", body: "Goods receipt or road challan", icon: "file-document-multiple-outline" }
];

export const finalClaimDocuments: RequiredDocument[] = [
  { type: "Repair estimate", title: "Repair estimate", body: "Workshop repair estimate", icon: "receipt-text-outline" },
  { type: "Claim form", title: "Claim form", body: "Duly filled and signed claim form", icon: "file-sign" },
  { type: "Driver KYC", title: "Driver KYC", body: "Driver Aadhaar card or KYC document", icon: "card-account-details-outline" },
  { type: "Tax paid receipt", title: "Tax paid receipt", body: "Valid tax paid receipt", icon: "receipt-text-outline" },
  { type: "Permit copy A", title: "Permit copy A", body: "Permit copy A", icon: "file-certificate-outline" },
  { type: "Permit copy B", title: "Permit copy B", body: "Permit copy B", icon: "file-certificate-outline" },
  { type: "Permit authorization letter", title: "Permit authorization letter", body: "Permit authorization letter", icon: "file-document-outline" },
  { type: "Vehicle fitness certificate", title: "Vehicle fitness certificate", body: "Valid vehicle fitness certificate", icon: "file-certificate-outline" },
  { type: "Pollution certificate", title: "Pollution certificate", body: "Pollution certificate", icon: "file-certificate-outline" },
  { type: "Insured CKYC documents", title: "Insured CKYC documents", body: "CKYC form and insured/firm KYC documents", icon: "card-account-details-outline" },
  { type: "FIR / Police report", title: "FIR / Police report", body: "FIR, police intimation, or GD report if any", icon: "file-document-outline" },
  { type: "Affidavit if no FIR", title: "Affidavit if no FIR", body: "Affidavit on stamp paper when FIR is not lodged", icon: "file-sign" },
  { type: "MLC report", title: "MLC report", body: "Required for injury or death cases", icon: "file-document-outline" },
  { type: "Driver fitness report", title: "Driver fitness report", body: "Required when MLC report is not available", icon: "file-document-outline" },
  { type: "Fastag summary report", title: "Fastag summary report", body: "Fastag summary report", icon: "file-document-outline" },
  { type: "ETP clarification", title: "ETP clarification", body: "Electronic transit pass clarification if expired at accident time", icon: "file-document-outline" },
  { type: "Final tax invoice", title: "Final tax invoice", body: "Final tax invoice copy with seal and signature", icon: "receipt-text-outline" },
  { type: "Workshop KYC documents", title: "Workshop KYC documents", body: "Workshop PAN, GST, and cancelled cheque copy", icon: "card-account-details-outline" },
  { type: "Towing NOC and bill", title: "Towing NOC and bill", body: "Customer NOC, towing bill, and towing photos if applicable", icon: "file-document-multiple-outline" },
  { type: "Discharge / Satisfaction voucher", title: "Discharge / Satisfaction voucher", body: "Discharge voucher or satisfaction voucher", icon: "file-certificate-outline" },
  { type: "Previous year policy for NCB", title: "Previous year policy for NCB", body: "Previous policy document for NCB confirmation", icon: "shield-file-outline" },
  { type: "New vehicle purchase invoice", title: "New vehicle purchase invoice", body: "Purchase tax invoice with delivery gate pass", icon: "receipt-text-outline" },
  { type: "Highway report", title: "Highway report", body: "NHAI highway report for major accidents", icon: "file-document-outline" },
  { type: "GPS tracking details", title: "GPS tracking details", body: "Vehicle GPS tracking details", icon: "crosshairs-gps" },
  { type: "Insurer additional documents", title: "Insurer additional documents", body: "Any additional documents requested by insurer", icon: "file-document-multiple-outline" }
];

export const initialDocumentTypes = initialClaimDocuments.map((document) => document.type);
export const finalDocumentTypes = finalClaimDocuments.map((document) => document.type);

export const customerActionAwaitedStatuses: ClaimStatus[] = ["Initial Documents Pending", "Documents Pending", "Final Documents Awaited"];
export const documentVerificationStatuses: ClaimStatus[] = [
  "Initial Documents Verification Pending",
  "Initial Documents Submitted",
  "Documents Submitted",
  "Final Documents Verification Pending",
  "Final Documents Submitted"
];
export const terminalClaimStatuses: ClaimStatus[] = ["Settled", "Rejected", "Closed"];

export const claimQueueDefinitions = [
  {
    key: "new",
    label: "New claims",
    shortLabel: "New",
    statuses: ["Draft", "Accident Reported"] as ClaimStatus[],
    icon: "alert-plus-outline",
    tone: "info"
  },
  {
    key: "documents",
    label: "Initial documents",
    shortLabel: "Docs",
    statuses: ["Initial Documents Pending", "Initial Documents Verification Pending", "Initial Documents Submitted", "Initial Documents Verified", "Documents Pending", "Documents Submitted"] as ClaimStatus[],
    icon: "file-alert-outline",
    tone: "danger"
  },
  {
    key: "survey",
    label: "Survey pending",
    shortLabel: "Survey",
    statuses: ["Claim Intimated", "Surveyor Appointed", "Vehicle Inspected"] as ClaimStatus[],
    icon: "clipboard-search-outline",
    tone: "info"
  },
  {
    key: "approval",
    label: "Approval pending",
    shortLabel: "Approval",
    statuses: ["Final Documents Awaited", "Final Documents Verification Pending", "Final Documents Submitted", "Final Documents Verified", "Claim Intimation", "Final Surveyor Details", "Work Approval Received"] as ClaimStatus[],
    icon: "shield-alert-outline",
    tone: "warning"
  },
  {
    key: "repair",
    label: "Repair and final bill",
    shortLabel: "Repair",
    statuses: ["Under Repair", "Repair Done", "RA Intimation", "RA Intimation Done", "DO Status"] as ClaimStatus[],
    icon: "car-wrench",
    tone: "info"
  },
  {
    key: "payment",
    label: "Settlement and payment",
    shortLabel: "Payment",
    statuses: ["Payment Stage", "Claim Completion In Progress", "Claim Complete"] as ClaimStatus[],
    icon: "bank-transfer",
    tone: "warning"
  },
  {
    key: "closed",
    label: "Completed",
    shortLabel: "Closed",
    statuses: ["Settled", "Closed"] as ClaimStatus[],
    icon: "check-decagram-outline",
    tone: "success"
  }
] as const;

export const operationsQueueDefinitions = [
  { key: "vehicle-intimation", label: "Vehicle Claims Intimated", icon: "car-emergency", tone: "info", amount: "none", statuses: ["Draft", "Accident Reported", "Initial Documents Pending", "Initial Documents Verification Pending", "Initial Documents Submitted", "Documents Pending", "Documents Submitted"] as ClaimStatus[] },
  { key: "spot-deputation", label: "Spot Deputation Pending", icon: "map-marker-account-outline", tone: "warning", amount: "none", statuses: ["Initial Documents Verified", "Claim Intimated", "Surveyor Appointed", "Vehicle Inspected"] as ClaimStatus[] },
  { key: "claim-intimation", label: "Claim Intimation Pending", icon: "file-send-outline", tone: "info", amount: "estimated", statuses: ["Final Documents Awaited", "Final Documents Verification Pending", "Final Documents Submitted", "Final Documents Verified", "Claim Intimation"] as ClaimStatus[] },
  { key: "work-approval", label: "Work Approval Pending", icon: "clipboard-check-outline", tone: "success", amount: "approved", statuses: ["Estimate Submitted", "Approval Pending", "Work Approval Status", "Work Approval Received"] as ClaimStatus[] },
  { key: "reinspection", label: "Re-Inspection Pending", icon: "clipboard-search-outline", tone: "info", amount: "none", statuses: ["Final Surveyor Details", "Survey Status", "Survey Done"] as ClaimStatus[] },
  { key: "delivery-order", label: "Delivery Order Pending", icon: "file-document-edit-outline", tone: "warning", amount: "approved", statuses: ["Under Repair", "Repair Started", "Repair Done", "Repair Completed", "RA Intimation", "RA Intimation Done", "DO Status", "DO Submitted", "Final Bill Submitted"] as ClaimStatus[] },
  { key: "payment", label: "Payment Pending", icon: "cash-multiple", tone: "danger", amount: "settlement", statuses: ["Payment Stage", "Claim Completion In Progress", "Claim Complete", "Settlement Under Process"] as ClaimStatus[] },
  { key: "closed-claims", label: "Closed Claims", icon: "check-circle-outline", tone: "success", amount: "none", statuses: ["Closed"] as ClaimStatus[] }
] as const;

export type OperationsQueueKey = (typeof operationsQueueDefinitions)[number]["key"];

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
  "Repair Done",
  "RA Intimation",
  "RA Intimation Done",
  "DO Status",
  "Payment Stage",
  "Claim Completion In Progress",
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

export function operationsQueueForKey(key?: string) {
  return operationsQueueDefinitions.find((queue) => queue.key === key);
}

export function operationsQueueForStatus(status: string) {
  return operationsQueueDefinitions.find((queue) => queue.statuses.includes(status as ClaimStatus));
}

export function queueForStatus(status: ClaimStatus) {
  return claimQueueDefinitions.find((queue) => queue.statuses.includes(status)) ?? claimQueueDefinitions[0];
}

export function requiredDocumentsForStatus(status?: string | null, requestedFinalDocumentTypes: string[] = []) {
  if (!status || !finalDocumentPhaseStatuses.includes(status as ClaimStatus)) return initialClaimDocuments;
  if (!requestedFinalDocumentTypes.length) return finalClaimDocuments;
  const requested = new Set(requestedFinalDocumentTypes);
  return finalClaimDocuments.filter((document) => requested.has(document.type));
}

export function requiredDocumentTypesForStatus(status: string, requestedFinalDocumentTypes: string[] = []) {
  return requiredDocumentsForStatus(status, requestedFinalDocumentTypes).map((document) => document.type);
}

export function replacementStatusFor(status: string): ClaimStatus {
  return finalDocumentPhaseStatuses.includes(status as ClaimStatus) ? "Final Documents Awaited" : "Initial Documents Pending";
}

export function submittedStatusFor(status: string): ClaimStatus | null {
  if (["Initial Documents Pending", "Documents Pending", "Accident Reported"].includes(status)) return "Initial Documents Verification Pending";
  if (status === "Final Documents Awaited") return "Final Documents Verification Pending";
  return null;
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
  "Vehicle Inspected": "Final Documents Awaited",
  "Final Documents Verified": "Claim Intimation",
  "Claim Intimation": "Final Surveyor Details",
  "Final Surveyor Details": "Survey Status",
  "Survey Status": "Survey Done",
  "Survey Done": "Work Approval Status",
  "Work Approval Status": "Work Approval Received",
  "Work Approval Received": "Under Repair",
  "Under Repair": "Repair Done",
  "Repair Done": "RA Intimation",
  "RA Intimation": "RA Intimation Done",
  "RA Intimation Done": "DO Status",
  "DO Status": "Payment Stage",
  "Payment Stage": "Claim Completion In Progress",
  "Claim Completion In Progress": "Claim Complete",
  "Claim Complete": "Closed",
  "Estimate Submitted": "Approval Pending",
  "Approval Pending": "Repair Started",
  "Repair Started": "Repair Completed",
  "Repair Completed": "DO Submitted",
  "DO Submitted": "Final Bill Submitted",
  "Final Bill Submitted": "Settlement Under Process",
  "Settlement Under Process": "Settled",
  "Settled": "Closed"
};

export function actionForStatus(status: string) {
  if (isCustomerActionAwaited(status)) return { title: "Waiting for customer", body: "Customer document upload or correction is pending.", button: null };
  if (isDocumentVerificationPending(status)) return { title: "Verify documents", body: "Review every pending document. The claim will advance automatically after all required documents are verified.", button: null };
  const nextStatus = managerTransitions[status as ClaimStatus];
  if (!nextStatus) return null;
  if (status === "Vehicle Inspected") return { title: "Request final documents", body: "Ask the customer for final claim documents.", button: "Request final documents" };
  return { title: nextStatus, body: `Move this claim from ${status} to ${nextStatus}.`, button: nextStatus };
}

export function customerStageCopy(status: ClaimStatus) {
  if (status === "Accident Reported") return "Your accident report has been received. Upload clear documents so the claim desk can begin verification.";
  if (status === "Initial Documents Pending" || status === "Documents Pending") return "The claim desk needs corrected or missing initial documents from you.";
  if (status === "Initial Documents Verification Pending" || status === "Initial Documents Submitted" || status === "Documents Submitted") return "Your initial documents are waiting for claim desk verification.";
  if (status === "Initial Documents Verified") return "Initial documents are verified. The claim team will appoint the surveyor next.";
  if (status === "Claim Intimated") return "The insurer has been informed and the claim reference process has started.";
  if (status === "Surveyor Appointed") return "A surveyor has been assigned. Keep the vehicle and repair estimate ready.";
  if (status === "Vehicle Inspected") return "Inspection is complete. The repair estimate and approval steps are next.";
  if (status === "Final Documents Awaited") return "The claim desk needs the final claim documents from you.";
  if (status === "Final Documents Verification Pending" || status === "Final Documents Submitted") return "Your final documents are waiting for claim desk verification.";
  if (status === "Final Documents Verified") return "Final documents are verified. The claim desk will draft the insurer intimation next.";
  if (status === "Claim Intimation") return "The insurer intimation draft is ready with the final document links for manager review.";
  if (status === "Final Surveyor Details") return "Final surveyor details have been recorded by the claim desk.";
  if (status === "Survey Status") return "The final survey is being tracked by the claim desk.";
  if (status === "Survey Done") return "The final survey is complete. Work approval is the next checkpoint.";
  if (status === "Work Approval Status") return "Work approval is being followed up with the insurer.";
  if (status === "Work Approval Received") return "Work approval is complete. Repair will begin next.";
  if (status === "Repair Done") return "Repair work is complete. RA intimation is the next step.";
  if (status === "Under Repair") return "The vehicle is under repair. RA intimation will follow after invoice details.";
  if (status === "RA Intimation") return "RA intimation is being prepared with invoice and repair amount details.";
  if (status === "RA Intimation Done") return "RA intimation is complete. Delivery order details are next.";
  if (status === "DO Status") return "Delivery order amount and assessment report are being recorded.";
  if (status === "Payment Stage") return "Payment advice and bill difference details are being tracked.";
  if (status === "Claim Completion In Progress") return "Payment is complete. The claim desk is recording closure details.";
  if (status === "Claim Complete") return "Final receipt details are recorded. The claim desk will close the file.";
  if (status === "Estimate Submitted" || status === "Approval Pending") return "Repair approval is under review. The team will update you once approval is received.";
  if (status === "Repair Started" || status === "Repair Completed") return "Repair work is being tracked. Final billing will follow.";
  if (status === "DO Submitted") return "Delivery order details are submitted. Settlement processing is next.";
  if (status === "Final Bill Submitted") return "Final bills are with the claim team for settlement processing.";
  if (status === "Settlement Under Process") return "Settlement is being processed. Payment advice will appear once available.";
  if (status === "Settled" || status === "Closed") return "The claim journey is complete and available for reference.";
  if (status === "Rejected") return "The claim needs support attention. Contact the claims desk for the reason and next options.";
  return "The claim is being prepared.";
}

export function stageAgeLabel(updatedAt?: string | null) {
  if (!updatedAt) return "New";
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const days = Math.max(0, Math.floor(ageMs / 86_400_000));
  if (days === 0) return "Updated today";
  if (days === 1) return "1 day in stage";
  return `${days} days in stage`;
}
