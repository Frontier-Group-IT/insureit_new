import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/customer/claims.tsx', import.meta.url), 'utf8');

assert.match(source, /external_policy_id\?: string \| null;/, 'Customer claims must retain the durable external policy id.');
assert.match(source, /policy_service_source\?: 'sibl' \| 'external' \| null;/, 'Customer claims must retain the durable policy source.');
assert.match(source, /function isExternalPolicyClaim\(claim: CustomerClaim\) \{\s*return claim\.policy_service_source === 'external' \|\| Boolean\(claim\.external_policy_id\);\s*\}/s, 'External claim identity must come from policy source/id, not workflow ownership.');
assert.match(source, /const internalProjection = externalClaim \? null : projectInternalClaim\(/, 'External claims must not be projected through the Internal Claim journey.');
assert.match(source, /if \(SELF_MANAGED_MILESTONES\.every\(\(stage\) => completed\.has\(stage\.key\)\)\) return 'Claim Complete';/, 'A fully completed External Claim journey must display Claim Complete.');
assert.match(source, /if \(filter === 'Completed'\) return externalClaim \? externalCompleted : \['Closed', 'Settled', 'Claim Complete'\]\.includes\(claim\.current_status\);/, 'Completed filtering must use External milestones for External Claims.');
assert.match(source, /if \(externalCompleted \|\| claim\.claim_service_mode !== 'self_managed'\) return false;/, 'Broker-managed External Claims must not inherit Internal customer Action Required state.');
assert.match(source, /if \(externalClaim\) return !externalCompleted && claim\.current_status !== 'Rejected';/, 'Open filtering must close a fully completed External milestone journey.');
assert.match(source, /externalClaim \? 'CURRENT MILESTONE' : 'CURRENT STATUS'/, 'External Claims must display milestone language in the claims list.');
assert.match(source, /externalClaim \? externalCurrentMilestone\(claimMilestones\) : internalProjection\?\.substage/, 'External Claim cards must derive their visible status from External milestones.');

console.log('Customer External Claim list regression passed.');
