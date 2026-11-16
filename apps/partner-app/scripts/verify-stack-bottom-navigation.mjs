import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(`apps/partner-app/${path}`, 'utf8');
const bar = read('components/partner-stack-bottom-navigation.tsx');
const tabs = read('app/(tabs)/_layout.tsx');
const shell = read('components/partner-screen.tsx');
const onboarding = read('app/policy-intakes/onboarding.tsx');
const standalone = read('app/policy-new.tsx');
const partner = read('app/partner-new.tsx');
const cases = read('app/life-health-cases/index.tsx');
const detail = read('app/life-health-cases/[id].tsx');

for (const title of ['Home', 'Business', 'Policies', 'Claims', 'More']) {
  assert.match(tabs, new RegExp(`title: '${title}'`), `Existing Home navigator has ${title}`);
  assert.match(bar, new RegExp(`label: '${title}'`), `Stack nav preserves ${title}`);
}
for (const route of ['/(tabs)', '/(tabs)/business', '/(tabs)/policies', '/(tabs)/claims', '/(tabs)/more']) {
  assert.ok(bar.includes(`href: '${route}'`), `Use shared tab destination ${route}`);
}
assert.match(bar, /canPartnerAccess\(context, 'view_claims'\)/, 'Claims tab permission retained');
assert.match(bar, /canPartnerAccess\(context, 'view_policies'\)/, 'Policies tab permission retained');
assert.match(bar, /canPartnerAccess\(context, 'view_dashboard'\)/, 'Home and Business permissions retained');
assert.match(bar, /if \(!permitted\) return null/, 'Unauthorized tabs are hidden without blank placeholders');
assert.match(bar, /keyboardWillShow/, 'Hide nav during iOS keyboard display');
assert.match(bar, /keyboardDidShow/, 'Hide nav during Android keyboard display');
assert.match(bar, /if \(keyboardOpen\) return null/, 'Do not obscure the active text field');
assert.match(bar, /includeBottomInset/, 'Standalone forms own bottom safe-area inset');
assert.match(shell, /navyBottomNavigation && styles\.navyBottomNavigation/, 'PartnerScreen navy bottom safe area is opt-in');
assert.match(onboarding, /bottomNavigation=\{<PartnerStackBottomNavigation activeTab="policies" onNavigate=\{navigateFromOnboarding\} \/>\}/, 'Every onboarding product includes nav');
assert.match(onboarding, /if\(hasUnsavedChanges\)\{setPendingTab\(destination\);setDialog\('discard'\);\}/, 'Unsaved onboarding work prompts before switching tabs');
assert.match(onboarding, /saving\|\|booking\|\|creatingLifeHealth\|\|documentBusy/, 'Block navigation during writes and uploads');
assert.match(onboarding, /if\(destination\)router\.navigate\(destination as never\);else router\.back\(\)/, 'Confirmed discard reaches intended tab or Back');
assert.match(standalone, /from '\.\/policy-intakes\/onboarding'/, 'Standalone Add Policy shares guarded onboarding');
assert.match(partner, /<PartnerStackBottomNavigation activeTab="more" includeBottomInset onNavigate=\{leavePartnerForm\} \/>/, 'Add Partner includes Home navigator');
assert.match(partner, /hasUnsavedDetails/, 'Warn before abandoning Partner form');
assert.match(partner, /if \(saving\) return/, 'Do not navigate during Partner submission');
assert.match(cases, /bottomNavigation=\{<PartnerStackBottomNavigation activeTab="policies" \/>\}/, 'Case Register has bottom navigation');
assert.match(detail, /bottomNavigation=\{<PartnerStackBottomNavigation activeTab="policies" \/>\}/, 'Case Details has bottom navigation');
assert.match(cases, /status_group==='issued' && row\.final_policy_id/, 'Issued popup remains functional');
assert.match(detail, /visible=\{editing&&!!form\}/, 'Detail editing modal remains available');
console.log('Partner Stack bottom navigation coverage passed');
