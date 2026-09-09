import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const claimsWorkspace = fs.readFileSync(path.join(root, 'app/claims/claims-workspace.tsx'), 'utf8');
const claimPage = fs.readFileSync(path.join(root, 'app/claims/[id]/page.tsx'), 'utf8');
const operationsStages = fs.readFileSync(path.join(root, 'components/claim-manager/operations-claim-stages.tsx'), 'utf8');
const stageActions = fs.readFileSync(path.join(root, 'app/claims/stage-actions.ts'), 'utf8');
const finalDocumentsActions = fs.readFileSync(path.join(root, 'components/final-documents/final-documents-actions.ts'), 'utf8');
const entry = fs.readFileSync(path.join(root, 'components/claims/external-claim-operations-entry.tsx'), 'utf8');
const action = fs.readFileSync(path.join(root, 'app/claims/external-operations-actions.ts'), 'utf8');
const mobileStartClaim = fs.readFileSync(path.join(root, '../mobile-app/app/customer/start-claim.tsx'), 'utf8');
const mobileClaimDetail = fs.readFileSync(path.join(root, '../mobile-app/app/customer/claim-detail.tsx'), 'utf8');
const mobileExternalStageOne = fs.readFileSync(path.join(root, '../mobile-app/app/customer/self-managed-claim.tsx'), 'utf8');
const mobileExternalSpotStatus = fs.readFileSync(path.join(root, '../mobile-app/app/customer/self-managed-spot-status.tsx'), 'utf8');
const migration = fs.readFileSync(path.join(root, '../../supabase/migrations/20260909121000_external_claim_canonical_operations_workflow.sql'), 'utf8');
const enumCastFixMigration = fs.readFileSync(path.join(root, '../../supabase/migrations/20260909133000_fix_external_claim_takeover_milestone_enum_cast.sql'), 'utf8');
const customerProcessingMigration = fs.readFileSync(path.join(root, '../../supabase/migrations/20260909150000_preserve_external_customer_claim_milestones.sql'), 'utf8');
const customerMilestoneRpcMigration = fs.readFileSync(path.join(root, '../../supabase/migrations/20260909160000_preserve_external_customer_milestone_rpc.sql'), 'utf8');
const customerStageSyncMigration = fs.readFileSync(path.join(root, '../../supabase/migrations/20260909170000_sync_external_customer_milestones_to_operations.sql'), 'utf8');
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
assert(claimPage.includes('.from("claim_milestones")'), 'Broker-managed External Claim detail must read preserved Customer milestones.');
assert(claimPage.includes('.select("milestone_key, milestone_status, details")'), 'External Claim detail must read live Customer milestone details for prefilling.');
assert(claimPage.includes('const externalCustomerFallbackRows: StageDetailRow[]'), 'External Claim detail must build live Customer fallback rows.');
assert(claimPage.includes('details={[...(stageRows ?? []), ...externalCustomerFallbackRows]}'), 'Operations stage details must take priority before live Customer fallback rows.');
assert(claimPage.includes('mergeExternalSpotDetails(spotDetails, customerSpotIntimationDetails)'), 'External Spot Intimation must merge live Customer details without replacing Operations values.');
assert(!claimPage.includes('Customer external journey'), 'Operations claim detail must not render the removed Customer External Journey summary section.');
assert(!claimPage.includes('Operations processing'), 'Operations claim detail must not render the removed Operations Processing summary section.');
assert(!claimPage.includes('Customer completion does not auto-advance or overwrite the Operations workflow.'), 'Operations claim detail must not render the removed dual-journey explanatory copy.');
assert(claimPage.includes('currentStatus={claim.current_status}'), 'Operations actions must keep claims.current_status as their workflow authority.');
assert(claimPage.includes('externalCustomerMilestones={externalCustomerMilestones?.map'), 'External Claim stage bar must receive preserved Customer milestones for visual progress.');
assert(!claimPage.includes('.update({ current_status'), 'External Customer milestone page reads must not directly write Operations status.');
assert(operationsStages.includes('externalCustomerMilestones?: CustomerMilestoneVisual[];'), 'OperationsClaimStages must support an External Customer milestone projection.');
assert(operationsStages.includes('const hasExternalVisualProgress = externalCustomerMilestones !== undefined;'), 'External milestone projection must be opt-in so Internal/SIBL behavior is unchanged.');
assert(operationsStages.includes('const externalVisualCurrentIndex = hasExternalVisualProgress'), 'External milestone projection must derive the first incomplete visual stage.');
assert(operationsStages.includes('const externalSelectedCompleted = hasExternalVisualProgress && externalVisualCompletedKeys.has(selected.key);'), 'Completed External Customer stages must be recognized for safe review access.');
assert(operationsStages.includes('const selectedAvailable = journeyComplete || selectedIndex <= activeIndex || externalSelectedCompleted;'), 'Completed External Customer stages must be selectable without changing Internal/SIBL availability.');
assert(operationsStages.includes('const selectedSaveOnly = externalSelectedCompleted || !selectedIsCurrent;'), 'Completed External Customer stages must remain save-only when reviewed through the generic Operations form.');
assert(operationsStages.includes('&& !externalSelectedCompleted'), 'A completed External Spot Intimation must not show the workflow-advance action.');
assert(operationsStages.includes('const externalStageCompleted = hasExternalVisualProgress && externalVisualCompletedKeys.has(stage.key);'), 'External stage availability must be driven by the matching completed Customer milestone.');
assert(operationsStages.includes('const available = journeyComplete || index <= activeIndex || externalStageCompleted;'), 'Completed External Customer stages must be unlocked in the stage bar.');
assert(operationsStages.includes('const isCurrent = hasExternalVisualProgress ? externalVisualCurrentIndex === index'), 'External Claim current-stage styling must come from Customer milestone progress.');
assert(operationsStages.includes('const isCompleted = hasExternalVisualProgress ? externalStageCompleted'), 'External Claim completed-stage styling must come from Customer milestone progress.');
assert(operationsStages.includes('value={selectedSaveOnly ? "true" : "false"}'), 'External completed-stage forms must submit in save-only mode.');
assert(operationsStages.includes('label={spotCurrentEditable ? `Save & move to ${managerNext}` : "Save Details"}'), 'Completed External Spot Intimation must show Save Details instead of workflow advancement.');

