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
  "Spot Survey Completed",
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
export const documentVerificationStatuses: ClaimStatus[] = ["Initial Documents Verification Pending", "Initial Documents Submitted", "Documents Submitted", "Final Documents Verification Pending", "Final Documents Submitted"];
export const terminalClaimStatuses: ClaimStatus[] = ["Settled", "Rejected", "Closed"];

export const claimQueueDefinitions = [
  { key: "new", label: "New claims", shortLabel: "New", statuses: ["Draft", "Accident Reported"] as ClaimStatus[], icon: "alert-plus-outline", tone: "info" },
  { key: "documents", label: "Initial documents", shortLabel: "Docs", statuses: ["Initial Documents Pending", "Initial Documents Verification Pending", "Initial Documents Submitted", "Initial Documents Verified", "Documents Pending", "Documents Submitted"] as ClaimStatus[], icon: "file-alert-outline", tone: "danger" },
  { key: "survey", label: "Survey pending", shortLabel: "Survey", statuses: ["Claim Intimated", "Surveyor Appointed", "Vehicle Inspected"] as ClaimStatus[], icon: "clipboard-search-outline", tone: "info" },
  { key: "approval", label: "Approval pending", shortLabel: "Approval", statuses: ["Spot Survey Completed", "Final Documents Awaited", "Final Documents Verification Pending", "Final Documents Submitted", "Final Documents Verified", "Claim Intimation", "Final Surveyor Details", "Work Approval Received"] as ClaimStatus[], icon: "shield-alert-outline", tone: "warning" },
  { key: "repair", label: "Repair and final bill", shortLabel: "Repair", statuses: ["Under Repair", "Repair Done", "RA Intimation", "RA Intimation Done", "DO Status"] as ClaimStatus[], icon: "car-wrench", tone: "info" },
  { key: "payment", label: "Settlement and payment", shortLabel: "Payment", statuses: ["Payment Stage", "Claim Completion In Progress", "Claim Complete"] as ClaimStatus[], icon: "bank-transfer", tone: "warning" },
  { key: "closed", label: "Completed", shortLabel: "Closed", statuses: ["Settled", "Closed"] as ClaimStatus[], icon: "check-decagram-outline", tone: "success" }
] as const;

export const operationsQueueDefinitions = [
  { key: "vehicle-intimation", label: "Vehicle Claims Intimated", icon: "car-emergency", tone: "info", amount: "none", statuses: ["Draft", "Accident Reported", "Initial Documents Pending", "Initial Documents Verification Pending", "Initial Documents Submitted", "Documents Pending", "Documents Submitted"] as ClaimStatus[] },
  { key: "spot-deputation", label: "Spot Deputation Pending", icon: "map-marker-account-outline", tone: "warning", amount: "none", statuses: ["Initial Documents Verified", "Claim Intimated", "Surveyor Appointed", "Vehicle Inspected"] as ClaimStatus[] },
  { key: "claim-intimation", label: "Claim Intimation Pending", icon: "file-send-outline", tone: "info", amount: "estimated", statuses: ["Spot Survey Completed", "Final Documents Awaited", "Final Documents Verification Pending", "Final Documents Submitted", "Final Documents Verified", "Claim Intimation"] as ClaimStatus[] },
  { key: "work-approval", label: "Work Approval Pending", icon: "clipboard-check-outline", tone: "success", amount: "approved", statuses: ["Estimate Submitted", "Approval Pending", "Work Approval Status", "Work Approval Received"] as ClaimStatus[] },
  { key: "reinspection", label: "Re-Inspection Pending", icon: "clipboard-search-outline", tone: "info", amount: "none", statuses: ["Final Surveyor Details", "Survey Status", "Survey Done"] as ClaimStatus[] },
  { key: "delivery-order", label: "Delivery Order Pending", icon: "file-document-edit-outline", tone: "warning", amount: "approved", statuses: ["Under Repair", "Repair Started", "Repair Done", "Repair Completed", "RA Intimation", "RA Intimation Done", "DO Status", "DO Submitted", "Final Bill Submitted"] as ClaimStatus[] },
  { key: "payment", label: "Payment Pending", icon: "cash-multiple", tone: "danger", amount: "settlement", statuses: ["Payment Stage", "Claim Completion In Progress", "Claim Complete", "Settlement Under Process"] as ClaimStatus[] },
  { key: "closed-claims", label: "Closed Claims", icon: "check-circle-outline", tone: "success", amount: "none", statuses: ["Closed"] as ClaimStatus[] }
] as const;

