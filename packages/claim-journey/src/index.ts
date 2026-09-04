export const INTERNAL_CLAIM_STATUSES = [
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
  "Closed",
] as const;

export type InternalClaimStatus = (typeof INTERNAL_CLAIM_STATUSES)[number];

export const INTERNAL_JOURNEY_STAGES = [
  { key: "spot_intimation", label: "Spot Intimation" },
  { key: "spot_status", label: "Spot Status" },
  { key: "claim_intimation", label: "Claim Intimation" },
  { key: "work_approval", label: "Work Approval" },
  { key: "repair_ri", label: "Repair & RI" },
  { key: "billing", label: "Billing" },
  { key: "delivery_order", label: "Delivery Order" },
  { key: "vehicle_delivery", label: "Vehicle Delivery" },
  { key: "payment_encashment", label: "Payment Encashment" },
] as const;

export type InternalJourneyStageKey = (typeof INTERNAL_JOURNEY_STAGES)[number]["key"];

export const CLAIM_INTIMATION_DOCUMENT_GROUPS = [
  {
    key: "vehicle-docs",
    label: "Vehicle Docs",
    documents: [
      { type: "RC Copy", title: "RC Copy", body: "Registration certificate copy", icon: "card-account-details-outline" },
      { type: "Insurance Copy", title: "Insurance Copy", body: "Insurance policy copy", icon: "shield-file-outline" },
      { type: "Fitness Copy", title: "Fitness Copy", body: "Vehicle fitness copy", icon: "file-certificate-outline" },
      { type: "GR/Load Bill", title: "GR/Load Bill", body: "GR or load bill copy", icon: "file-document-multiple-outline" },
      { type: "Fasttag report last 15 days", title: "Fasttag report last 15 days", body: "Fastag report for last 15 days", icon: "file-document-outline" },
      { type: "Spot Report", title: "Spot Report", body: "Spot survey or inspection report", icon: "clipboard-text-outline" },
      { type: "Estimate Copy", title: "Estimate Copy", body: "Workshop estimate copy", icon: "receipt-text-outline" },
    ],
  },
  {
    key: "driver-docs",
    label: "Driver Docs",
    documents: [
      { type: "Driver Licence", title: "Driver Licence", body: "Driver licence copy", icon: "badge-account-horizontal-outline" },
      { type: "Driver Aadhaar front", title: "Driver Aadhaar front", body: "Driver Aadhaar front side", icon: "card-account-details-outline" },
      { type: "Driver Aadhaar back", title: "Driver Aadhaar back", body: "Driver Aadhaar back side", icon: "card-account-details-outline" },
      { type: "Driver Statement", title: "Driver Statement", body: "Driver statement document", icon: "file-document-edit-outline" },
    ],
  },
  {
    key: "permit-tax",
    label: "Permit / Tax",
    documents: [
      { type: "Road Tax", title: "Road Tax", body: "Road tax receipt", icon: "receipt-text-outline" },
      { type: "Local Permit A", title: "Local Permit A", body: "Local permit A copy", icon: "file-certificate-outline" },
      { type: "Local Permit B", title: "Local Permit B", body: "Local permit B copy", icon: "file-certificate-outline" },
      { type: "National Permit", title: "National Permit", body: "National permit copy", icon: "file-certificate-outline" },
      { type: "Authorization Letter", title: "Authorization Letter", body: "Authorization letter copy", icon: "file-document-outline" },
    ],
  },
  {
    key: "kyc-other",
    label: "KYC / Other",
    documents: [
      { type: "Aadhaar", title: "Aadhaar", body: "Aadhaar card copy", icon: "card-account-details-outline" },
      { type: "PAN", title: "PAN", body: "PAN card copy", icon: "card-account-details-outline" },
      { type: "GST", title: "GST", body: "GST certificate", icon: "file-certificate-outline" },
      { type: "Cancelled Cheque", title: "Cancelled Cheque", body: "Cancelled cheque copy", icon: "checkbook" },
      { type: "KYC Form", title: "KYC Form", body: "KYC form copy", icon: "file-sign" },
    ],
  },
  {
    key: "forms",
    label: "Forms",
    documents: [
      { type: "Claim Form", title: "Claim Form", body: "Signed claim form", icon: "file-sign" },
      { type: "TP Affidavit", title: "TP Affidavit", body: "Third-party affidavit", icon: "file-document-edit-outline" },
      { type: "Towing Bill", title: "Towing Bill", body: "Towing bill copy", icon: "tow-truck" },
      { type: "Repair Estimate", title: "Repair Estimate", body: "Workshop repair estimate", icon: "receipt-text-outline" },
      { type: "NCB Verification", title: "NCB Verification", body: "NCB verification document", icon: "shield-check-outline" },
    ],
  },
] as const;