assert(stageActions.includes('policy_service_source: "sibl" | "external" | null;'), 'Stage save guard must know whether the claim is External.');
assert(stageActions.includes('.select("id,current_status,claim_service_mode,policy_service_source")'), 'Stage save guard must read the claim policy source.');
assert(stageActions.includes('const externalActiveIndex = activeKey ? orderedStageKeys.indexOf(activeKey) : -1;'), 'External stage validation must treat Stage 1 as before all Stage 2-9 actions.');
assert(stageActions.includes('claim.policy_service_source === "external" && !terminal && targetIndex > externalActiveIndex'), 'Future-stage review exception must be scoped only to External Claims.');
assert(stageActions.includes('if (!saveOnly)'), 'External future stages must never advance Operations while being reviewed ahead of the official stage.');
assert(stageActions.includes('.from("claim_milestones")'), 'External future-stage review must verify the Customer milestone server-side.');
assert(stageActions.includes('.eq("milestone_key", stageKey)'), 'External future-stage review must verify the matching milestone only.');
assert(stageActions.includes('completedExternalMilestoneStatuses.has(customerMilestone?.milestone_status ?? "")'), 'Only completed or not-applicable Customer milestones may unlock External stage review.');
assert(stageActions.includes('const shouldAdvance = !saveOnly && !terminal && stageKey === activeKey && vehicleDeliveryReady;'), 'Save-only External stage review must not advance claims.current_status.');
assert(stageActions.includes('} else if (!terminal && targetIndex > activeIndex) {'), 'Existing Internal/SIBL stage-order guard must remain in place.');

assert(finalDocumentsActions.includes('policy_service_source: "sibl" | "external" | null'), 'Claim Intimation loader must know whether the claim is External.');
assert(finalDocumentsActions.includes('.eq("milestone_key", "claim_intimation")'), 'External Claim Intimation loader must read the matching live Customer milestone.');
assert(finalDocumentsActions.includes('detailText(details, "claim_intimation_date", "contact_person_name") || detailText(customerDetails, "claim_intimation_date")'), 'Operations Claim Intimation values must win before Customer fallback values.');
assert(finalDocumentsActions.includes('detailText(details, "estimate_amount") || detailText(customerDetails, "estimate_amount")'), 'External Customer estimate amount must prefill only when Operations has no value.');

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

