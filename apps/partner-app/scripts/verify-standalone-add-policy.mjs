import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const load = (path) => readFileSync(path, 'utf8');
const policies = load('apps/partner-app/app/(tabs)/policies.tsx');
const route = load('apps/partner-app/app/policy-new.tsx');
const layout = load('apps/partner-app/app/_layout.tsx');
const permissions = load('apps/partner-app/lib/partner-permissions.ts');
const screen = load('apps/partner-app/app/policy-intakes/onboarding.tsx');
const api = load('apps/web-portal/app/api/partner/policy-intakes/native-onboarding/route.ts');
assert.match(policies, /Add Policy/);
assert.match(policies, /route: '\/policy-new' as const/);
assert.match(policies, /onPress=\{\(\) => router\.push\(action\.route\)\}/);
assert.match(policies, /canPartnerAccess\(context, 'create_policies', 'edit'\)/);
assert.match(route, /policy-intakes\/onboarding/);
assert.match(layout, /Stack\.Screen name="policy-new"/);
assert.match(permissions, /policy-new[\s\S]{0,100}create_policies/);
assert.match(screen, /usePathname\(\)==='\/policy-new'/);
assert.match(screen, /prepareNewNativePolicyOnboarding\(\)/);
assert.match(screen, /bookNewNativePolicyOnboarding\(draft,resolution,verifiedApprovalId\)/);
const booking = screen.slice(screen.indexOf('async function completeBooking('), screen.indexOf('async function requestApproval('));
assert.match(booking, /if\(dirty&&!isNew\)\{[\s\S]*saveNativePolicyOnboarding\(id,revision,draft\)/,
  'Only Intake-linked Motor booking saves an Intake draft before booking');
assert.match(booking, /isNew\s*\?await bookNewNativePolicyOnboarding\(draft,resolution,verifiedApprovalId\)/,
  'New standalone Motor sends its current draft directly to the new_book endpoint');
assert.match(booking, /:await bookNativePolicyOnboarding\(id,revision,resolution,verifiedApprovalId\)/,
  'Existing Intake Motor booking retains revision-checked booking');
assert.doesNotMatch(booking, /if\(dirty\)\{\s*const saved=await saveNativePolicyOnboarding/,
  'Never send a standalone draft to the Intake save API');
assert.match(api, /const standalone=\["new_prepare","new_book"/,
  'Server keeps independent new-book path separate from Intake validation');
assert.match(screen, /!isNew\?<View style=\{styles\.documentAndSaveActions\}>/);
assert.match(api, /if\(standalone\)\{/);
assert.match(api, /if\(body\.action==="new_prepare"\)/);
assert.match(api, /if\(body\.action!=="new_book"\)/);
assert.match(api, /onboardPolicyForVerifiedActor\(payload,profile\)/);
assert.match(api, /!head&&!creator/);
assert.doesNotMatch(api.slice(api.indexOf('if(standalone){'), api.indexOf('if(standalone){') + 7300), /policy_intake_requests.*insert/);
console.log('Standalone Add Policy routing, blank preparation, authorization and direct booking contracts verified.');