export type ClaimIntimationDocumentType =
  (typeof CLAIM_INTIMATION_DOCUMENT_GROUPS)[number]["documents"][number]["type"];

export const CLAIM_INTIMATION_DOCUMENT_TYPES: ClaimIntimationDocumentType[] =
  CLAIM_INTIMATION_DOCUMENT_GROUPS.flatMap((group) => group.documents.map((document) => document.type));

const CLAIM_INTIMATION_DOCUMENT_ALIASES: Partial<Record<ClaimIntimationDocumentType, readonly string[]>> = {
  "Driver Aadhaar front": ["Driver Aadharcard front", "Driver Aadhar front"],
  "Driver Aadhaar back": ["Driver Aadharcard Back", "Driver Aadhar back"],
  Aadhaar: ["Aadharcard", "Aadhaar Card", "Aadhar Card"],
  PAN: ["Pancard", "PAN Card"],
  "Cancelled Cheque": ["Cancel Cheque", "Cancelled Check"],
  "KYC Form": ["KYC FORM"],
  "Local Permit A": ["Local permit A", "Permit Copy A"],
  "Local Permit B": ["LOCAL PERMIT B", "Permit Copy B"],
  "Authorization Letter": ["Authorization letter"],
  "Repair Estimate": ["Repair estimate"],
  "NCB Verification": ["NCB VERIFICATION"],
  "Fitness Copy": ["Fitness copy", "Vehicle Fitness Certificate"],
  "GR/Load Bill": ["GR/Load bill", "GR / Load Bill"],
  "Fasttag report last 15 days": ["Fastag report last 15 days", "FASTag Summary Report"],
  "Road Tax": ["Tax Paid Receipt"],
};

