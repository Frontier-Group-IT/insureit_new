import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const failures = [];
let checks = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function expect(relativePath, pattern, description) {
  checks += 1;
  const text = read(relativePath);
  if (!pattern.test(text)) failures.push(`${relativePath}: ${description}`);
}

function expectAll(relativePath, expectations) {
  for (const [pattern, description] of expectations) expect(relativePath, pattern, description);
}

// Server-scoped Partner data contracts: core books must use Partner RPCs and bounded paging.
expectAll('lib/customers.ts', [
  [/partner_app_customer_summary/, 'customer summary must remain Partner-scoped'],
  [/partner_app_list_customers/, 'customer list must remain Partner-scoped'],
  [/partner_app_customer_detail/, 'customer detail must remain Partner-scoped'],
  [/limit = 25/, 'customer list must keep bounded paging'],
  [/offset = 0/, 'customer list must keep offset paging'],
]);
expectAll('lib/policies.ts', [
  [/partner_app_policy_summary/, 'policy summary must remain Partner-scoped'],
  [/partner_app_list_policies/, 'policy list must remain Partner-scoped'],
  [/partner_app_policy_detail/, 'policy detail must remain Partner-scoped'],
  [/partner_app_renewal_summary/, 'renewal summary must remain Partner-scoped'],
  [/limit = 25/, 'policy list must keep bounded paging'],
]);
expectAll('lib/claims.ts', [
  [/partner_app_claim_summary/, 'claim summary must remain Partner-scoped'],
  [/partner_app_list_claims/, 'claim list must remain Partner-scoped'],
  [/partner_app_claim_detail/, 'claim detail must remain Partner-scoped'],
  [/limit = 25/, 'claim list must keep bounded paging'],
]);

// Support must be recoverable and must not expose an unrestricted staff directory.
expectAll('app/support.tsx', [
  [/getPartnerSupport/, 'Support must load through the Partner support contract'],
  [/PartnerStateView[\s\S]*state="error"/, 'Support must show a recoverable error state'],
  [/actionLabel="Try again"/, 'Support load failure must expose retry'],
  [/relationship_contact/, 'Support may expose only the resolved relationship contact'],
  [/INSUREIT Operations Desk/, 'Support must retain a safe operations fallback'],
]);

// Sign-out must leave protected UI and return to Login.
expectAll('app/(tabs)/more.tsx', [
  [/await signOut\(\)/, 'Sign out must use the session provider'],
  [/router\.replace\('\/login'\)/, 'Successful sign out must replace the stack with Login'],
  [/PartnerConfirmDialog/, 'Sign out must require confirmation'],
  [/busy=\{loggingOut\}/, 'Sign out dialog must prevent duplicate submission'],
]);

// Update/privacy controls must remain available in the current OTA runtime.
expectAll('app/settings.tsx', [
  [/checkForPartnerUpdate/, 'Settings must expose explicit OTA update checking'],
  [/Check for updates/, 'Settings must present a user-facing update action'],
  [/accessibilityLiveRegion="polite"/, 'Update result must be announced accessibly'],
  [/https:\/\/portal\.insureit\.in\/privacy-policy/, 'Settings must retain the Privacy Policy link'],
]);

// Future notification/deep-link destinations are intentionally constrained.
expectAll('lib/partner-destinations.ts', [
  [/PartnerNotificationDestination/, 'notification destinations must use the typed Partner contract'],
  [/activity/, 'Activity must remain an allowed destination'],
  [/renewals/, 'Renewals must remain an allowed destination'],
  [/policy_intake/, 'Policy Intake must remain an allowed destination'],
  [/safeId/, 'dynamic destination IDs must be encoded'],
  [/!clean\.includes\('\.\.'\)/, 'destination validation must block traversal-like routes'],
  [/!clean\.includes\(':\/\/'\)/, 'destination validation must block external URLs'],
]);

// Core UAT navigation journeys must remain wired.
expectAll('app/customers.tsx', [[/\/customer\//, 'Customers must open customer detail']]);
expectAll('app/customer/[id].tsx', [[/\/policy\//, 'Customer detail must open policy detail']]);
expectAll('app/policy/[id].tsx', [[/router\.back\(\)/, 'Policy detail must preserve Back navigation']]);
expectAll('app/policy-intake-new.tsx', [
  [/submitPartnerPolicyIntake/, 'Policy Intake must retain the approved submission path'],
  [/\/policy-intakes\/\[id\]/, 'Policy Intake submission must route to tracked status'],
]);

if (failures.length) {
  console.error('Partner pre-APK UAT/security contract verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(`\n${failures.length} of ${checks} checks failed.`);
  process.exit(1);
}

console.log(`Partner pre-APK UAT/security contracts OK: ${checks} checks passed.`);
console.log('Covered: scoped Customers/Policies/Claims, paging, Support recovery, sign-out, OTA/privacy controls, safe destinations, critical navigation and Policy Intake tracking.');
