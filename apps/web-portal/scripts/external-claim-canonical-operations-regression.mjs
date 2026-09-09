import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const claimsWorkspace = fs.readFileSync(path.join(root, 'app/claims/claims-workspace.tsx'), 'utf8');
const claimPage = fs.readFileSync(path.join(root, 'app/claims/[id]/page.tsx'), 'utf8');
const operationsStages = fs.readFileSync(path.join(root, 'components/claim-manager/operations-claim-stages.tsx'), 'utf8');
const entry = fs.readFileSync(path.join(root, 'components/claims/external-claim-operations-entry.tsx'), 'utf8');
const action = fs.readFileSync(path.join(root, 'app/claims/external-operations-actions.ts'), 'utf8');
const mobileStartClaim = fs.readFileSync(path.join(root, '../mobile-app/app/customer/start-claim.tsx'), 'utf8');
const mobileClaimDetail = fs.readFileSync(path.join(root, '../mobile-app/app/customer/claim-detail.tsx'), 'utf8');
const migration = fs.readFileSync(path.join(root, '../../supabase/migrations/20260909121000_external_claim_canonical_operations_workflow.sql'), 'utf8');
const enumCastFixMigration = fs.readFileSync(path.join(root, '../../supabase/migrations/20260909133000_fix_external_claim_takeover_milestone_enum_cast.sql'), 'utf8');
const customerProcessingMigration = fs.readFileSync(path.join(root, '../../supabase/migrations/20260909150000_preserve_external_customer_claim_milestones.sql'), 'utf8');
const schemaWorkflow = fs.readFileSync(path.join(root, '../../.github/workflows/apply-external-claim-canonical-operations.yml'), 'utf8');
const deployWorkflow = fs.readFileSync(path.join(root, '../../.github/workflows/deploy-production.yml'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const stageKeys = [
  'spot_intimation', 'spot_status', 'claim_intimation', 'work_approval', 'repair_ri',
  'billing', 'delivery_order', 'vehicle_delivery', 'payment_encashment',
];
for (const key of stageKeys) {
  assert(operationsStages.includes(`key: "${key}"`), `Canonical Operations workflow is missing ${key}.`);
}

assert(claimsWorkspace.includes('claim.policy_service_source === "external"'), 'External Claims must be classified by policy source.');
assert(!claimsWorkspace.includes('function isExternalClaim(claim: QueueClaimRow) { return claim.claim_service_mode === "self_managed"; }'), 'External Claims must not be classified by service mode.');
assert(claimsWorkspace.includes('<ExternalClaimOperationsEntry claimId={claim.id}'), 'External Claim Proceed must enter canonical Operations ownership before navigation.');
assert(claimPage.includes('claim.policy_service_source === "external" && claim.claim_service_mode === "self_managed"'), 'Direct External Claim links must pass through the Operations ownership boundary.');
assert(claimPage.includes('<OperationsClaimStages'), 'External Claims must ultimately reuse the canonical OperationsClaimStages component.');
assert(entry.includes('beginExternalOperationsWorkflow'), 'External Claim entry control must use the protected ownership action.');
assert(action.includes('hasEffectiveCapability(profile, "manage_claims", "edit")'), 'External ownership transfer must use the same manage_claims edit permission.');
assert(action.includes('begin_external_claim_operations_workflow'), 'External ownership transfer must use the atomic database function.');
assert(migration.includes("claim_service_mode = 'broker_managed'"), 'External Operations ownership must become broker_managed.');
assert(migration.includes("policy_service_source = 'external'"), 'External policy source must remain external.');
assert(migration.includes("from public.claim_milestones"), 'Customer milestone history must be preserved during Operations takeover.');
assert(migration.includes('external_customer_snapshot'), 'Customer milestone details must be copied as prefilling/history evidence.');
assert(migration.includes('prevent_duplicate_active_external_claim_insert'), 'External policy duplicate-claim protection must survive ownership transfer.');
assert(enumCastFixMigration.includes('create or replace function public.begin_external_claim_operations_workflow'), 'Follow-up migration must replace only the External Claim takeover RPC.');
assert(enumCastFixMigration.includes("csd.details->>'milestone_key' = cm.milestone_key::text"), 'External Claim takeover must compare milestone keys using a safe enum-to-text cast.');
assert(!enumCastFixMigration.includes("csd.details->>'milestone_key' = cm.milestone_key\n"), 'Follow-up migration must not retain the unsafe text-to-enum comparison.');
assert(!enumCastFixMigration.includes('create or replace function public.prevent_duplicate_active_external_claim_insert'), 'Enum-cast fix must not redefine the duplicate External Claim guard.');
assert(!enumCastFixMigration.includes('create trigger prevent_duplicate_active_external_claim_insert'), 'Enum-cast fix must not recreate the duplicate External Claim trigger.');
assert(schemaWorkflow.includes('20260909133000_fix_external_claim_takeover_milestone_enum_cast.sql'), 'External Claim schema workflow must apply the enum-cast fix migration.');
assert(schemaWorkflow.includes('supabase migration repair --linked --status applied 20260909133000'), 'External Claim schema workflow must record the follow-up migration.');
assert(schemaWorkflow.includes('milestone_enum_cast_ready'), 'External Claim schema workflow must verify the corrected function contract.');
assert(deployWorkflow.includes('20260909133000_fix_external_claim_takeover_milestone_enum_cast.sql'), 'Production deploy gate must recognize the External Claim enum-cast fix migration.');
assert(deployWorkflow.includes('apply-external-claim-canonical-operations.yml'), 'Production deploy gate must wait for the External Claim schema workflow.');
assert(mobileStartClaim.includes("claim_service_mode?: 'broker_managed' | 'self_managed' | null"), 'Customer active-claim lookup must understand managed External Claims.');
assert(mobileStartClaim.includes("claim.claim_service_mode === 'broker_managed'"), 'Customer Start Claim must detect an already Operations-managed External Claim.');
assert(mobileStartClaim.includes("pathname: '/customer/self-managed-claim', params: { externalPolicyId: selectedPolicy.id, claimId: existingClaim.id }"), 'Existing External Claims must reopen the Customer self-tracked journey even after Operations enters the claim.');
assert(mobileClaimDetail.includes("claim?.policy_service_source === 'external' || claim?.claim_service_mode === 'self_managed'"), 'External-policy claims must keep the Customer self-tracked journey regardless of Operations ownership mode.');
assert(customerProcessingMigration.includes("claim.policy_service_source = 'external'::public.policy_service_source"), 'Customer milestone RLS must explicitly preserve External-policy claims.');
assert(customerProcessingMigration.includes("claim.claim_service_mode = 'self_managed'::public.claim_service_mode"), 'Customer milestone RLS must preserve the original self-managed rule for non-External claims.');

console.log('External Claim canonical Operations workflow regression passed.');
