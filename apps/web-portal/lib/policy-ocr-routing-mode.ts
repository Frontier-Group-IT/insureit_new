/** Every Policy Intake enters the same automated queue. Untrained formats remain
 * in Action Required; a manual onboarding lane is no longer supported.
 * This compatibility field is retained while existing clients migrate. */
export function isN8nPolicyReadEnabled(): boolean {
  return process.env.INSUREIT_POLICY_OCR_PROVIDER === "n8n";
}
export type PolicyIntakeLane = "automation";
export function incomingPolicyIntakeLane(_policyType: string, _queueEnabled: boolean, _trainedLayout = false): PolicyIntakeLane {
  return "automation";
}
