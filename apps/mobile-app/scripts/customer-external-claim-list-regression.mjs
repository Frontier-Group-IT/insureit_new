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
assert.match(source, /getVehicleBrandLogoSource\(vehicle\?\.make\)/, 'Customer claim cards must resolve the linked vehicle manufacturer logo.');
assert.match(source, /styles\.milestoneRightValue[\s\S]*externalClaim \? externalCurrentMilestone\(claimMilestones\) : internalProjection\?\.substage/, 'External Claim cards must show their current milestone at the far right of the top row.');
assert.match(source, /<Text style=\{styles\.identityLabel\}>INCIDENT<\/Text>[\s\S]*<Text style=\{styles\.identityLabel\}>CONTROL NO\.<\/Text>[\s\S]*<Text style=\{styles\.identityLabel\}>CLAIM NO\.<\/Text>/, 'Claim cards must show Incident, Control No. and Claim No. in one summary row.');
assert.doesNotMatch(source, /styles\.vehicleMeta/, 'Claim cards must not show manufacturer/model text below the vehicle number.');
assert.doesNotMatch(source, /name="chevron-right"/, 'Claim cards must not show the old far-right chevron.');
assert.doesNotMatch(source, /styles\.currentRow/, 'Claim cards must not render the removed second summary row.');

console.log('Customer External Claim list regression passed.');
