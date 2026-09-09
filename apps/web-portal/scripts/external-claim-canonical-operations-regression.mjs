import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const claimsWorkspace = fs.readFileSync(path.join(root, 'app/claims/claims-workspace.tsx'), 'utf8');
const claimPage = fs.readFileSync(path.join(root, 'app/claims/[id]/page.tsx'), 'utf8');
const operationsStages = fs.readFileSync(path.join(root, 'components/claim-manager/operations-claim-stages.tsx'), 'utf8');
const entry = fs.readFileSync(path.join(root, 'components/claims/external-claim-operations-entry.tsx'), 'utf8');
const action = fs.readFileSync(path.join(root, 'app/claims/external-operations-actions.ts'), 'utf8');
const mobileStartClaim = fs.readFileSync(path.join(root, '../mobile-app/app/customer/start-claim.tsx'), 'utf8');
const migration = fs.readFileSync(path.join(root, '../../supabase/migrations/20260909121000_external_claim_canonical_operations_workflow.sql'), 'utf8');
const followupMigration = fs.readFileSync(path.join(root, '../../supabase/migrations/20260909133000_fix_external_claim_takeover_milestone_enum_cast.sql'), 'utf8');

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
assert(
  followupMigration.includes('create or replace function public.begin_external_claim_operations_workflow') &&
    followupMigration.includes("csd.details->>'milestone_key' = cm.milestone_key::text") &&
    !followupMigration.includes('prevent_duplicate_active_external_claim_insert') &&
    !followupMigration.includes('create trigger prevent_duplicate_active_external_claim_insert'),
  'Follow-up migration must cast milestone_key to text without redefining duplicate-claim protection.',
);
assert(
  !/csd\.details->>'milestone_key'\s*=\s*cm\.milestone_key(?!::text)/.test(followupMigration),
  'Follow-up migration must not compare JSON text directly to the claim_milestone_key enum.',
);
assert(mobileStartClaim.includes("claim_service_mode?: 'broker_managed' | 'self_managed' | null"), 'Customer active-claim lookup must understand managed External Claims.');
assert(mobileStartClaim.includes("claim.claim_service_mode === 'broker_managed'"), 'Customer Start Claim must detect an already Operations-managed External Claim.');

console.log('External Claim canonical Operations workflow regression passed.');
