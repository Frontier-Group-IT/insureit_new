const DASHBOARD_ICON_BASE = '/assets/Custom-Icons/optimized-128';

export const DASHBOARD_ICON_ASSETS = {
  // Core dashboard domains
  policy: `${DASHBOARD_ICON_BASE}/policy.png`,
  claims: `${DASHBOARD_ICON_BASE}/claims.png`,
  policyIntake: `${DASHBOARD_ICON_BASE}/policy-intake.png`,
  renewal: `${DASHBOARD_ICON_BASE}/renewal.png`,
  fleetVehicle: `${DASHBOARD_ICON_BASE}/fleet-vehicle.png`,
  customers: `${DASHBOARD_ICON_BASE}/customers.png`,
  distributionNetwork: `${DASHBOARD_ICON_BASE}/distribution-network.png`,
  partnerIntermediary: `${DASHBOARD_ICON_BASE}/partner-intermediary.png`,
  accountsFinance: `${DASHBOARD_ICON_BASE}/accounts-finance.png`,
  reconciliation: `${DASHBOARD_ICON_BASE}/reconciliation.png`,
  tasksWorkQueue: `${DASHBOARD_ICON_BASE}/tasks-work-queue.png`,
  kyc: `${DASHBOARD_ICON_BASE}/kyc.png`,
  documents: `${DASHBOARD_ICON_BASE}/documents.png`,
  reportsAnalytics: `${DASHBOARD_ICON_BASE}/reports-analytics.png`,

  // Action Center
  policyIntakeReview: `${DASHBOARD_ICON_BASE}/policy-intake-review.png`,
  ocrManualReview: `${DASHBOARD_ICON_BASE}/ocr-manual-review.png`,
  expiredPolicy: `${DASHBOARD_ICON_BASE}/expired-policy.png`,
  claimOverdue: `${DASHBOARD_ICON_BASE}/claim-overdue.png`,
  documentsPending: `${DASHBOARD_ICON_BASE}/documents-pending.png`,
  kycCorrection: `${DASHBOARD_ICON_BASE}/kyc-correction.png`,
  reconciliationException: `${DASHBOARD_ICON_BASE}/reconciliation-exception.png`,
  receivableOverdue: `${DASHBOARD_ICON_BASE}/receivable-overdue.png`,

  // Today's snapshot
  policyBooked: `${DASHBOARD_ICON_BASE}/policy-booked.png`,
  claimsIntimatedToday: `${DASHBOARD_ICON_BASE}/claims-intimated-today.png`,
  intakesReceived: `${DASHBOARD_ICON_BASE}/intakes-received.png`,
  tasksCompleted: `${DASHBOARD_ICON_BASE}/tasks-completed.png`,
  kycCompleted: `${DASHBOARD_ICON_BASE}/kyc-completed.png`,
  receiptsPosted: `${DASHBOARD_ICON_BASE}/receipts-posted.png`,

  // Claim workflow
  claimIntimation: `${DASHBOARD_ICON_BASE}/claim-intimation.png`,
  claimSurvey: `${DASHBOARD_ICON_BASE}/claim-survey.png`,
  claimDocuments: `${DASHBOARD_ICON_BASE}/claim-documents.png`,
  claimAssessment: `${DASHBOARD_ICON_BASE}/claim-assessment.png`,
  claimApproval: `${DASHBOARD_ICON_BASE}/claim-approval.png`,
  claimSettlement: `${DASHBOARD_ICON_BASE}/claim-settlement.png`,
} as const;

export type DashboardIconKey = keyof typeof DASHBOARD_ICON_ASSETS;