export type OperationsQueueKey = (typeof operationsQueueDefinitions)[number]["key"];

export const managerTransitions: Partial<Record<ClaimStatus, ClaimStatus>> = {
  Draft: "Accident Reported",
  "Accident Reported": "Initial Documents Pending",
  "Initial Documents Pending": "Initial Documents Submitted",
  "Initial Documents Submitted": "Initial Documents Verification Pending",
  "Initial Documents Verification Pending": "Initial Documents Verified",
  "Documents Pending": "Documents Submitted",
  "Documents Submitted": "Initial Documents Verified",
  "Initial Documents Verified": "Surveyor Appointed",
  "Claim Intimated": "Surveyor Appointed",
  "Surveyor Appointed": "Spot Survey Completed",
  "Spot Survey Completed": "Final Documents Awaited",
  "Vehicle Inspected": "Final Documents Awaited",
  "Final Documents Awaited": "Final Documents Submitted",
  "Final Documents Submitted": "Final Documents Verification Pending",
  "Final Documents Verification Pending": "Final Documents Verified",
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
  "Approval Pending": "Work Approval Received",
  "Repair Started": "Repair Completed",
  "Repair Completed": "DO Submitted",
  "DO Submitted": "Final Bill Submitted",
  "Final Bill Submitted": "Settlement Under Process",
  "Settlement Under Process": "Settled",
  Settled: "Closed"
};

const finalDocumentPhaseStatuses: ClaimStatus[] = ["Spot Survey Completed", "Final Documents Awaited", "Final Documents Verification Pending", "Final Documents Submitted", "Final Documents Verified", "Claim Intimation", "Final Surveyor Details", "Survey Status", "Survey Done", "Work Approval Status", "Work Approval Received", "Under Repair", "Repair Done", "RA Intimation", "RA Intimation Done", "DO Status", "Payment Stage", "Claim Completion In Progress", "Claim Complete", "DO Submitted", "Final Bill Submitted", "Settlement Under Process", "Settled", "Closed"];

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

export function replacementStatusFor(status: ClaimStatus) {
  if (["Initial Documents Submitted", "Initial Documents Verification Pending", "Documents Submitted"].includes(status)) return "Initial Documents Verification Pending" as ClaimStatus;
  if (["Final Documents Submitted", "Final Documents Verification Pending"].includes(status)) return "Final Documents Verification Pending" as ClaimStatus;
  return status;
}

export function submittedStatusFor(status: ClaimStatus) {
  if (["Initial Documents Pending", "Documents Pending"].includes(status)) return "Initial Documents Submitted" as ClaimStatus;
  if (["Final Documents Awaited"].includes(status)) return "Final Documents Submitted" as ClaimStatus;
  return status;
}

export function verifiedStatusFor(status: ClaimStatus) {
  if (["Initial Documents Verification Pending", "Initial Documents Submitted", "Documents Submitted"].includes(status)) return "Initial Documents Verified" as ClaimStatus;
  if (["Final Documents Verification Pending", "Final Documents Submitted"].includes(status)) return "Final Documents Verified" as ClaimStatus;
  return status;
}

export function stageAgeLabel(value?: string | null) {
  if (!value) return "No date available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date available";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m in stage`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h in stage`;
  const days = Math.floor(hours / 24);
  return `${days}d in stage`;
}