assert(customerStageSyncMigration.includes('create or replace function public.external_claim_customer_completed_stage'), 'External Customer stage sync must derive the highest contiguous completed Customer stage.');
assert(customerStageSyncMigration.includes("cm.milestone_status::text in ('completed', 'not_applicable')"), 'Completed and not-applicable Customer milestones must count as filled stages.');
assert(customerStageSyncMigration.includes('create or replace function public.sync_external_claim_operations_stage('), 'External Customer stage sync must have one authoritative database function.');
assert(customerStageSyncMigration.includes("coalesce(v_claim.policy_service_source::text, '') <> 'external'"), 'Customer stage sync must be restricted to External policy claims.');
assert(customerStageSyncMigration.includes('or v_claim.external_policy_id is null'), 'Customer stage sync must require durable External policy identity.');
assert(customerStageSyncMigration.includes('if v_operations_stage > v_customer_stage then'), 'Customer stage sync must never move Operations backward.');
assert(customerStageSyncMigration.includes("when 2 then 'Surveyor Appointed'::public.claim_status"), 'Completed Customer Stage 2 must make Operations officially Stage 2.');
assert(customerStageSyncMigration.includes("when 3 then 'Survey Status'::public.claim_status"), 'Completed Customer Stage 3 must make Operations officially Stage 3.');
assert(customerStageSyncMigration.includes("when 9 then 'Claim Complete'::public.claim_status"), 'Completed Customer Stage 9 must make Operations Claim Complete.');
assert(customerStageSyncMigration.includes('create trigger trg_sync_external_claim_operations_stage'), 'Every Customer milestone write must trigger official Operations stage synchronization.');
assert(customerStageSyncMigration.includes('perform public.sync_external_claim_operations_stage(v_claim_id, null);'), 'Existing External Claims must be backfilled when the stage-sync migration is applied.');
assert(customerStageSyncMigration.includes("v_claim.current_status::text in ('Rejected', 'Settled', 'Closed')"), 'Customer progress must not reopen an explicit terminal Operations decision.');

assert(schemaWorkflow.includes('20260909133000_fix_external_claim_takeover_milestone_enum_cast.sql'), 'External Claim schema workflow must retain the already-applied enum-cast migration as a release marker.');
assert(schemaWorkflow.includes('20260909150000_preserve_external_customer_claim_milestones.sql'), 'External Claim schema workflow must apply the External Customer milestone RLS migration.');
assert(schemaWorkflow.includes('20260909160000_preserve_external_customer_milestone_rpc.sql'), 'External Claim schema workflow must apply the External Customer milestone RPC migration.');
assert(schemaWorkflow.includes('20260909170000_sync_external_customer_milestones_to_operations.sql'), 'External Claim schema workflow must apply the official Customer-to-Operations stage-sync migration.');
assert(schemaWorkflow.includes('supabase migration repair --linked --status applied 20260909150000'), 'External Claim schema workflow must record the milestone RLS migration.');
assert(schemaWorkflow.includes('supabase migration repair --linked --status applied 20260909160000'), 'External Claim schema workflow must record the milestone RPC migration.');
assert(schemaWorkflow.includes('supabase migration repair --linked --status applied 20260909170000'), 'External Claim schema workflow must record the milestone stage-sync migration.');
assert(schemaWorkflow.includes('customer_external_rpc_ready'), 'External Claim schema workflow must verify the Customer External milestone RPC contract.');
assert(schemaWorkflow.includes('non_external_self_managed_guard_ready'), 'External Claim schema workflow must verify the non-External self-managed guard remains present.');
assert(schemaWorkflow.includes('customer_stage_sync_ready'), 'External Claim schema workflow must verify the official stage-sync function.');
assert(schemaWorkflow.includes('customer_stage_sync_trigger_ready'), 'External Claim schema workflow must verify the milestone trigger.');
assert(schemaWorkflow.includes('customer_stage_floor_applied'), 'External Claim schema workflow must verify Operations is not behind Customer progress.');
assert(schemaWorkflow.includes('customer_complete_synced'), 'External Claim schema workflow must verify 9/9 Customer journeys are officially complete in Operations.');

