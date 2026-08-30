import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const failures = [];
let checks = 0;

function expect(relativePath, pattern, description) {
  checks += 1;
  const text = read(relativePath);
  if (!pattern.test(text)) {
    failures.push(`${relativePath}: ${description}`);
  }
}

function expectAll(relativePath, expectations) {
  for (const [pattern, description] of expectations) {
    expect(relativePath, pattern, description);
  }
}

// App-level render/runtime recovery contract.
expectAll('app/_layout.tsx', [
  [/PartnerErrorBoundary/, 'root layout must import/use PartnerErrorBoundary'],
  [/<PartnerErrorBoundary>[\s\S]*<PartnerSessionProvider>/, 'error boundary must wrap the Partner session/app tree'],
]);

expectAll('components/partner-error-boundary.tsx', [
  [/getDerivedStateFromError/, 'error boundary must enter a recovery state after render errors'],
  [/componentDidCatch/, 'error boundary must capture error details for observability readiness'],
  [/reportPartnerError/, 'error boundary must use the centralized sanitized reporting seam'],
  [/accessibilityRole="alert"/, 'recovery UI must announce itself as an alert'],
  [/accessibilityLiveRegion="assertive"/, 'recovery UI must be announced immediately'],
  [/label="Try again"/, 'recovery UI must expose an in-app retry action'],
  [/label="Return to Home"/, 'recovery UI must expose a safe Home recovery route'],
]);

// Shared form accessibility and focus contract.
expectAll('components/ui/partner-field.tsx', [
  [/forwardRef<TextInput/, 'shared fields must expose native input refs for focus sequencing'],
  [/accessibilityLabel=/, 'shared fields must provide an accessible label'],
  [/accessibilityHint=/, 'shared fields must expose helper/error context'],
  [/accessibilityState=/, 'shared fields must expose disabled state'],
  [/accessibilityLiveRegion="assertive"/, 'field validation errors must be announced'],
  [/accessibilityRole="alert"/, 'field validation errors must use alert semantics'],
]);

expectAll('components/ui/partner-confirm-dialog.tsx', [
  [/accessibilityViewIsModal/, 'confirmation dialogs must use modal accessibility semantics'],
  [/accessibilityRole="alert"/, 'confirmation dialogs must announce their purpose'],
  [/disabled=\{busy\}/, 'dialog dismissal must be blocked while a destructive/confirm action is busy'],
]);

expectAll('app/login.tsx', [
  [/returnKeyType="next"/, 'login email field must expose Next keyboard behavior'],
  [/passwordRef\.current\?\.focus\(\)/, 'login must move focus from email to password'],
  [/returnKeyType="done"/, 'password field must expose Done keyboard behavior'],
  [/accessibilityLiveRegion="assertive"/, 'authentication errors must be announced immediately'],
  [/PartnerField/, 'login must use the shared accessible field primitive'],
  [/PartnerButton/, 'login must use the shared accessible button primitive'],
]);

