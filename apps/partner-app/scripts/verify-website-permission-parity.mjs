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
const intakeRoute = web('app/api/partner/policy-intakes/route.ts');
const migration = readFileSync(new URL('../../../supabase/migrations/20261107180000_partner_app_website_write_permission_guards.sql', import.meta.url), 'utf8');
const rollback = readFileSync(new URL('../../../supabase/rollbacks/20261107180000_partner_app_website_write_permission_guards_rollback.sql', import.meta.url), 'utf8');

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
assert.match(intakeRoute, /hasEffectiveCapability\(profile, "create_policy_intakes", "edit"\)/, 'Backend intake write must block view-only employees');
assert.match(migration, /partner_app_employee_can_write_web_capability/, 'Database must enforce employee write grants');
assert.match(migration, /auth.uid\(\)/, 'Guard must use caller identity');
assert.match(migration, /Website claim edit permission is required/, 'Claim writes deny missing edit grants');
assert.match(rollback, /DROP FUNCTION IF EXISTS public.partner_app_employee_can_write_web_capability/, 'Reversible migration is required');
for (const rpc of ['partner_app_create_claim','partner_app_save_claim_spot','partner_app_save_claim_stage','partner_app_attach_claim_document','partner_app_remove_claim_document','partner_app_save_insurer_claim_number','partner_app_insert_claim_stage_detail']) {
  const match = migration.indexOf('-- Protected RPC: ' + rpc);
  assert.ok(match >= 0, rpc + ' must have a database guard');
  assert.match(migration.slice(match, match + 600), /partner_app_employee_can_write_web_capability\('manage_claims'\)/, rpc + ' database guard must use live permission');
}
console.log('Partner App / website effective permission parity contract passed');
