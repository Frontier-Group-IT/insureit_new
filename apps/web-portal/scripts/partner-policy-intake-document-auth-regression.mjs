import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('app/api/partner/policy-intakes/[id]/document/route.ts', 'utf8');
const detail = readFileSync('app/api/partner/policy-intakes/route.ts', 'utf8');
const opener = readFileSync('../partner-app/lib/policy-intakes.ts', 'utf8');

assert.ok(source.includes(String.raw`bearer?.match(/^Bearer\s+(.+)$/i)`), 'Mobile Authorization: Bearer token must match whitespace correctly');
assert.ok(!source.includes(String.raw`bearer?.match(/^Bearer\\s+(.+)$/i)`), 'Never double escape Bearer whitespace matcher');
assert.ok(source.includes('scoped.auth.getUser(token)'), 'Document access requires a verified Supabase user');
assert.ok(source.includes('partner_app_current_identity'), 'Document access needs Partner identity');
assert.ok(source.includes('partner_app_commercial_scope'), 'Document read scope needs permitted lead sources');
assert.ok(source.includes('getPartnerEmployeeIntakeReadScope(identity)'), 'Document access keeps employee read restrictions');
assert.ok(source.includes('lead_source_id.in.'), 'Document endpoint permits the same scoped lead-source reads as intake details');
assert.ok(detail.includes('lead_source_id.in.'), 'Read-scope definition must remain present on intake details');
assert.ok(source.includes('query.or(predicates.join(","))'), 'Document query must apply Partner scope to the selected intake');
assert.ok(source.includes('.eq("id", id)'), 'Document query must pin the requested intake ID');
assert.ok(source.includes('.createSignedUrl(intake.storage_path, 300)'), 'Only a short-lived signed URL is returned');
assert.ok(!source.includes('console.log(token)'), 'Never log tokens');
assert.ok(opener.includes('getPartnerPolicyIntakeDocumentUrl(row'), 'Avoid returning unsigned document URLs');
console.log('Partner Policy Intake document authentication regression passed');