// Distinct loading/error/offline/unauthorized state contract.
expectAll('components/ui/partner-state-view.tsx', [
  [/['"]loading['"]/, 'shared state view must support loading'],
  [/['"]error['"]/, 'shared state view must support error'],
  [/['"]offline['"]/, 'shared state view must support offline'],
  [/['"]unauthorized['"]/, 'shared state view must support unauthorized'],
  [/accessibilityLiveRegion="polite"/, 'state changes must be announced to assistive technology'],
]);

// Policy Intake interruption/retry contract.
expectAll('app/policy-intake-new.tsx', [
  [/loadPartnerPolicyIntakeDraft/, 'Policy Intake must restore persisted draft metadata'],
  [/savePartnerPolicyIntakeDraft/, 'Policy Intake must persist draft metadata'],
  [/clearPartnerPolicyIntakeDraft/, 'Policy Intake must clear draft only after successful submission'],
  [/accessibilityLiveRegion="polite"/, 'upload progress must be announced'],
  [/accessibilityRole="progressbar"/, 'upload progress must expose progressbar semantics'],
  [/accessibilityValue=\{\{ min: 0, max: 100, now:/, 'upload progress must expose a numeric accessibility value'],
  [/Retry submission/, 'failed submissions must expose retry behavior'],
  [/Your selected policy copy and entered details are still here/, 'failed submissions must preserve entered state'],
]);

expectAll('app/policy-intakes/[id].tsx', [
  [/actionLabel="Try again"/, 'Policy Intake detail load errors must expose retry'],
  [/accessibilityLiveRegion="polite"/, 'replacement upload progress must be announced'],
  [/accessibilityRole="progressbar"/, 'Policy Intake status/replacement progress must expose progressbar semantics'],
  [/Step \${activeStep} of 4/, 'Policy Intake stage progress must expose a text step description'],
  [/submitPartnerPolicyIntakeReplacement/, 'attention-required flow must support replacement submission'],
]);

// Frozen smoke journey route contracts.
expectAll('app/customers.tsx', [
  [/router\.push\([\s\S]*\/customer\//, 'Customers list must open customer detail'],
]);
expectAll('app/customer/[id].tsx', [
  [/router\.push\(\`\/policy\//, 'Customer detail must open policy detail'],
  [/router\.back\(\)/, 'Customer detail must support Back'],
]);
expectAll('app/policy/[id].tsx', [
  [/router\.back\(\)/, 'Policy detail must support Back'],
]);
expectAll('app/policy-intake-new.tsx', [
  [/router\.replace\(\{ pathname: '\/policy-intakes\/\[id\]'/, 'new Policy Intake must route to tracked status after submit'],
]);
expectAll('app/policy-intakes/[id].tsx', [
  [/POLICY INTAKE/, 'Policy Intake tracking route must remain available'],
]);

if (failures.length) {
  console.error('Partner Phase 5 resilience/accessibility contract verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(`\n${failures.length} of ${checks} checks failed.`);
  process.exit(1);
}

console.log(`Partner Phase 5 resilience/accessibility contracts OK: ${checks} checks passed.`);
console.log('Smoke contracts covered: Login -> Customers -> Customer detail -> Policy -> Back; Login -> New Policy Intake -> Submit -> Track status.');


// Final Phase 5 hardening contracts.
expectAll('lib/partner-observability.ts', [
  [/SENSITIVE_KEY/, 'observability seam must redact known sensitive metadata keys'],
  [/\[REDACTED\]/, 'observability seam must replace sensitive values'],
  [/reportPartnerError/, 'observability seam must expose a single reporting integration point'],
]);

expectAll('app/policy-intake-new.tsx', [
  [/PartnerConfirmDialog/, 'Policy Intake must protect transient selected-file state on close'],
  [/selected policy file will need to be chosen again/, 'close warning must explain exactly what would be lost'],
  [/disabled=\{submitting\}/, 'Policy Intake close action must be disabled during submission'],
]);

expectAll('components/ui/partner-filter-chip.tsx', [
  [/minHeight: partnerTheme\.control\.minTouchTarget/, 'filter chips must meet the shared minimum touch target'],
  [/accessibilityState=\{\{ selected: active \}\}/, 'filter chips must announce selected state'],
  [/accessibilityLabel=\{\`\$\{label\} filter\`\}/, 'filter chips must expose a clear accessible label'],
]);

expectAll('lib/partner-query-cache.ts', [
  [/fallbackError/, 'cached fallback must preserve refresh failure details'],
  [/isLikelyConnectivityError/, 'cached fallback must distinguish likely offline/network failure'],
  [/clearPartnerQueryCache/, 'protected cache must expose identity/sign-out clearing'],
]);

expectAll('providers/partner-session-provider.tsx', [
  [/AppState\.addEventListener\('change'/, 'session lifecycle must react to foreground/background changes'],
  [/startAutoRefresh/, 'foreground session lifecycle must resume auth refresh'],
  [/stopAutoRefresh/, 'background session lifecycle must pause auth refresh'],
  [/clearPartnerQueryCache/, 'identity/sign-out transitions must clear protected query cache'],
]);

expectAll('app.json', [
  [/"runtimeVersion"\s*:\s*\{\s*"policy"\s*:\s*"appVersion"/s, 'OTA runtime must remain pinned to app version compatibility'],
  [/"checkAutomatically"\s*:\s*"ON_LOAD"/, 'preview binary must continue checking OTA updates on launch'],
]);
