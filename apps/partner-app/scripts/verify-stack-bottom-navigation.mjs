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
const customerDetail = read('app/customer/[id].tsx');
const contactActions = read('components/ui/partner-contact-actions.tsx');
const intakeDetail = read('app/policy-intakes/[id].tsx');
const newIntake = read('app/policy-intake-new.tsx');
const businessReport = read('app/business-report.tsx');
const network = read('app/network.tsx');
const customers = read('app/customers.tsx');

const insurers = read('app/insurers.tsx');

for (const title of ['Home', 'Business', 'Policies', 'Claims', 'More']) {
  assert.match(tabs, new RegExp(`title: '${title}'`), `Existing Home navigator has ${title}`);
  assert.match(bar, new RegExp(`label: '${title}'`), `Stack nav preserves ${title}`);
}
for (const route of ['/(tabs)', '/(tabs)/business', '/(tabs)/policies', '/(tabs)/claims', '/(tabs)/more']) {
  assert.ok(bar.includes(`href: '${route}'`), `Use shared tab destination ${route}`);
}
assert.match(intakeDetail, /bottomNavigationNavy[\s\S]*bottomNavigation=\{<PartnerStackBottomNavigation activeTab="policies" \/>\}/, 'Policy Intake Review uses shared navy nav, Policies active');
assert.doesNotMatch(intakeDetail, /function PolicyIntakeDetailNavigation/, 'Old white intake-specific nav is removed');
assert.equal((newIntake.match(/<PartnerStackBottomNavigation activeTab="policies" includeBottomInset onNavigate=\{requestClose\} \/>/g)||[]).length,2, 'Both lead-source and intake form steps include the shared nav');
assert.match(newIntake, /if \(submitting\) return;[\s\S]*setPendingTab\(destination\)/, 'Intake navigation blocks during submission and preserves unsaved-file warning');
assert.match(newIntake, /onPress=\{\(\) => requestClose\(\)\}/, 'Cancel remains back navigation, not an event object');
assert.match(businessReport, /bottomNavigationNavy[\s\S]*bottomNavigation=\{<PartnerStackBottomNavigation activeTab="business" \/>\}/, 'Business Report shows navy Business nav');
assert.match(insurers, /bottomNavigationNavy[\s\S]*bottomNavigation=\{<PartnerStackBottomNavigation activeTab="business" \/>\}/, 'Insurer Performance shows navy Business nav');
assert.match(network, /navyStatusBar bottomNavigationNavy bottomNavigation=\{<PartnerStackBottomNavigation activeTab="business" \/>\}/, 'Commercial Relationships uses navy status bar and the shared Business-active Home navigator');
assert.match(network, /pageCanvas: \{[^\n]*backgroundColor: '#F5F7FB'/, 'Commercial Relationships content canvas must be light while the header and footer stay navy');
assert.match(network, /scope: \{ color: '#58677E'/, 'Organization scope text remains readable on the light page');
assert.match(network, /updated: \{ color: '#8995A7'/, 'Updated time remains readable on the light page');
assert.match(network, /header: \{[\s\S]*?backgroundColor: '#071E49'/, 'Commercial Relationships header must be navy');
assert.match(customers, /<StatusBar style="light" backgroundColor="#071E49" \/>/, 'Customers uses a navy system status area with white icons');
assert.match(customers, /safeArea: \{ flex: 1, backgroundColor: '#071E49' \}/, 'Customers outer canvas must remain navy');
assert.match(customers, /content: \{[^\n]*backgroundColor: '#071E49'/, 'Customers scrolling content must remain navy');
assert.match(customers, /hero: \{[^\n]*backgroundColor: '#071E49'/, 'Customers header must be navy');
assert.match(customers, /<PartnerStackBottomNavigation activeTab="business" \/>/, 'Customers uses shared permission-aware Home navigator, Business selected');
assert.doesNotMatch(customers, /<NavItem icon=/, 'Customers must not restore separate white navigation tabs');

assert.match(bar, /canPartnerAccess\(context, 'view_claims'\)/, 'Claims tab permission retained');
assert.match(bar, /canPartnerAccess\(context, 'view_policies'\)/, 'Policies tab permission retained');
assert.match(bar, /canPartnerAccess\(context, 'view_dashboard'\)/, 'Home and Business permissions retained');
assert.match(bar, /if \(!permitted\) return null/, 'Unauthorized tabs are hidden without blank placeholders');
assert.match(bar, /keyboardWillShow/, 'Hide nav during iOS keyboard display');
assert.match(bar, /keyboardDidShow/, 'Hide nav during Android keyboard display');
assert.match(bar, /if \(keyboardOpen\) return null/, 'Do not obscure the active text field');
assert.match(bar, /includeBottomInset/, 'Standalone forms own bottom safe-area inset');
assert.match(shell, /bottomNavigationNavy && styles\.bottomNavigationNavy/, 'PartnerScreen navy bottom safe area is opt-in');
assert.match(onboarding, /bottomNavigation=\{<PartnerStackBottomNavigation activeTab="policies" onNavigate=\{navigateFromOnboarding\} \/>\}/, 'Every onboarding product includes nav');
assert.match(onboarding, /if\(hasUnsavedChanges\)\{setPendingTab\(destination\);setDialog\('discard'\);\}/, 'Unsaved onboarding work prompts before switching tabs');
assert.match(onboarding, /saving\|\|booking\|\|creatingLifeHealth\|\|documentBusy/, 'Block navigation during writes and uploads');
assert.match(onboarding, /if\(destination\)router\.navigate\(destination as never\);else router\.back\(\)/, 'Confirmed discard reaches intended tab or Back');
assert.match(standalone, /from '\.\/policy-intakes\/onboarding'/, 'Standalone Add Policy shares guarded onboarding');
assert.match(partner, /<PartnerStackBottomNavigation activeTab="more" includeBottomInset onNavigate=\{leavePartnerForm\} \/>/, 'Add Partner includes Home navigator');
assert.match(partner, /hasUnsavedDetails/, 'Warn before abandoning Partner form');
assert.match(partner, /if \(saving \|\| uploadingType\) return/, 'Do not navigate during Partner saves or document uploads');
assert.match(cases, /bottomNavigation=\{<PartnerCaseBottomNavigation\/>\}/, 'Existing Case Register navigation preserved');
assert.match(detail, /bottomNavigation=\{<PartnerCaseBottomNavigation\/>\}/, 'Existing Case Details navigation preserved');
assert.match(customerDetail, /bottomNavigation=\{<PartnerStackBottomNavigation activeTab="business" \/>\}/, 'Customer Details has five shared Home tabs with Business active');
assert.match(customerDetail, /bottomNavigationNavy/, 'Customer Details footer safe area remains navy on Android and iOS');
assert.match(customerDetail, /avatar: \{ width: 64, height: 64, borderRadius: 32/, 'Customer avatar is enlarged to 64px while staying circular');
assert.match(customerDetail, /avatarText: \{ color: '#6B28CE', fontSize: 24/, 'Customer initials scale with avatar');
assert.match(customerDetail, /<PartnerContactActions[^>]*inlineLabeled customerDetailLayout/, 'Customer Details uses dedicated contact layout');
assert.match(contactActions, /customerDetailRow: \{ width: '100%', justifyContent: 'space-between'/, 'Call starts at customer name left edge and contact actions occupy available width');
assert.match(contactActions, /customerDetailAction: \{ flex: 0, flexShrink: 0, width: 'auto'/, 'Individual customer contact controls retain their original compact appearance');
assert.match(contactActions, /customerDetailLayout && styles\.customerDetailAction/, 'Other contact action layouts remain unaffected');

assert.match(customerDetail, /\['overview', 'person-outline', 'Overview'\]/, 'Existing Overview detail tab is preserved');
assert.match(customerDetail, /\['vehicles', 'car-sport-outline', 'Vehicles'\]/, 'Existing Vehicles detail tab is preserved');
assert.match(customerDetail, /\['policies', 'shield-checkmark-outline', 'Policies'\]/, 'Existing Policies detail tab is preserved');
assert.match(cases, /status_group==='issued' && row\.final_policy_id/, 'Issued popup remains functional');
assert.match(detail, /inline\("customerName","Client \/ proposer name"/, 'Direct inline Case editing remains available with stack navigation');
assert.doesNotMatch(detail, /visible=\{editing&&!!form\}/, 'Old edit modal must not return');
console.log('Partner Stack bottom navigation coverage passed');