export function normalizeClaimDocumentType(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function matchesClaimIntimationDocument(documentType: string, expectedType: ClaimIntimationDocumentType | string) {
  const expected = normalizeClaimDocumentType(expectedType);
  if (normalizeClaimDocumentType(documentType) === expected) return true;

  const canonical = CLAIM_INTIMATION_DOCUMENT_TYPES.find(
    (type) => normalizeClaimDocumentType(type) === expected,
  );
  if (!canonical) return false;

  return (CLAIM_INTIMATION_DOCUMENT_ALIASES[canonical] ?? []).some(
    (alias) => normalizeClaimDocumentType(alias) === normalizeClaimDocumentType(documentType),
  );
}

export type InternalNextActionOwner = "customer" | "operations" | "none";
export type InternalJourneyState = "action_required" | "waiting_operations" | "in_progress" | "completed" | "rejected";

export type InternalClaimEvidence = {
  hasRejectedDocuments?: boolean;
  hasRequiredDocuments?: boolean;
  allRequiredDocumentsVerified?: boolean;
};

export type InternalClaimProjection = {
  knownStatus: boolean;
  status: string;
  stageIndex: number;
  stageKey: InternalJourneyStageKey;
  stageLabel: string;
  substage: string;
  completedStageCount: number;
  progress: number;
  nextActionOwner: InternalNextActionOwner;
  journeyState: InternalJourneyState;
  customerActionRequired: boolean;
  customerMessage: string;
  isTerminal: boolean;
};

type ProjectionRule = Omit<InternalClaimProjection, "knownStatus" | "status" | "stageKey" | "stageLabel" | "progress" | "customerActionRequired">;

const INITIAL_UPLOAD_STATUSES = new Set<InternalClaimStatus>(["Draft", "Accident Reported", "Initial Documents Pending", "Documents Pending"]);
const FINAL_UPLOAD_STATUSES = new Set<InternalClaimStatus>(["Final Documents Awaited"]);
const DOCUMENT_REVIEW_STATUSES = new Set<InternalClaimStatus>([
  ...INITIAL_UPLOAD_STATUSES,
  "Initial Documents Submitted",
  "Initial Documents Verification Pending",
  "Documents Submitted",
  ...FINAL_UPLOAD_STATUSES,
  "Final Documents Submitted",
  "Final Documents Verification Pending",
]);

const RULES: Record<InternalClaimStatus, ProjectionRule> = {
  Draft: customerRule(0, 0, "Claim intake", "Complete the accident report and upload the initial claim documents."),
  "Accident Reported": customerRule(0, 0, "Initial documents required", "Upload the initial claim documents so the claims desk can begin verification."),
  "Initial Documents Pending": customerRule(0, 0, "Initial documents required", "Upload the remaining initial claim documents so the claims desk can begin verification."),
  "Documents Pending": customerRule(0, 0, "Initial documents required", "Upload the remaining initial claim documents so the claims desk can begin verification."),
  "Initial Documents Submitted": operationsRule(1, 1, "Initial documents received", "Your initial documents are with the claims desk for verification."),
  "Initial Documents Verification Pending": operationsRule(1, 1, "Initial document verification", "Your initial documents are with the claims desk for verification."),
  "Documents Submitted": operationsRule(1, 1, "Initial document verification", "Your initial documents are with the claims desk for verification."),
  "Initial Documents Verified": operationsRule(1, 1, "Spot surveyor deputation", "Your documents are verified. Operations is arranging the spot survey."),
  "Claim Intimated": operationsRule(1, 1, "Spot surveyor deputation", "Operations is arranging the spot survey."),
  "Surveyor Appointed": operationsRule(1, 1, "Spot survey scheduled", "A surveyor has been assigned. Keep the vehicle available for inspection."),
  "Vehicle Inspected": operationsRule(2, 2, "Spot survey completed", "The spot inspection is complete. Operations is preparing the next document stage."),
  "Spot Survey Completed": operationsRule(2, 2, "Final documents preparation", "The spot survey is complete. Operations is preparing the final document request."),
  "Final Documents Awaited": customerRule(2, 2, "Final documents required", "Upload the final documents requested by the claims desk."),
  "Final Documents Submitted": operationsRule(2, 2, "Final documents received", "Your final documents are with the claims desk for verification."),
  "Final Documents Verification Pending": operationsRule(2, 2, "Final document verification", "Your final documents are with the claims desk for verification."),
  "Final Documents Verified": operationsRule(2, 2, "Insurer claim intimation", "Your final documents are verified. Operations is completing insurer intimation."),
  "Claim Intimation": operationsRule(2, 2, "Insurer claim intimation", "Operations is completing insurer intimation and assessment coordination."),
  "Final Surveyor Details": operationsRule(2, 2, "Final surveyor assigned", "The final surveyor details have been recorded."),
  "Survey Status": operationsRule(2, 2, "Final survey in progress", "The final assessment survey is in progress."),
  "Survey Done": operationsRule(3, 3, "Work approval preparation", "The final survey is complete. Operations is following up for work approval."),
  "Estimate Submitted": operationsRule(3, 3, "Estimate submitted", "The repair estimate is under review with the insurer."),
  "Approval Pending": operationsRule(3, 3, "Work approval pending", "Repair approval is pending with the insurer."),
  "Work Approval Status": operationsRule(3, 3, "Work approval pending", "Operations is following up with the insurer for repair approval."),
  "Work Approval Received": operationsRule(4, 4, "Work approved", "Repair approval is complete. Operations is coordinating the repair."),
  "Under Repair": operationsRule(4, 4, "Vehicle under repair", "The vehicle is under repair. Operations will update the claim after repair and re-inspection."),
  "Repair Started": operationsRule(4, 4, "Vehicle under repair", "The vehicle repair has started."),
  "Repair Done": operationsRule(4, 4, "Repair completed", "Repair is complete. Operations is coordinating re-inspection and final assessment."),
  "Repair Completed": operationsRule(4, 4, "Repair completed", "Repair is complete. Operations is coordinating final billing and assessment."),
  "RA Intimation": operationsRule(4, 4, "Re-inspection intimation", "Operations is coordinating re-inspection with the insurer."),
  "RA Intimation Done": operationsRule(5, 5, "Re-inspection completed", "Re-inspection coordination is complete. Final billing is next."),
  "Final Bill Submitted": operationsRule(6, 6, "Final bill submitted", "The final bill is with the insurer for delivery order processing."),
  "DO Status": operationsRule(6, 6, "Delivery order processing", "Operations is recording the assessment and delivery order details."),
  "DO Submitted": operationsRule(7, 7, "Delivery order submitted", "Delivery order details are submitted. Operations is coordinating vehicle release."),
  "Payment Stage": operationsRule(8, 8, "Settlement payment", "Operations is tracking payment advice and settlement."),
  "Claim Completion In Progress": operationsRule(8, 8, "Settlement confirmation", "Payment is complete. Operations is completing the settlement record."),
  "Settlement Under Process": operationsRule(8, 8, "Settlement processing", "The insurer settlement is being processed."),
  "Claim Complete": terminalRule("Journey complete", "The claim journey is complete and available for reference."),
  Settled: terminalRule("Settlement complete", "The claim has been settled and is available for reference."),
  Closed: terminalRule("Claim closed", "The claim is closed and available for reference."),
  Rejected: {
    stageIndex: 0,
    completedStageCount: 0,
    substage: "Claim requires support",
    nextActionOwner: "none",
    journeyState: "rejected",
    customerMessage: "The claim cannot progress in its current form. Contact the claims desk for the reason and available next steps.",
    isTerminal: true,
  },
};

export function projectInternalClaim(status: string | null | undefined, evidence: InternalClaimEvidence = {}): InternalClaimProjection {
  const normalizedStatus = status?.trim() || "Unknown";
  const knownStatus = INTERNAL_CLAIM_STATUSES.includes(normalizedStatus as InternalClaimStatus);
  const rule = knownStatus
    ? applyDocumentEvidence(normalizedStatus as InternalClaimStatus, RULES[normalizedStatus as InternalClaimStatus], evidence)
    : operationsRule(0, 0, "Status confirmation", "Operations is confirming the current claim stage. No action is required from you yet.");
  const stage = INTERNAL_JOURNEY_STAGES[rule.stageIndex] ?? INTERNAL_JOURNEY_STAGES[0];

  return {
    ...rule,
    knownStatus,
    status: normalizedStatus,
    stageKey: stage.key,
    stageLabel: stage.label,
    progress: Math.round((rule.completedStageCount / INTERNAL_JOURNEY_STAGES.length) * 100),
    customerActionRequired: rule.nextActionOwner === "customer",
  };
}

export function isInternalCustomerActionRequired(status: string | null | undefined, evidence: InternalClaimEvidence = {}) {
  return projectInternalClaim(status, evidence).customerActionRequired;
}

function applyDocumentEvidence(status: InternalClaimStatus, rule: ProjectionRule, evidence: InternalClaimEvidence): ProjectionRule {
  if (DOCUMENT_REVIEW_STATUSES.has(status) && evidence.hasRejectedDocuments) {
    return customerRule(rule.stageIndex, rule.completedStageCount, "Replacement document required", "Operations could not verify one or more files. Upload the requested replacement.");
  }

  if ((INITIAL_UPLOAD_STATUSES.has(status) || FINAL_UPLOAD_STATUSES.has(status)) && evidence.hasRequiredDocuments) {
    return operationsRule(
      rule.stageIndex,
      Math.max(rule.completedStageCount, status === "Final Documents Awaited" ? 2 : 1),
      status === "Final Documents Awaited" ? "Final documents received" : "Initial documents received",
      "Your documents are uploaded and waiting for Operations verification.",
    );
  }

  return rule;
}

function customerRule(stageIndex: number, completedStageCount: number, substage: string, customerMessage: string): ProjectionRule {
  return {
    stageIndex,
    completedStageCount,
    substage,
    nextActionOwner: "customer",
    journeyState: "action_required",
    customerMessage,
    isTerminal: false,
  };
}

function operationsRule(stageIndex: number, completedStageCount: number, substage: string, customerMessage: string): ProjectionRule {
  return {
    stageIndex,
    completedStageCount,
    substage,
    nextActionOwner: "operations",
    journeyState: "waiting_operations",
    customerMessage,
    isTerminal: false,
  };
}

function terminalRule(substage: string, customerMessage: string): ProjectionRule {
  return {
    stageIndex: INTERNAL_JOURNEY_STAGES.length - 1,
    completedStageCount: INTERNAL_JOURNEY_STAGES.length,
    substage,
    nextActionOwner: "none",
    journeyState: "completed",
    customerMessage,
    isTerminal: true,
  };
}
