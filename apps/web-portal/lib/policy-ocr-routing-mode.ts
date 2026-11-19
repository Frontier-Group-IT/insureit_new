/** Server-side rollout flags. Keep off until the local signed-PDF and upload
 * paths are smoke-tested, the reviewed migration is applied and manual
 * deployment is approved. Never trust client-supplied provider or lane flags. */
export function isN8nPolicyReadEnabled(): boolean {
  return process.env.INSUREIT_POLICY_OCR_PROVIDER === "n8n";
}
export function segregatePolicyIntakeLanes(): boolean {
  return process.env.INSUREIT_POLICY_LANE_SPLIT === "true";
}
export type PolicyIntakeLane = "manual" | "automation";
export function incomingPolicyIntakeLane(policyType: string, queueEnabled: boolean, trainedLayout = false): PolicyIntakeLane {
  return segregatePolicyIntakeLanes() && isN8nPolicyReadEnabled() && queueEnabled && trainedLayout && policyType === "motor"
    ? "automation" : "manual";
}
