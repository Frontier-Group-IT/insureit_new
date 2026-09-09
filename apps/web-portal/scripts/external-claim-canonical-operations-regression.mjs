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
const sharedStageMigration = fs.readFileSync(path.join(root, '../../supabase/migrations/20260909180000_external_claim_shared_stage_sync.sql'), 'utf8');
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

// External claim ownership and live Customer-detail fallback remain intact.
assert(claimsWorkspace.includes('claim.policy_service_source === "external"'), 'External Claims must be classified by policy source.');
assert(claimsWorkspace.includes('<ExternalClaimOperationsEntry claimId={claim.id}'), 'External Claim Proceed must enter canonical Operations ownership before navigation.');
assert(claimPage.includes('claim.policy_service_source === "external" && claim.claim_service_mode === "self_managed"'), 'Direct External Claim links must pass through the Operations ownership boundary.');
assert(claimPage.includes('<OperationsClaimStages'), 'External Claims must reuse the canonical OperationsClaimStages component.');
assert(claimPage.includes('.select("milestone_key, milestone_status, details")'), 'External Claim detail must read live Customer milestone details for prefilling.');
assert(claimPage.includes('const externalCustomerFallbackRows: StageDetailRow[]'), 'External Claim detail must build live Customer fallback rows.');
assert(claimPage.includes('details={[...(stageRows ?? []), ...externalCustomerFallbackRows]}'), 'Operations stage details must take priority before live Customer fallback rows.');
assert(claimPage.includes('mergeExternalSpotDetails(spotDetails, customerSpotIntimationDetails)'), 'External Spot Intimation must use Customer data only as fallback.');
assert(claimPage.includes('currentStatus={claim.current_status}'), 'The shared current stage must be driven by claims.current_status.');

// Stage UI must show one shared current stage, while Customer milestones still prove completed history.
assert(operationsStages.includes('const hasExternalVisualProgress = externalCustomerMilestones !== undefined;'), 'External milestone projection must remain opt-in so Internal/SIBL is unchanged.');
assert(operationsStages.includes('const externalSelectedCompleted = hasExternalVisualProgress && externalVisualCompletedKeys.has(selected.key);'), 'Completed External milestones must remain reviewable.');
assert(operationsStages.includes('const selectedAvailable = journeyComplete || selectedIndex <= activeIndex || externalSelectedCompleted;'), 'Completed External milestones must remain selectable for review.');
assert(operationsStages.includes('const selectedSaveOnly = !selectedIsCurrent;'), 'Only the shared current stage may advance; all historical review saves must be save-only.');
assert(!operationsStages.includes('externalVisualCurrentIndex'), 'External current-stage styling must not derive a second current stage from Customer milestones.');
assert(operationsStages.includes('const isCurrent = !journeyComplete && stage.key === active?.key;'), 'Operations current-stage styling must use the shared claims.current_status stage.');
assert(operationsStages.includes('const isCompleted = journeyComplete || index < activeIndex || (externalStageCompleted && !isCurrent);'), 'Completed Customer milestones may supplement completion styling without replacing the shared current stage.');
assert(operationsStages.includes('nextStageKey: result.advanced ? nextStageKeyFor(milestoneKey) : null'), 'Save Details must not visually jump to the next stage.');
assert(operationsStages.includes('if (!spotState.ok) return;\n    router.refresh();'), 'Historical Spot Intimation Save Details must not visually advance to Stage 2.');
assert(operationsStages.includes('label={selectedSaveOnly ? "Save Details"'), 'Historical stages must show an explicit Save Details action.');
assert(operationsStages.includes('"Save & complete claim"'), 'The current final stage must expose explicit claim completion wording.');
assert(operationsStages.includes('`Save & move to ${nextStageLabel}`'), 'The current non-final stage must expose an explicit advance action.');

// Server action owns the completion marker; browsers cannot inject it.
assert(stageActions.includes('if (["notes", "next_status", "current_status", "milestone_key", "save_only", "completed_at"].includes(key)) continue;'), 'Stage form parsing must discard browser-supplied completed_at.');
assert(stageActions.includes('const shouldAdvance = !saveOnly && !terminal && stageKey === activeKey && vehicleDeliveryReady;'), 'Only the current non-save-only stage may advance.');
assert(stageActions.includes('details: shouldAdvance ? { ...details, completed_at: new Date().toISOString() } : details'), 'The server action must add the completion marker only after validating an explicit advance.');
assert(stageActions.includes('claim.policy_service_source === "external" && !terminal && targetIndex > externalActiveIndex'), 'External future-stage review must remain guarded server-side.');
assert(stageActions.includes('.from("claim_milestones")'), 'External future-stage review must verify the matching Customer milestone.');