assert(deployWorkflow.includes('20260909133000_fix_external_claim_takeover_milestone_enum_cast.sql'), 'Production deploy gate must recognize the External Claim enum-cast fix migration.');
assert(deployWorkflow.includes('20260909150000_preserve_external_customer_claim_milestones.sql'), 'Production deploy gate must recognize the External Customer milestone RLS migration.');
assert(deployWorkflow.includes('20260909160000_preserve_external_customer_milestone_rpc.sql'), 'Production deploy gate must recognize the External Customer milestone RPC migration.');
assert(deployWorkflow.includes('20260909170000_sync_external_customer_milestones_to_operations.sql'), 'Production deploy gate must recognize the External Customer official-stage synchronization migration.');
assert(deployWorkflow.includes('apply-external-claim-canonical-operations.yml'), 'Production deploy gate must wait for the External Claim schema workflow.');

assert(mobileStartClaim.includes("claim_service_mode?: 'broker_managed' | 'self_managed' | null"), 'Customer active-claim lookup must understand managed External Claims.');
assert(mobileStartClaim.includes("claim.claim_service_mode === 'broker_managed'"), 'Customer Start Claim must detect an already Operations-managed External Claim.');
assert(mobileStartClaim.includes("pathname: '/customer/self-managed-claim', params: { externalPolicyId: selectedPolicy.id, id: existingClaim.id }"), 'Existing External Claims must reopen the Customer self-tracked journey with the route parameter consumed by the destination screen.');
assert(!mobileStartClaim.includes('claimId: existingClaim.id'), 'Existing External Claim resume must not use the obsolete claimId parameter.');
assert(mobileClaimDetail.includes("claim?.policy_service_source === 'external' || claim?.claim_service_mode === 'self_managed'"), 'External-policy claims must keep the Customer self-tracked journey regardless of Operations ownership mode.');
assert(mobileExternalStageOne.includes("if (!claim || !claim.external_policy_id)"), 'External Claim Stage 1 must remain editable for externally sourced claims regardless of Operations ownership mode.');
assert(!mobileExternalStageOne.includes("claim.claim_service_mode !== 'self_managed'"), 'External Claim Stage 1 must not reject a claim only because Operations ownership is broker_managed.');
assert(mobileExternalSpotStatus.includes("if (!(claimResult.data as any).external_policy_id)"), 'External Claim Spot Status must validate External policy identity rather than service mode.');
assert(!mobileExternalSpotStatus.includes("claim_service_mode !== 'self_managed'"), 'External Claim Spot Status must not reject a claim only because Operations ownership is broker_managed.');

assert(customerProcessingMigration.includes("claim.policy_service_source = 'external'::public.policy_service_source"), 'Customer milestone RLS must explicitly preserve External-policy claims.');
assert(customerProcessingMigration.includes("claim.claim_service_mode = 'self_managed'::public.claim_service_mode"), 'Customer milestone RLS must preserve the original self-managed rule for non-External claims.');
assert(customerMilestoneRpcMigration.includes("v_claim.policy_service_source = 'external'::public.policy_service_source"), 'Customer milestone RPC must allow externally sourced claims regardless of Operations ownership mode.');
assert(customerMilestoneRpcMigration.includes('v_claim.external_policy_id is not null'), 'Customer milestone RPC must require a real External policy link.');
assert(customerMilestoneRpcMigration.includes("v_claim.claim_service_mode = 'self_managed'::public.claim_service_mode"), 'Customer milestone RPC must preserve the original self-managed rule for non-External claims.');
assert(customerMilestoneRpcMigration.includes("coalesce(v_claim.assistance_status::text, 'not_requested') <> 'accepted'"), 'Non-External self-managed claims must retain the assistance takeover restriction.');
assert(!customerMilestoneRpcMigration.includes("v_claim.claim_service_mode = 'broker_managed'::public.claim_service_mode"), 'Customer milestone RPC must not broadly authorize broker-managed Internal/SIBL claims.');

console.log('External Claim canonical Operations workflow regression passed.');
