import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const web = (p) => readFileSync(new URL('../../web-portal/' + p, import.meta.url), 'utf8');

const session = app('lib/partner-session.ts');
const guard = app('lib/partner-permissions.ts');
const layout = app('app/_layout.tsx');
const tabs = app('app/(tabs)/_layout.tsx');
const more = app('app/(tabs)/more.tsx');
const claimStage = app('app/claim/stage.tsx');
const claimRpc = app('lib/claims.ts');
const customers = app('lib/customers.ts');
const intake = app('lib/policy-intakes.ts');
const intakeList = app('app/policy-intakes.tsx');
const endpoint = web('app/api/partner/effective-permissions/route.ts');

assert.match(endpoint, /getEffectivePermissionAccessMap\(profile\)/, 'Employee access must come from the web portal effective permission engine');
assert.match(endpoint, /auth\.getUser\(match\[1\]\)/, 'Permissions must use authenticated caller token');
assert.match(endpoint, /identity\.profile_id !== auth\.user\.id/, 'Caller must match employee identity');
assert.match(endpoint, /profile\.is_active/, 'Inactive profiles cannot receive permissions');
assert.match(endpoint, /employee\?\.employment_status !== "active"/, 'Inactive employees cannot receive permissions');
assert.match(endpoint, /"Cache-Control": "private, no-store"/, 'Never cache permissions across accounts');
assert.doesNotMatch(endpoint, /role:\s*request\./, 'Never trust a client-supplied role');
assert.match(session, /permissions: access\.capabilities/, 'Mobile session uses server grants');
assert.match(guard, /rank\[context\.permissions\[capability\] \?\? 'none'\]/, 'Unknown permission must deny');
assert.match(guard, /requirePartnerWritePermission/, 'Mobile writes recheck live grants');
assert.match(layout, /requiredPartnerRoutePermission\(pathname\)/, 'Deep links must check permission');
assert.match(layout, /<Redirect href="\/access-denied"\s*\/>/, 'Direct route must deny');
assert.match(tabs, /href: canPartnerAccess\(context, "view_policies"\) \? undefined : null/, 'Hide policies tab without view');
assert.match(tabs, /href: canPartnerAccess\(context, "view_claims"\) \? undefined : null/, 'Hide claims tab without view');
assert.match(tabs, /href: canPartnerAccess\(context, "view_dashboard"\) \? undefined : null/, 'Hide business tab without view');
assert.match(more, /canPartnerAccess\(context, 'view_customers'\)/, 'Filter customer menu');
assert.match(more, /canPartnerAccess\(context, 'view_policy_intakes'\)/, 'Filter intake menu');
assert.match(claimStage, /mayEditClaim && !loading/, 'View-only claim stages cannot render editor');
assert.match(intakeList, /canPartnerAccess\(context, 'create_policy_intakes', 'edit'\)/, 'View-only intakes cannot create new submission');
for (const rpc of ['create_claim', 'save_claim_spot', 'save_claim_stage', 'attach_claim_document', 'remove_claim_document', 'save_insurer_claim_number']) {
  assert.match(claimRpc, new RegExp("requirePartnerWritePermission\\('manage_claims', 'edit', true\\);[\\s\\S]{0,60}partner_app_" + rpc), rpc + ' must check permission before mutation');
}
assert.match(customers, /requirePartnerWritePermission\('create_customers'\)/, 'Creation requires create_customers');
assert.match(intake, /requirePartnerWritePermission\('create_policy_intakes'\)/, 'Intake submission requires create_policy_intakes');
console.log('Partner App / website effective permission parity contract passed');