// Shared-stage database rule: Customer Stage N completion opens N+1; Operations movement mirrors back.
assert(sharedStageMigration.includes('v_target_stage := v_completed_stage + 1;'), 'Customer completion must open the next shared stage, not remain on the completed stage.');
assert(sharedStageMigration.includes("when 2 then 'Surveyor Appointed'"), 'Stage 1 completion must open Operations Stage 2.');
assert(sharedStageMigration.includes("when 3 then 'Final Documents Awaited'"), 'Stage 2 completion must open Operations Stage 3.');
assert(sharedStageMigration.includes("when 4 then 'Survey Done'"), 'Stage 3 completion must open Operations Stage 4.');
assert(sharedStageMigration.includes("when 5 then 'Work Approval Received'"), 'Stage 4 completion must open Operations Stage 5.');
assert(sharedStageMigration.includes("when 6 then 'RA Intimation Done'"), 'Stage 5 completion must open Operations Stage 6.');
assert(sharedStageMigration.includes("when 7 then 'Final Bill Submitted'"), 'Stage 6 completion must open Operations Stage 7.');
assert(sharedStageMigration.includes("when 8 then 'DO Submitted'"), 'Stage 7 completion must open Operations Stage 8.');
assert(sharedStageMigration.includes("when 9 then 'Payment Stage'"), 'Stage 8 completion must open Operations Stage 9.');
assert(sharedStageMigration.includes("v_target_status := 'Claim Complete'::public.claim_status;"), 'Customer 9/9 completion must mark the shared claim complete.');
assert(sharedStageMigration.includes('create trigger trg_sync_external_customer_stage_to_operations'), 'Customer milestone changes must drive the shared current stage.');
assert(sharedStageMigration.includes('create trigger trg_sync_external_operations_stage_to_customer'), 'Operations status advancement must mirror prior milestones to the Customer journey.');
assert(sharedStageMigration.includes("'sankalp'::public.claim_milestone_actor"), 'Operations-mirrored Customer milestones must be actor-tagged to prevent sync recursion.');
assert(sharedStageMigration.includes("and not (new.details ? 'completed_at')"), 'External Save Details writes must not advance the database stage.');
assert(sharedStageMigration.includes('perform public.sync_external_customer_stage_to_operations(v_claim_id, null);'), 'Existing External Claims must be aligned during migration backfill.');
assert(sharedStageMigration.includes("where c.policy_service_source::text = 'external'"), 'Shared-stage backfill must be scoped only to External Claims.');

// Existing External takeover/preservation boundaries remain intact.
assert(entry.includes('beginExternalOperationsWorkflow'), 'External Claim entry control must use the protected ownership action.');
assert(action.includes('hasEffectiveCapability(profile, "manage_claims", "edit")'), 'External ownership transfer must require manage_claims edit permission.');
assert(action.includes('begin_external_claim_operations_workflow'), 'External ownership transfer must use the atomic database function.');
assert(migration.includes("claim_service_mode = 'broker_managed'"), 'External Operations ownership must become broker_managed.');
assert(migration.includes("policy_service_source = 'external'"), 'External policy source must remain external.');
assert(migration.includes('external_customer_snapshot'), 'Customer milestone details must be preserved as takeover evidence.');
assert(enumCastFixMigration.includes("csd.details->>'milestone_key' = cm.milestone_key::text"), 'External Claim takeover must compare milestone keys using a safe enum-to-text cast.');
assert(customerProcessingMigration.includes("claim.policy_service_source = 'external'::public.policy_service_source"), 'Customer milestone RLS must preserve External-policy claims after Operations takeover.');
assert(customerMilestoneRpcMigration.includes("v_claim.policy_service_source = 'external'::public.policy_service_source"), 'Customer milestone RPC must allow externally sourced claims regardless of Operations ownership mode.');
assert(customerMilestoneRpcMigration.includes('v_claim.external_policy_id is not null'), 'Customer milestone RPC must require a real External policy link.');

// Claim Intimation continues to prefer Operations values over Customer fallback values.
assert(finalDocumentsActions.includes('policy_service_source: "sibl" | "external" | null'), 'Claim Intimation loader must know whether the claim is External.');
assert(finalDocumentsActions.includes('.eq("milestone_key", "claim_intimation")'), 'External Claim Intimation loader must read the matching live Customer milestone.');
assert(finalDocumentsActions.includes('detailText(details, "claim_intimation_date", "contact_person_name") || detailText(customerDetails, "claim_intimation_date")'), 'Operations Claim Intimation values must win before Customer fallback values.');

// Schema/deploy workflow must apply and verify the shared-stage migration before Vercel.
assert(schemaWorkflow.includes('20260909180000_external_claim_shared_stage_sync.sql'), 'External Claim schema workflow must apply the shared-stage migration.');
assert(schemaWorkflow.includes('supabase migration repair --linked --status applied 20260909180000'), 'External Claim schema workflow must record the shared-stage migration.');
assert(schemaWorkflow.includes('shared_customer_to_operations_ready'), 'Schema workflow must verify Customer -> Operations shared-stage synchronization.');
assert(schemaWorkflow.includes('shared_operations_to_customer_ready'), 'Schema workflow must verify Operations -> Customer synchronization.');
assert(schemaWorkflow.includes('shared_customer_trigger_ready'), 'Schema workflow must verify the Customer milestone sync trigger.');
assert(schemaWorkflow.includes('shared_operations_trigger_ready'), 'Schema workflow must verify the Operations status sync trigger.');
assert(deployWorkflow.includes('20260909180000_external_claim_shared_stage_sync.sql'), 'Production deploy gate must recognize the shared-stage migration.');
assert(deployWorkflow.includes('apply-external-claim-canonical-operations.yml'), 'Production deploy must wait for the External Claim schema workflow.');

// Customer app remains on the External milestone UI and therefore receives mirrored Operations progress without a native build.
assert(mobileStartClaim.includes("claim_service_mode?: 'broker_managed' | 'self_managed' | null"), 'Customer active-claim lookup must understand managed External Claims.');
assert(mobileClaimDetail.includes("claim?.policy_service_source === 'external' || claim?.claim_service_mode === 'self_managed'"), 'External-policy claims must keep the Customer self-tracked journey after Operations takeover.');
assert(mobileExternalStageOne.includes("if (!claim || !claim.external_policy_id)"), 'External Claim Stage 1 must remain available by External policy identity.');
assert(mobileExternalSpotStatus.includes("if (!(claimResult.data as any).external_policy_id)"), 'External Claim Spot Status must validate External policy identity rather than service mode.');

console.log('External Claim canonical Operations workflow regression passed.');
