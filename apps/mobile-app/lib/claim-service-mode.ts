export type PolicyServiceSource = 'sibl' | 'external';
export type ClaimServiceMode = 'broker_managed' | 'self_managed';
export type ClaimAssistanceStatus = 'not_requested' | 'requested' | 'accepted' | 'declined' | 'cancelled';
export type ClaimMilestoneStatus = 'not_started' | 'in_progress' | 'completed' | 'not_applicable';
export type ClaimMilestoneActor = 'customer' | 'sankalp' | 'system';

export type ClaimMilestoneKey =
  | 'spot_intimation'
  | 'spot_status'
  | 'claim_intimation'
  | 'work_approval'
  | 'repair_ri'
  | 'billing'
  | 'delivery_order'
  | 'vehicle_delivery'
  | 'payment_encashment';

export type ClaimOwnershipFields = {
  policy_service_source?: PolicyServiceSource | null;
  claim_service_mode?: ClaimServiceMode | null;
  assistance_status?: ClaimAssistanceStatus | null;
  assistance_requested_at?: string | null;
  assistance_requested_by?: string | null;
  assistance_resolved_at?: string | null;
  assistance_resolved_by?: string | null;
  assistance_notes?: string | null;
  self_management_acknowledged_at?: string | null;
  self_management_acknowledged_by?: string | null;
};

export type ClaimMilestone = {
  id: string;
  claim_id: string;
  milestone_key: ClaimMilestoneKey;
  milestone_status: ClaimMilestoneStatus;
  details: Record<string, unknown>;
  completed_at: string | null;
  recorded_by: string | null;
  recorded_by_actor: ClaimMilestoneActor;
  created_at: string;
  updated_at: string;
};

export const CLAIM_SERVICE_MODE_LABELS: Record<ClaimServiceMode, string> = {
  broker_managed: 'Sankalp Managed',
  self_managed: 'Self Tracked',
};

export const POLICY_SERVICE_SOURCE_LABELS: Record<PolicyServiceSource, string> = {
  sibl: 'Sankalp Serviced',
  external: 'Customer Added',
};

export const SELF_MANAGED_CLAIM_NOTICE =
  'This claim is being tracked by you. Sankalp is not processing this claim unless you request assistance.';

export const SELF_MANAGED_MILESTONES: ReadonlyArray<{ key: ClaimMilestoneKey; label: string }> = [
  { key: 'spot_intimation', label: 'Spot Intimation' },
  { key: 'spot_status', label: 'Spot Status' },
  { key: 'claim_intimation', label: 'Claim Intimation' },
  { key: 'work_approval', label: 'Work Approval' },
  { key: 'repair_ri', label: 'Repair & RI' },
  { key: 'billing', label: 'Billing' },
  { key: 'delivery_order', label: 'Delivery Order' },
  { key: 'vehicle_delivery', label: 'Vehicle Delivery' },
  { key: 'payment_encashment', label: 'Payment Encashment' },
];

export function isSelfManagedClaim(claim: ClaimOwnershipFields | null | undefined) {
  return claim?.claim_service_mode === 'self_managed';
}

export function isBrokerManagedClaim(claim: ClaimOwnershipFields | null | undefined) {
  return claim?.claim_service_mode !== 'self_managed';
}

export function isAssistanceRequested(claim: ClaimOwnershipFields | null | undefined) {
  return claim?.assistance_status === 'requested';
}

export function customerCanEditSelfManagedMilestones(claim: ClaimOwnershipFields | null | undefined) {
  return isSelfManagedClaim(claim) && claim?.assistance_status !== 'accepted';
}
