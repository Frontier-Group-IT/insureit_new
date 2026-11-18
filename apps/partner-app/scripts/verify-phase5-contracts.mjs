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
  if (!pattern.test(text)) failures.push(`${relativePath}: ${description}`);
}

function expectAll(relativePath, expectations) {
  for (const [pattern, description] of expectations) expect(relativePath, pattern, description);
}

// App-level render/runtime recovery contract.
expectAll('app/_layout.tsx', [
  [/PartnerErrorBoundary/, 'root layout must import/use PartnerErrorBoundary'],
  [/<PartnerErrorBoundary>[\s\S]*<PartnerSessionProvider>/, 'error boundary must wrap the Partner session/app tree'],
]);

expectAll('app/_layout.tsx', [
  [/PartnerSearchProvider/, 'root layout must provide shared Partner search state'],
]);

expectAll('providers/partner-search-provider.tsx', [
  [/const \[query, setQuery\] = useState\(''\)/, 'shared Partner search provider must own the universal query'],
  [/clearQuery: \(\) => setQuery\(''\)/, 'shared Partner search provider must expose query clearing'],
]);

expectAll('components/partner-screen.tsx', [
  [/usePartnerSearch\(\)/, 'Home hero search must consume shared Partner search state'],
  [/router\.push\(\`\/search\?q=\$\{encodeURIComponent\(query\)\}\`/, 'Home search submit must route the typed query to Universal Search'],
  [/hasHeroSearchValue \? '#1765C1' : '#A3ABBA'/, 'Home Search chevron must turn blue when text is entered'],
  [/homeSearchActionTextActive/, 'Home Search label must expose an active blue state when text is entered'],
]);

expectAll('app/search.tsx', [
  [/usePartnerSearch\(\)/, 'Universal Search must consume the same shared query as Home'],
  [/onClear: clearQuery/, 'clearing Universal Search must clear the shared Home query too'],
  [/appliedIncomingQueryRef/, 'route query handoff must not overwrite later user edits or clearing'],
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
  [/Animated\.timing\(entrance/, 'login must have a smooth entrance'],
  [/Animated\.loop/, 'decorative background motion must be bounded'],
  [/Welcome back/, 'login must retain the reference welcome heading'],
  [/router\.push\('\/forgot-password'\)/, 'login must retain password recovery'],
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
  [/Your selected document and entered details are still here/, 'failed submissions must preserve entered state'],
]);

expectAll('app/policy-intakes/[id].tsx', [
  [/actionLabel="Try again"/, 'Policy Intake detail load errors must expose retry'],
  [/accessibilityLiveRegion="polite"/, 'replacement upload progress must be announced'],
  [/accessibilityRole="progressbar"/, 'replacement upload progress must expose progressbar semantics'],
  [/accessibilityLabel=\{\`\$\{replacementLabel\(progress\)\}, \$\{Math\.round\(percent\)\} percent\`\}/, 'replacement upload progress retains an accessible text description'],
  [/statusBadgeTextStyle\(row\)/, 'Policy Intake review state remains visibly labeled'],
  [/submitPartnerPolicyIntakeReplacement/, 'attention-required flow must support replacement submission'],
]);

// Frozen smoke journey route contracts.
expectAll('app/customers.tsx', [
  [/router\.push\([\s\S]*\/customer\//, 'Customers list must open customer detail'],
  [/statusFilter === 'all'/, 'Customers KPI strip must expose the All filter state'],
  [/statusFilter === 'active'/, 'Customers KPI strip must expose the Active filter state'],
  [/statusFilter === 'inactive'/, 'Customers KPI strip must expose the Inactive filter state'],
  [/accessibilityState=\{\{ selected: active \}\}/, 'Customers KPI filters must expose their selected state'],
  [/icon="people-outline"/, 'Customers KPI must use a clear people icon'],
  [/icon="checkmark-circle-outline"/, 'Active KPI must use a clear success icon'],
  [/icon="remove-circle-outline"/, 'Inactive KPI must use a clear inactive icon'],
]);
expect('app/customers.tsx', /^(?![\s\S]*name="location-outline")[\s\S]*$/, 'Customer list records must not render a location icon');
expect('app/customers.tsx', /^(?![\s\S]*styles\.locationRow)[\s\S]*$/, 'Customer list records must not render the location row');
expectAll('lib/customers.ts', [
  [/partner_app_list_customers_v2/, 'Customers list must use the scoped status-filter RPC'],
  [/p_status: status === 'all' \? null : status/, 'Customers list must pass the selected status filter'],
]);
expectAll('app/customer/[id].tsx', [
  [/router\.push\(\`\/policy\//, 'Customer detail must open policy detail'],
  [/router\.back\(\)/, 'Customer detail must support Back'],
]);
expectAll('app/policy/[id].tsx', [[/router\.back\(\)/, 'Policy detail must support Back']]);
expectAll('app/policy-intake-new.tsx', [[/router\.replace\(\{ pathname: '\/policy-intakes\/\[id\]'/, 'new Policy Intake must route to tracked status after submit']]);
expectAll('app/policy-intakes/[id].tsx', [[/title="Policy Intake"/, 'Policy Intake tracking route must remain available']]);

// Partner Home MTD comparison contract.
expectAll('app/(tabs)/index.tsx', [
  [/previousMonthMtdDateRange\(\)/, 'Partner Home MTD must derive a same-date previous-month comparison range'],
  [/getPartnerBusinessRange\(previousMonthMtdRange\.from, previousMonthMtdRange\.to\)/, 'Partner Home MTD must load the previous-month MTD through the scoped business-range service'],
  [/percentageChange\(Number\(rangeData\?\.net_premium \?\? 0\), Number\(previousMonthMtd\.data\?\.net_premium \?\? 0\)\)/, 'Partner Home MTD comparison must use net premium for both current and previous-month MTD'],
  [/comparisonLabel="previous month"/, 'Partner Home MTD trend copy must explicitly say previous month'],
]);

// Partner claim tracker presentation contract (nine-stage reference design).
expectAll('app/claim/[id].tsx', [
  [/getPartnerManufacturerLogoSource\(data\.vehicle\.make\)/, 'claim hero must retain the linked manufacturer logo'],
  [/useState\(false\)/, 'claim details must be collapsed by default'],
  [/setDetailsOpen\(v => !v\)/, 'claim details must expand and collapse'],
  [/setJourneyOpen\(v => !v\)/, 'claim journey must expand and collapse'],
  [/setDocumentsOpen\(v => !v\)/, 'claim documents must expand and collapse'],
  [/CLAIM_STAGES\.map/, 'claim journey must display the canonical nine stages'],
  [/pathname: '\/claim\/stage'/, 'stage rows must open the partner-scoped stage detail route'],
  [/data\.claim\.current_status/, 'claim details must retain current workflow status'],
  [/data\.customer\.name/, 'claim details must retain customer identity'],
]);
expectAll('app/claim/stage.tsx', [
  [/getPartnerClaimDetail\(id\)/, 'stage details must use the authorized partner claim-detail service'],
  [/getStageHistory\(data, stage\.key/, 'stage detail must show relevant recorded history'],
  [/CLAIM_STAGES\.find/, 'stage detail must resolve the requested stage key'],
]);
expectAll('lib/claim-tracker.ts', [
  [/spot_intimation/, 'claim tracker must include spot intimation'],
  [/payment_encashment/, 'claim tracker must include payment encashment'],
  [/getClaimTrackerState/, 'claim tracker must project the workflow status'],
]);
expectAll('lib/claims.ts', [
  [/partner_app_customer_detail/, 'claim detail must enrich vehicle make through the existing scoped customer-detail RPC'],
  [/matchedVehicle[\s\S]*make:/, 'claim detail must carry the matched manufacturer into the vehicle payload'],
]);

// Final Phase 5 hardening contracts.
expectAll('lib/partner-observability.ts', [
  [/SENSITIVE_KEY/, 'observability seam must redact known sensitive metadata keys'],
  [/\[REDACTED\]/, 'observability seam must replace sensitive values'],
  [/reportPartnerError/, 'observability seam must expose a single reporting integration point'],
]);

expectAll('app/policy-intake-new.tsx', [
  [/PartnerConfirmDialog/, 'Policy Intake must protect transient selected-file state on close'],
  [/selected document will need to be chosen again/, 'close warning must explain exactly what would be lost'],
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

// All passive Partner success alerts close in 1 second without an OK button.
// Interactive navigations/confirmations and errors must keep their own actions.
expectAll('components/ui/partner-alert-provider.tsx', [
  [/function isPassiveSuccessNotice\(notice: Notice\)/, 'shared provider classifies passive success separately from confirmations'],
  [/noticeKind\(notice\) !== 'success'/, 'errors and warnings never auto-dismiss as successes'],
  [/notice\.buttons\.length === 1[\s\S]*!notice\.buttons\[0\]\.onPress/, 'only non-actionable single OK alerts may auto-dismiss'],
  [/setTimeout\(\(\) => \{[\s\S]*\}, 1000\)/, 'passive success auto-dismiss timeout remains 1000ms'],
  [/return \(\) => clearTimeout\(timeout\)/, 'old success timer cancels when the notice changes'],
  [/actions=\{autoDismissSuccess \? \[\] : choices\}/, 'passive success suppresses all action buttons'],
  [/notice\.options\?\.onDismiss\?\.\(\)/, 'onDismiss callback is preserved'],
  [/updated\|submitted\|sent\|added\|verified\|issued\|deleted\|removed/, 'common app-wide completion labels are recognized as success'],
]);
expectAll('components/ui/partner-confirm-dialog.tsx', [
  [/displayedActions\.length > 0 \?/, 'no empty divider or footer is shown for actionless success'],
  [/displayedActions\.map/, 'confirmation buttons remain available where required'],
]);

// Customer Details mobile reference: scoped vehicle data, collapsed detail cards and contact/status layout.
expectAll('app/customer/[id].tsx', [
  [/hideTopBar fullWidth navyStatusBar/, 'Customer Details uses the navy status bar with white system icons'],
  [/expandedVehicleIds.*new Set/, 'Vehicle cards initialize collapsed'],
  [/accessibilityState=\{\{ expanded \}\}/, 'Vehicle cards expose accessible expand/collapse state'],
  [/toggleVehicle\(vehicle\.vehicle_id\)/, 'Each vehicle toggles individually'],
  [/IDENTITY AND REGISTRATION/, 'Vehicle reference identity fields are grouped'],
  [/COMPLIANCE AND PERMITS/, 'Vehicle reference permit fields are grouped'],
  [/formatVehicleDate\(vehicle\.registration_date\)/, 'Registration date has Indian formatting'],
  [/vehicle\.gvw_kg/, 'GVW is shown in kg'],
  [/vehicle\.chassis_no/, 'Chassis number is displayed'],
  [/vehicle\.engine_no/, 'Engine number is displayed'],
  [/vehicle\.permit_no/, 'Permit number is displayed'],
]);
expectAll('components/ui/partner-contact-actions.tsx', [
  [/customerDetailRow:.*width: '100%'.*justifyContent: 'space-between'.*flexWrap: 'nowrap'/, 'Customer contact buttons span the name-aligned content width without changing the customer header layout'],
  [/customerDetailAction:.*flex: 0.*flexShrink: 0.*borderWidth: 0.*backgroundColor: 'transparent'/, 'Customer contact actions stay compact with transparent background and no border'],
]);
expectAll('lib/customers.ts', [
  [/gvw_kg: number \| string \| null/, 'Vehicle data type includes GVW'],
  [/registration_date: string \| null/, 'Vehicle data type includes registration date'],
  [/chassis_no: string \| null/, 'Vehicle data type includes chassis number'],
  [/engine_no: string \| null/, 'Vehicle data type includes engine number'],
  [/permit_no: string \| null/, 'Vehicle data type includes permit number'],
]);
expectAll('../../supabase/migrations/20261117181500_partner_customer_vehicle_reference_details.sql', [
  [/partner_app_customer_in_scope\(p_customer_id\)/, 'Existing Partner customer scope guard remains'],
  [/partner_app_policy_in_scope\(p\.id\)/, 'Policy visibility stays scoped'],
  [/partner_app_claim_in_scope\(cl\.id\)/, 'Claim visibility stays scoped'],
  [/'gvw_kg',gvw_kg/, 'Scoped RPC returns GVW'],
  [/'registration_date',registration_date/, 'Scoped RPC returns registration date'],
  [/'chassis_no',chassis_no/, 'Scoped RPC returns chassis'],
  [/'engine_no',engine_no/, 'Scoped RPC returns engine'],
  [/'permit_no',permit_no/, 'Scoped RPC returns permit'],
]);

// Customer Details names must stay on one line with the verification icon visible.
expectAll('app/customer/[id].tsx', [
  [/numberOfLines=\{1\} ellipsizeMode="tail"\>\{data\.customer\.customer_name\}/, 'long customer names truncate with trailing ellipsis'],
  [/profileNameWrap: \{ flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 5, minWidth: 0 \}/, 'customer name and verification icon never wrap'],
  [/profileName: \{[^\n]*flexShrink: 1, minWidth: 0/, 'only the name shrinks inside its row'],
  [/name="checkmark-circle" size=\{19\} color="#0CB76B"/, 'existing verified customer icon remains visible'],
  [/<PartnerContactActions phone=\{data\.customer\.phone\} email=\{data\.customer\.email\} inlineLabeled customerDetailLayout/, 'contact actions remain in place'],
]);

// Renewal Work Queue: flat edge-to-edge summary directly beneath the header.
checks += 1;
if (read('app/renewals.tsx').includes('accessibilityLabel="Go to Home"')) failures.push('Renewal Work Queue must not retain a redundant header Home action');
expectAll('app/renewals.tsx', [
  [/summaryPanel: \{ marginTop: 0, marginHorizontal: -partnerTheme\.spacing\.lg, backgroundColor: '#FFFFFF' \}/, 'renewal summary has no card border, radius or inset margin'],
  [/referenceHeader: \{ minHeight: 64, marginHorizontal: -partnerTheme\.spacing\.lg, marginBottom: 0/, 'summary attaches to the navy header without a gap'],
  [/summaryDivider: \{ height: StyleSheet\.hairlineWidth/, 'a thin divider separates summary and tabs'],
  [/<Text style=\{styles\.summaryCount\} numberOfLines=\{1\}>POLICIES \{selectedSummary\.count\}<\/Text>/, 'count is plain text in POLICIES N order without a badge'],
  [/summaryCount: \{ color: '#172A48', fontSize: 11/, 'policy count is styled as plain text'],
  [/PartnerAssets\.actions\.renewalsReference/, 'header uses the bundled renewal artwork without a redundant Home shortcut'],
  [/PartnerAssets\.status\.renewalDue/, 'summary displays the bundled 3D renewal icon'],
  [/bottomNavigation=\{<PartnerCaseBottomNavigation activeTab="Policies" \/>\}/, 'existing bottom Home navigation remains available'],
  [/selectedSummary\.premium/, 'existing renewal premium calculation remains'],
  [/onPress=\{\(\) => selectBucket\(mode === 'expired' \? 'overdue' : 'all'\)\}/, 'summary remains interactive with its existing filtering'],
]);
// New Customer compact-layout and GST state contract.
expectAll('app/customer-new.tsx', [
  [/New Customer<\/Text><\/View><\/View>/, 'New Customer header has no secondary subtitle'],
  [/<View style=\{styles\.two\}>[\s\S]*?Mobile Number \*[\s\S]*?Email ID[\s\S]*?<\/View>/, 'mobile and email share a two-column row'],
  [/<View style=\{styles\.two\}>[\s\S]*?Street[\s\S]*?Locality[\s\S]*?<\/View>/, 'street and locality share a row'],
  [/trackColor=\{\{ false: '#A3B0C4', true: '#2563EB' \}\}/, 'GST toggle has visible off and on colors'],
  [/form\.gst_registered \? field\('GST Number \*'/, 'GSTIN field is visible only for GST-registered customers'],
  [/DOCUMENTS\.filter\(doc => doc\.key !== 'gst_copy' \|\| form\.gst_registered\)/, 'GST Copy is conditional in Documents'],
  [/setDocuments\(previous => \{ const \{ gst_copy: _discarded, \.\.\.rest \} = previous; return rest; \}\)/, 'GST Copy clears if GST is toggled off'],
  [/Invalid GSTIN/, 'GSTIN is validated before saving'],
  [/label\.endsWith\(' \*'\)/, 'Only mandatory field labels receive a separate star'],
  [/requiredStar: \{ color: '#D92D20'/, 'Mandatory field asterisk uses visible red colour'],
]);
expectAll('lib/customers.ts', [
  [/gst_number: string/, 'customer creation form includes GSTIN'],
  [/type: 'pan_copy' \| 'aadhaar_front' \| 'aadhaar_back' \| 'gst_copy'/, 'document type supports GST Copy'],
  [/gst_number: input\.gst_registered \? input\.gst_number\.trim\(\)\.toUpperCase\(\) : null/, 'GSTIN is passed to the authorized creation RPC'],
  [/if \(documents\.length\) throw new Error\('KYC uploads are not configured yet/, 'documents fail closed until an authorized upload backend is available'],
]);

// Evaluate every contract only after all checks have run.
if (failures.length) {
  console.error('Partner Phase 5 resilience/accessibility contract verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(`\n${failures.length} of ${checks} checks failed.`);
  process.exit(1);
}

console.log(`Partner Phase 5 resilience/accessibility contracts OK: ${checks} checks passed.`);
console.log('Smoke contracts covered: Login -> Customers -> Customer detail -> Policy -> Back; Login -> New Policy Intake -> Submit -> Track status.');
