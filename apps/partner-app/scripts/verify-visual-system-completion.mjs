import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function requireText(source, needle, message) {
  if (!source.includes(needle)) throw new Error(message);
}

const assets = read('lib/partner-assets.ts');
const artworkMap = read('lib/partner-screen-artwork.ts');
const topBar = read('components/ui/partner-top-bar.tsx');
const stateView = read('components/ui/partner-state-view.tsx');
const screen = read('components/partner-screen.tsx');
const listScreen = read('components/partner-list-screen.tsx');
const home = read('app/(tabs)/index.tsx');
const more = read('app/(tabs)/more.tsx');
const profileMenuIcon = read('components/ui/partner-profile-menu-icon.tsx');
const businessGrowthIcon = read('components/ui/partner-business-growth-icon.tsx');
const businessOverviewIcons = read('components/ui/partner-business-overview-icons.tsx');
const homeMetricIcons = read('components/ui/partner-home-metric-icons.tsx');
const business = read('app/(tabs)/business.tsx');
const businessReport = read('app/business-report.tsx');
const customers = read('app/customers.tsx');
requireText(businessReport, 'hideTopBar', 'Business Report must hide its default light header.');
requireText(businessReport, 'navyStatusBar', 'Business Report must render the navy status area.');
requireText(businessReport, '<PartnerCasePageHeader title="Business Report" icon="business-outline" onBack={() => router.back()} />', 'Business Report must reuse the navy header with a white building icon and Back action.');
requireText(businessReport, 'getPartnerBusinessReportNet()', 'Business Report data source must remain unchanged.');
requireText(businessReport, 'bottomNavigation={<PartnerStackBottomNavigation activeTab="business" />}', 'Business Report must retain its existing bottom navigation.');

const policies = read('app/(tabs)/policies.tsx');
const claims = read('app/(tabs)/claims.tsx');
const renewals = read('app/renewals.tsx');
const policyIntakes = read('app/policy-intakes.tsx');
const policyIntakeNew = read('app/policy-intake-new.tsx');
const policyIntakeDetail = read('app/policy-intakes/[id].tsx');
const insurerPerformance = read('app/insurers.tsx');
requireText(insurerPerformance, 'source={PartnerAssets.status.businessGrowth}', 'Insurer performance header uses transparent 3D growth artwork.');
requireText(insurerPerformance, 'bottomNavigationNavy navyStatusBar', 'Insurer performance has a navy status area with white system icons.');
requireText(insurerPerformance, "referenceHeader: { marginHorizontal: -16, height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', backgroundColor: '#071E49' }", 'Insurer performance header must use the standard navy.');
requireText(insurerPerformance, "headerSearchBand: { backgroundColor: '#071E49'", 'Insurer search band matches the navy header.');
requireText(insurerPerformance, '>BUSINESS PERFORMANCE</Text>', 'Existing Business Performance eyebrow remains visible.');
requireText(insurerPerformance, 'bottomNavigation={<PartnerStackBottomNavigation activeTab="business" />}', 'Existing Business-active footer must be preserved.');

const policyOnboarding = read('app/policy-intakes/onboarding.tsx');
// Standalone Add Policy labels match the website, but existing Intake actions stay unchanged.
requireText(policyOnboarding, "accessibilityLabel={isNew?'Create Case':'Create Policy'}", 'Life/Health Add Policy button must announce Create Case.');
requireText(policyOnboarding, "creatingLifeHealth?'Creating case…':isNew?'Create Case':'Create Policy'", 'Life/Health Add Policy must show Create Case without changing Intake copy.');
requireText(policyOnboarding, "accessibilityLabel={isNew?(isMotor?'Upload Policy':'Create Policy'):'Create Active Policy'}", 'Standalone Motor button must announce Upload Policy and Non-Motor Create Policy.');
requireText(policyOnboarding, "isNew?(isMotor?'Upload Policy':'Create Policy'):'Create Active Policy'", 'Product-aware action labels must retain Intake fallback.');
requireText(policyOnboarding, "onPress={()=>void createLifeHealth()}", 'Case creation handler must remain unchanged.');
requireText(policyOnboarding, "onPress={()=>void createActivePolicy()}", 'Motor and Non-Motor booking handlers must remain unchanged.');
const customerDetail = read('app/customer/[id].tsx');
const policyDetail = read('app/policy/[id].tsx');
// Scope system and header navy to Claim Tracker and its nine stage views.
requireText(read('app/claim/[id].tsx'), "backgroundColor: '#07347E'", 'Claim Tracker must use Claim Tracker navy for navigation.');
requireText(read('app/claim/[id].tsx'), '<StatusBar style="light" backgroundColor="#07347E" />', 'Claim Tracker must use light status-bar icons.');
requireText(read('app/claim/[id].tsx'), "backgroundColor:'#EDF6FE'", 'Claim Tracker must preserve the light content background.');
requireText(read('app/claim/stage.tsx'), "header:{height:72,backgroundColor:'#07347E'", 'Read-only claim stage must use Claim Tracker navy for navigation.');
requireText(read('app/claim/stage.tsx'), '<StatusBar style="light" backgroundColor="#07347E" />', 'Read-only claim stage must use light status-bar icons.');
requireText(read('app/claim/stage.tsx'), "backgroundColor:'#EDF6FE'", 'Read-only claim stage must preserve the light content background.');
requireText(read('components/partner-spot-intimation.tsx'), "header:{height:50,backgroundColor:'#07347E'", 'Spot Intimation must use Claim Tracker navy for navigation.');
requireText(read('components/partner-spot-intimation.tsx'), '<StatusBar style="light" backgroundColor="#07347E" />', 'Spot Intimation must use light status-bar icons.');
requireText(read('components/partner-spot-intimation.tsx'), "backgroundColor:'#EDF6FE'", 'Spot Intimation must preserve the light content background.');
requireText(read('components/partner-claim-stage-editor.tsx'), "header:{height:50,backgroundColor:'#07347E'", 'Eight editable stages must use Claim Tracker navy for navigation.');
requireText(read('components/partner-claim-stage-editor.tsx'), '<StatusBar style="light" backgroundColor="#07347E" />', 'Eight editable stages must use light status-bar icons.');
requireText(read('components/partner-claim-stage-editor.tsx'), "backgroundColor:'#EDF6FE'", 'Eight editable stages must preserve the light content background.');

const claimTracker = read('app/claim/[id].tsx');
const claimStageReadOnly = read('app/claim/stage.tsx');
const spotIntimation = read('components/partner-spot-intimation.tsx');
const claimStageEditor = read('components/partner-claim-stage-editor.tsx');
for (const [source, fragment, label] of [
  [claimTracker, "hero:{backgroundColor:'#07347E'", 'Claim Tracker'],
  [claimStageReadOnly, "status:{backgroundColor:'#07347E'", 'read-only claim stage'],
  [spotIntimation, "hero:{position:'relative',overflow:'hidden',backgroundColor:'#07347E'", 'Spot Intimation'],
  [claimStageEditor, "hero:{backgroundColor:'#07347E'", 'editable claim stages'],
]) {
  requireText(source, fragment, `${label} status card must match the Claim Tracker navy #07347E.`);
}

// Policy Overview, Premium and Commercial remain a single white card.
// Customer and vehicle identity now share one compact row and separate heading.
requireText(policyDetail, '<CardHeader title="Customer & Vehicle Details" />', 'Combined customer and vehicle heading is present');
requireText(policyDetail, '<CardHeader title="Customer & Vehicle Details" /></View>\\n            <Card highlighted>'.replace('\\n','\n'), 'Only the Customer & Vehicle section requests the blue border');
requireText(policyDetail, "customerVehicleBorder: { borderColor: '#3993F5', borderWidth: 1 }", 'Customer & Vehicle card has a visible 1px blue border');
requireText(policyDetail, 'highlighted && styles.customerVehicleBorder', 'Blue border is applied only when highlighted is set');
if ((policyDetail.match(/<Card highlighted>/g) || []).length !== 1) throw new Error('Only Customer & Vehicle Details may have a highlighted card border');

for(const heading of ['<CardHeader title="Customer Details" />', "'Vehicle Details' : 'Insured Risk Details'"]) {
  if(policyDetail.includes(heading))throw new Error('Separate customer/vehicle headings must not return');
}
requireText(policyDetail, 'manufacturerLogo || PartnerAssets.products.motorInsurance', 'Manufacturer logo retains a safe motor fallback');
requireText(policyDetail, 'styles.customerVehicleTitleRow', 'Customer and registration share the first line');
requireText(policyDetail, 'data.customer.name || "Customer"', 'Customer name comes from the authorized policy detail');
requireText(policyDetail, 'data.vehicle.vehicle_no', 'Registration comes from the same vehicle record');
requireText(policyDetail, 'displayParts(data.vehicle.make, data.vehicle.model, data.vehicle.year)', 'Vehicle make, model and year share a second line');
requireText(policyDetail, 'router.push(`/customer/${data.customer.id}` as never)', 'Customer detail navigation survives the combined row');
requireText(policyDetail, 'PartnerAssets.products.commercialInsurance', 'Policies without vehicles retain a risk icon fallback');
const quickActionsStart = policyDetail.indexOf('<Text style={styles.quickSectionHeading}>Quick Actions</Text>');
const customerStart = policyDetail.indexOf('<CardHeader title="Customer & Vehicle Details"');
const overviewStart = policyDetail.indexOf('<CardHeader iconKind="policy-overview" title="Policy Overview"');
if (!(quickActionsStart >= 0 && customerStart > quickActionsStart && overviewStart > customerStart)) {
  throw new Error('Expected Quick Actions → Customer & Vehicle Details → Policy Overview');
}
const unified = policyDetail.slice(overviewStart, policyDetail.indexOf('</Card>', overviewStart) + '</Card>'.length);
requireText(unified, 'styles.overviewGrid', 'Existing overview fields remain visible');
requireText(unified, 'styles.premiumDisclosure', 'Premium remains inside the combined overview');
requireText(unified, 'styles.commercialRow', 'Commercial remains inside the combined overview');
if(unified.split('styles.unifiedSectionDivider').length !== 3)throw new Error('Expected two internal separators');
if(unified.split('</Card>').length !== 2)throw new Error('Overview, Premium and Commercial must share one card');
requireText(policyDetail, 'accessibilityState={{ expanded: showPremiumDetails }}', 'Premium expansion remains');
requireText(policyDetail, 'accessibilityState={{ expanded: showCommercialDetails }}', 'Commercial expansion remains');
requireText(policyDetail, 'const [showPremiumDetails, setShowPremiumDetails] = useState(true);', 'Premium breakup opens expanded by default');
requireText(policyDetail, 'const [showCommercialDetails, setShowCommercialDetails] = useState(true);', 'Sales ownership opens expanded by default');
requireText(policyDetail, 'onPress={() => setShowPremiumDetails((value) => !value)}', 'Premium breakup is still collapsible');
requireText(policyDetail, 'onPress={() => setShowCommercialDetails((value) => !value)}', 'Sales ownership is still collapsible');
requireText(policyDetail, 'quickSectionHeading: { marginLeft: -6, marginRight: 3, marginBottom: 5', 'Quick Actions heading moves slightly left without moving action icons');
requireText(policyDetail, 'externalSectionHeading: { marginLeft: -6, paddingLeft: 0, paddingRight: 2 }', 'Customer & Vehicle heading moves slightly left without moving its card');
requireText(policyDetail, 'contentWrap: { marginTop: 0, gap: 6, paddingBottom: 15 }', 'Inter-section vertical gap is compact');
requireText(policyDetail, 'paddingHorizontal: 14, paddingTop: 10, paddingBottom: 9', 'Policy summary vertical padding is compact');
requireText(policyDetail, 'quickSection: { marginHorizontal: 12, paddingVertical: 4 }', 'Quick Actions section vertical padding is compact');
requireText(policyDetail, 'quickSectionHeading: { marginLeft: -6, marginRight: 3, marginBottom: 5', 'Quick Actions heading keeps the left alignment and reduces the gap below');
requireText(policyDetail, "minHeight: 68, alignItems: 'center', justifyContent: 'center'", 'Quick Action rows use compact 68px minimum with intact tap surface');
requireText(policyDetail, 'cardHeaderCompact: { minHeight: 30 }', 'Customer & Vehicle heading becomes 30px tall');
requireText(policyDetail, '!iconKind && !actionLabel ? styles.cardHeaderCompact : null', 'Only plain section headings compact; Policy Overview header retains its original layout');


const policyDetailIcon = read('components/ui/partner-policy-detail-icon.tsx');
const claimDetail = read('app/claim/[id].tsx');
const search = read('app/search.tsx');
const support = read('app/support.tsx');
const settings = read('app/settings.tsx');
const profile = read('app/profile.tsx');
const accountShellHeader = read('components/partner-case-page-header.tsx');
requireText(accountShellHeader, "backgroundColor: '#0A234A'", 'Account header must match the Policy Details title strip.');
requireText(accountShellHeader, 'accessibilityRole="header"', 'Account page title must be accessible.');
const deletionScreen = read('app/account-deletion.tsx');
for (const [screen, label] of [[settings, 'Settings'], [profile, 'Profile'], [support, 'Support'], [deletionScreen, 'Account deletion']]) {
  requireText(screen, 'hideTopBar navyStatusBar bottomNavigationNavy', `${label} must opt into the Policy Details navy shell.`);
  requireText(screen, '<PartnerCaseBottomNavigation activeTab="More" />', `${label} must retain permission-aware five-tab navigation with More selected.`);
  requireText(screen, '<PartnerCasePageHeader', `${label} must use the Policy Details-style title strip.`);
}

const activity = read('app/activity.tsx');
const impact = read('app/impact.tsx');
const journey = read('app/journey.tsx');
const weeklyStory = read('app/weekly-story.tsx');
const recognition = read('app/recognition.tsx');
const learn = read('app/learn.tsx');
for (const [screen, title, icon] of [
  [weeklyStory, 'A week with INSUREIT', 'bar-chart-outline'],
  [learn, '60-Second Learn', 'school-outline'],
  [recognition, 'Progress worth noticing', 'ribbon-outline'],
]) {
  requireText(screen, 'hideTopBar navyStatusBar bottomNavigationNavy', `${title} must use navy header and Android status bar like Profile.`);
  requireText(screen, '<PartnerCaseBottomNavigation activeTab="More" />', `${title} must show the permission-aware five-tab bottom navigation.`);
  requireText(screen, `<PartnerCasePageHeader title="${title}" icon="${icon}" onBack={() => router.back()} />`, `${title} must show a white title and back action on navy.`);
}

const pulse = read('app/pulse.tsx');

for (const asset of ['policyChecklist', 'appsGrid', 'settings', 'supportVerified']) {
  requireText(assets, `${asset}: require(`, `Partner asset registry must expose ${asset}.`);
}

// Redesigned Home shows multiple live task rows while preserving the original
// branded claim clipboard/shield artwork and retaining count/title association.
requireText(home, "icon: PartnerAssets.actions.quickClaims", 'Home Pending Tasks must preserve the original claim clipboard/shield asset.');
requireText(home, "label: 'Active claims'", 'Home Pending Tasks must retain a live active-claims task.');
requireText(home, "count: data.service.active_claims", 'Home Pending Tasks must use the authorized live claim count.');
requireText(home, "source={task.icon}", 'Home Pending Tasks must render their existing branded image assets.');
requireText(home, "{task.count}", 'Home Pending Tasks must keep a live count beside each task.');
if (home.includes('pendingRowCount')) throw new Error('Home Pending Tasks must not add an unscoped separate red count treatment.');

for (const feature of [
  'policy intake', 'renewal', 'claim', 'customer', 'policies', 'search', 'support', 'settings', 'profile',
  'recognition', 'journey', 'impact', 'your week', 'learn', 'stories', 'activity', 'business', 'more',
]) {
  requireText(artworkMap, `'${feature}'`, `Screen artwork mapping is missing ${feature}.`);
}

requireText(topBar, 'resolvePartnerScreenArtwork({ title, eyebrow })', 'PartnerTopBar must resolve feature artwork centrally.');
requireText(topBar, 'resolvedArtwork', 'PartnerTopBar must render the resolved feature artwork.');
requireText(screen, 'artwork={artwork}', 'PartnerScreen must preserve explicit artwork overrides.');
requireText(listScreen, 'artwork={artwork}', 'PartnerListScreen must preserve explicit artwork overrides.');

requireText(stateView, 'PartnerAssets.emptyStates.offline', 'Offline state must use branded Partner artwork.');
requireText(stateView, 'PartnerAssets.emptyStates.validationError', 'Generic error state must use branded Partner artwork.');
requireText(stateView, 'PartnerAssets.emptyStates.incompleteDetails', 'Unauthorized state must use branded Partner artwork.');
requireText(home, '<PartnerPoliciesSoldIcon size={36} />', 'Partner Home Policies Sold metric must use the generated policy icon.');
requireText(home, '<PartnerCommissionEarnedIcon size={36} />', 'Partner Home Commission Earned metric must use the generated commission icon.');
requireText(homeMetricIcons, 'export function PartnerPoliciesSoldIcon', 'Generated Policies Sold icon component must exist.');
requireText(homeMetricIcons, 'export function PartnerCommissionEarnedIcon', 'Generated Commission Earned icon component must exist.');
requireText(homeMetricIcons, 'styles.document', 'Policies Sold generated icon must retain the document treatment.');
requireText(homeMetricIcons, 'styles.policyBadge', 'Policies Sold generated icon must retain the verified-policy badge.');
requireText(homeMetricIcons, 'styles.coinTop', 'Commission Earned generated icon must retain stacked coin treatment.');
requireText(homeMetricIcons, "backgroundColor: '#EDF7FF'", 'Generated Home metric icons must keep the soft blue reference tile.');

requireText(home, '<MiniBusinessTrend values={trend.map((item) => Number(item.premium || 0))} />', 'Partner Home MTD card must retain its small month-wise bar trend.');
if (home.includes('<PartnerBusinessGrowthIcon')) throw new Error('Partner Home MTD card must not show the removed large growth icon.');
requireText(more, '<PartnerProfileMenuIcon kind={iconKind} size={38} />', 'Partner Profile/More menu rows must use the shared professional icon component.');
for (const kind of [
  'search', 'policy-intake', 'renewals', 'customers',
  'week', 'impact', 'journey', 'activity',
  'learn', 'recognition', 'stories',
  'profile', 'support', 'settings',
]) {
  requireText(more, `iconKind="${kind}"`, `Partner Profile/More menu must map the professional ${kind} icon.`);
  const configKey = kind.includes('-') ? `'${kind}':` : `${kind}:`;
  requireText(profileMenuIcon, configKey, `Partner Profile menu icon system is missing ${kind}.`);
}
requireText(profileMenuIcon, "backgroundColor: '#EDF6FF'", 'Partner Profile menu icons must keep the same soft professional blue tile language as Business KPI icons.');
requireText(profileMenuIcon, "borderColor: '#D4E8FF'", 'Partner Profile menu icons must keep the professional blue border treatment.');
requireText(profileMenuIcon, "shadowColor: '#0B4E9B'", 'Partner Profile menu icons must keep subtle branded depth.');
if (more.includes('PartnerAssets.actions.') || more.includes('PartnerAssets.status.') || more.includes('PartnerAssets.navigation.')) {
  throw new Error('Partner Profile/More menu must not regress to mixed legacy artwork after professional icon unification.');
}
requireText(businessGrowthIcon, 'styles.barOne', 'Shared business growth icon must keep the first reference bar.');
requireText(businessGrowthIcon, 'styles.barFour', 'Shared business growth icon must keep the fourth reference bar.');
requireText(businessGrowthIcon, 'name="trending-up"', 'Shared business growth icon must keep the rising trend line.');
if (businessGrowthIcon.includes('name="arrow-up"')) throw new Error('Shared business growth icon must not restore the removed top-right straight arrow.');

for (const businessAsset of ['actions.quickRenewals', 'actions.quickClaims', 'actions.quickCustomers']) {
  requireText(business, `PartnerAssets.${businessAsset}`, `Business is missing ${businessAsset} artwork.`);
}

for (const word of ['>High</Text>', '>Mid</Text>', '>Low</Text>']) {
  if (business.includes(word)) throw new Error('Month-wise Trend must not render qualitative axis label ' + word);
}
requireText(business, 'function trendScale(values: number[])', 'Business trend must derive an adaptive numeric premium axis.');
requireText(business, 'const rawStep = peak / 3;', 'Trend scale must use equal premium intervals.');
requireText(business, '[1, 2, 2.5, 5, 10].find(', 'Trend interval must round to readable rupee ticks.');
requireText(business, '[3, 2, 1, 0].map((multiple) => formatCompactCurrency(multiple * step))', 'Trend Y-axis ticks must display rupee values including zero.');
requireText(business, 'Math.round((premium / top) * (compact ? 52 : 70))', 'Trend bars must scale to the same rounded axis ceiling as labels.');
requireText(business, 'const points = data.slice(-6);', 'Trend axis and chart must derive from the same six plotted months.');
requireText(business, 'formatCompactCurrency(premium)', 'Preserve original monthly premium labels.');

requireText(business, 'function BlueIcon(', 'Business must keep the shared blue generated-icon treatment.');
requireText(business, '<PartnerBusinessOverviewIcon kind={icon} size={24} />', 'Business Overview KPI cards must use the professional shared KPI icon component.');
for (const kind of ['premium', 'policies', 'commission', 'customers']) {
  requireText(business, `icon="${kind}"`, `Business Overview must map the ${kind} professional KPI icon.`);
  requireText(businessOverviewIcons, `${kind}:`, `Business Overview icon component is missing the ${kind} icon treatment.`);
}
requireText(businessOverviewIcons, "premium: { icon: 'cash', badge: 'rupee' }", 'Premium Generated must keep a finance icon with rupee badge.');
requireText(businessOverviewIcons, "policies: { icon: 'document-text', badge: 'verified' }", 'Policies Sold must keep a verified policy-document icon.');
requireText(businessOverviewIcons, "commission: { icon: 'wallet', badge: 'rupee' }", 'Commission Earned must keep a wallet/rupee icon.');
requireText(businessOverviewIcons, "customers: { icon: 'people' }", 'Customers must keep a professional people-group icon.');
requireText(businessOverviewIcons, "backgroundColor: '#EDF6FF'", 'Business Overview KPI icons must keep the soft professional blue tile.');
requireText(business, 'function productIcon(', 'Business product cards must keep differentiated product icon mapping.');
requireText(business, '<Text numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={label} style={styles.productLabel}>{label}</Text>', 'All Business by Product tiles must use a common font size and truncate long names with a trailing ellipsis, preserving full accessible names.');
if (business.includes('numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.productLabel}')) throw new Error('Business product names must not shrink individually to fit.');

requireText(business, 'const [overviewCustomOpen, setOverviewCustomOpen] = useState(false);', 'Business Overview must track custom-range panel visibility independently from the selected period.');
requireText(business, "setOverviewCustomOpen((open) => (overviewRange === 'custom' ? !open : true));", 'Selecting Custom again must toggle the Business Overview custom range panel.');
requireText(business, 'setOverviewCustomOpen(false);', 'Selecting a non-custom Business Overview period must close the custom range panel.');
requireText(business, "{overviewCustomOpen ? (", 'Business Overview custom range card must render from explicit open state.');
requireText(business, 'const [trendCustomOpen, setTrendCustomOpen] = useState(false);', 'Month-wise Trend must track custom-range panel visibility independently from the selected period.');
requireText(business, "setTrendCustomOpen((open) => (trendRange === 'custom' ? !open : true));", 'Selecting Custom again must toggle the Month-wise Trend custom range panel.');
requireText(business, 'setTrendCustomOpen(false);', 'Selecting a non-custom Month-wise Trend period must close the custom range panel.');
requireText(business, "{trendCustomOpen ? (", 'Month-wise Trend custom range card must render from explicit open state.');
requireText(business, '!payout.available', 'Business payout authorization gate must remain intact.');
requireText(business, 'getPartnerPayoutSummary()', 'Business must continue loading payout data through the existing service.');
requireText(business, "source={require('../../assets/partner/banners/claims-header-reference.jpg')}", 'Business header must use the same reference background as Claims and Policies.');
requireText(business, "heroBackdrop: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.92 }", 'Business header backdrop must keep Claims/Policies crop and opacity.');
requireText(business, "heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(1,42,95,0.10)' }", 'Business header must keep the Claims/Policies shade overlay.');
requireText(business, "heroBanner: { height: 98", 'Business header must retain the compact reference height.');

requireText(customers, 'PartnerAssets.emptyStates.noCustomers', 'Customers empty state must use the prepared no-customers artwork.');
requireText(policies, 'PartnerAssets.emptyStates.noPolicies', 'Policies empty state must use the prepared no-policies artwork.');
requireText(policies, 'name="document-text-outline"', 'Policies reference cards must use the compact document-style policy icon.');
requireText(policies, 'function policyStatus(', 'Policies reference cards must preserve lifecycle status styling.');
requireText(claims, 'PartnerAssets.navigation.claims', 'Claims empty state/fallback must retain Partner claim artwork.');
requireText(claims, 'PartnerInsurerLogo', 'Claims rows must render insurer logos through the live-master-data PartnerInsurerLogo component.');
requireText(claims, "state === 'completed'", 'Claims rows must preserve completed-state detection.');
requireText(claims, "success: { pill:", 'Completed claims must preserve green success-state styling.');
requireText(claims, "claimToneStyles[stageTone].pill", 'Claim status badges must use stage-specific styling.');
requireText(renewals, 'PartnerAssets.emptyStates.noRenewals', 'Renewal empty states must use the prepared no-renewals artwork.');
requireText(renewals, 'PartnerAssets.actions.renewals', 'Upcoming renewal rows must use Partner renewal artwork.');
requireText(renewals, 'styles.opportunitiesHeader', 'Renewal opportunity card must keep a section header.');
requireText(renewals, "summaryPanel: { marginTop: 0, marginHorizontal: -partnerTheme.spacing.lg, backgroundColor: '#FFFFFF' }", 'Renewal summary must be white, full-width and without a card border.');
requireText(renewals, 'styles.summaryMain', 'Renewal summary must show a left-side icon and heading.');
requireText(renewals, '<View style={styles.summaryCountBadge}>', 'Policy count must sit inside a rounded badge.');
requireText(renewals, '<Text style={styles.summaryCount} numberOfLines={1}>Policies {selectedSummary.count}</Text>', 'Badge must use the dynamic renewal policy count.');
requireText(renewals, "summaryCountBadge: { flexShrink: 0, minHeight: 28", 'Policy count badge must remain compact and right aligned.');
requireText(renewals, "renewalArtworkImage: { width: 32, height: 32 }", 'Insurer logo must be compact without changing brand mapping.');
requireText(renewals, "renewalRow: { minHeight: 64", 'Renewal rows must be compact.');
requireText(renewals, 'styles.summaryDivider', 'A thin divider separates the full-width summary from the tabs.');
requireText(renewals, 'Net Premium - {formatWholeRupees(selectedSummary.premium)}', 'Summary must display whole-rupee net premium inline.');
requireText(renewals, 'Math.trunc(amount)', 'Summary premium must remove paise without rounding up.');
requireText(renewals, "formatIndianCurrency(Number.isFinite(amount) ? Math.trunc(amount) : 0)", 'Whole-rupee summary must use Indian digit grouping.');

requireText(renewals, 'styles.recordCardLast', 'Renewal records must sit inside the joined opportunity card.');
requireText(renewals, '<Modal visible={sortOpen}', 'Renewal sort menu must use a top-level overlay, not the clipped FlatList header.');
requireText(renewals, 'sortAnchorRef.current?.measureInWindow', 'Renewal sort popup must anchor to its Due Date button.');
requireText(renewals, 'styles.emptyCard', 'Renewal empty and loading states must remain within the opportunity card.');
requireText(renewals, 'const PAGE_SIZE = 10;', 'Renewals initially show 10 records.');
requireText(renewals, 'bottomNavigation={<PartnerCaseBottomNavigation activeTab="Policies" />}', 'Renewals retain the standard permission-aware five-tab navigation.');
requireText(renewals, 'navyStatusBar', 'Renewals use a navy status area with light system icons.');
requireText(renewals, 'setVisibleLimit(nextLimit)', 'Load More appends the next 10 policies.');
requireText(renewals, ':limit:${visibleLimit}', 'Changing the requested limit must invalidate old 10-row cached page identity.');
requireText(renewals, 'collection.rows.length < collection.total', 'Load More is hidden when all filtered policies are shown.');
requireText(renewals, 'Load More Policies', 'The old numbered pagination is replaced with a Load More button.');
if (renewals.includes('<PartnerPagination') || renewals.includes('collection.nextPage') || renewals.includes('renewals-page-${collection.page}')) throw new Error('Renewals must not restore numbered page buttons or remount the list for pages.');
const partnerList = read('components/partner-list-screen.tsx');
requireText(partnerList, 'bottomNavigation?: ReactNode;', 'List screen supports fixed bottom navigation without replacing the scroll list.');
requireText(partnerList, '<StatusBar style="light" backgroundColor="#071E49" />', 'Renewals can opt into light status icons on navy.');

if (renewals.includes('<Metric ') || renewals.includes('styles.metricRow')) throw new Error('Renewal 0-7/8-15/16-30/overdue mini summary cards must not return.');
requireText(policyIntakes, 'styles.emptyIllustration', 'Empty Policy Intake history must show the compact illustrated placeholder.');
requireText(policyIntakes, 'EMPTY_SUBMISSION_COPY[filter].title', 'Empty Policy Intake history must explain the selected status.');
requireText(policyIntakes, 'No policy submissions yet', 'All filter must describe a truly empty intake register.');
if (policyIntakes.includes('state="empty"')) throw new Error('Policy Intake filtered empty state must not restore the oversized shared white card.');
const actionRequiredArtwork = path.join(root, 'assets/partner/status/warning.png');
if (!fs.existsSync(actionRequiredArtwork)) throw new Error('Action Required 3D artwork must be present in the Partner app bundle.');
requireText(policyIntakes, "row.status === 'needs_attention' || (row.status === 'processing' && row.ocr_status === 'failed')", 'Action Required and OCR-failed records must select warning artwork.');
requireText(policyIntakes, 'source={PartnerAssets.status.warning}', 'Use the bundled 3D warning artwork for Action Required instead of the former shield icon.');
requireText(policyIntakes, 'styles.rowArtworkAttention', 'Action Required artwork must use its small amber icon background.');
requireText(policyIntakes, 'styles.rowAttentionImage', 'Action Required artwork stays inside the existing compact record icon area.');
if (policyIntakes.indexOf('source={PartnerAssets.status.warning}') > policyIntakes.indexOf("const insurerName = field(row, 'insurer_name')")) throw new Error('Warning artwork must take priority over insurer logos for Action Required records.');
requireText(policyIntakes, 'PartnerInsurerLogo', 'Policy Intake records must prefer insurer artwork through PartnerInsurerLogo.');
requireText(policyIntakes, 'getPartnerManufacturerLogoSource', 'Policy Intake records must fall back to manufacturer artwork when insurer artwork is unavailable.');
requireText(policyIntakes, 'document-text-outline', 'Policy Intake records must keep a neutral default icon when insurer/manufacturer artwork is unavailable.');
if (policyIntakes.includes('rowFooter') || policyIntakes.includes('name="chevron-forward" size={17} color="#1E3C66"')) throw new Error('Policy Intake record rows must not restore the bottom footer chevron.');
requireText(policyIntakes, 'styles.updatedDate', 'Policy Intake record rows must keep Updated date/time beneath the status badge.');

requireText(policyIntakeNew, "'cloud-upload-outline'", 'New Policy Intake must keep the stable vector upload control.');
requireText(policyIntakeNew, "'checkmark-circle-outline'", 'New Policy Intake must keep the stable vector selected/ready control.');
if (policyIntakeNew.includes('PartnerAssets.status.documentUpload') || policyIntakeNew.includes('PartnerAssets.status.verified')) {
  throw new Error('New Policy Intake must not reintroduce the route-opening artwork render path that caused the installed-app crash.');
}
requireText(policyIntakeNew, 'submitPartnerPolicyIntake({', 'New Policy Intake must preserve the existing submit service path.');
requireText(policyIntakeNew, 'savePartnerPolicyIntakeDraft({', 'New Policy Intake must preserve draft saving.');
requireText(policyIntakeNew, 'loadPartnerPolicyIntakeDraft()', 'New Policy Intake must preserve draft restore.');
for (const intakeDetailAsset of ['emptyStates.policyUpload', 'status.documentUpload', 'status.policyAttention']) requireText(policyIntakeDetail, `PartnerAssets.${intakeDetailAsset}`, `Policy Intake detail is missing ${intakeDetailAsset} artwork.`);
requireText(policyIntakeDetail, 'artwork={PartnerAssets.actions.quickPolicyIntake}', 'Policy Intake detail header must use existing 3D policy intake artwork.');
requireText(policyIntakeDetail, 'fullWidth', 'Policy Intake detail sections should fill the mobile width.');
requireText(policyIntakeDetail, 'style={styles.intakeSummaryCompact}', 'The intake identity details must sit immediately below the PIR number for every intake status.');
requireText(policyIntakeDetail, 'source={PartnerAssets.actions.policyChecklist}', 'Policy Intake PIR summary must use bundled policy-document artwork.');
requireText(policyIntakeDetail, '"car-sport-outline"', 'Policy Intake vehicle section must use a professional vector vehicle icon.');
requireText(policyIntakeDetail, '"shield-checkmark-outline"', 'Policy Intake premium section must use a professional vector insurance icon.');
requireText(policyIntakeDetail, 'function statusBadgeStyle(row: PartnerPolicyIntake)', 'Policy Intake detail must keep centralized semantic status-badge mapping.');
requireText(policyIntakeDetail, 'navyStatusBar', 'Policy Intake detail must opt into navy status area and white system icons.');
requireText(screen, "backgroundColor={statusBarColor ?? (navyStatusBar ? '#071E49' : undefined)}", 'Android status bar must preserve navy opt-in fallback while supporting the Activity blue.');
requireText(screen, "statusBarColor || navyStatusBar || (showFixedHeader && stickyHeaderNavy) ? 'light' : 'dark'", 'Status bar foreground must stay white on navy and explicitly colored screens only.');
requireText(screen, 'statusBarColor ? { backgroundColor: statusBarColor } : null', 'Activity color must extend into the top native safe area without changing other screens.');
requireText(screen, 'bottomNavigation ? (', 'Partner screen must host a fixed footer outside scrollable detail content.');
requireText(policyIntakeDetail, 'bottomNavigation={<PartnerStackBottomNavigation activeTab="policies" />}', 'Policy Intake detail uses the shared five-tab footer with Policies selected.');
requireText(policyIntakeDetail, 'bottomNavigationNavy', 'Policy Intake detail footer and device inset must use the shared navy color.');
const sharedIntakeFooter = read('components/partner-stack-bottom-navigation.tsx');
for (const tab of ["Home", "Business", "Policies", "Claims", "More"]) requireText(sharedIntakeFooter, "label: '" + tab + "'", 'Shared Policy Intake footer must include ' + tab + '.');
requireText(sharedIntakeFooter, 'if (!permitted) return null;', 'Restricted tabs remain permission-gated by the shared footer.');
requireText(policyIntakeDetail, "submittedByName: { fontSize: 10, fontWeight: '500'", 'Submitter name must no longer be bold.');
requireText(policyIntakeDetail, 'statusMetaDuplicate: { paddingTop: 0 }', 'Duplicate submitter name must align with the top-right status stack.');

requireText(policyIntakeDetail, 'submitPartnerPolicyIntakeReplacement({', 'Policy Intake detail must preserve the replacement upload service path.');
if (policyIntakeDetail.includes('git-network-outline')) throw new Error('Policy Intake must not reintroduce obsolete generic network icons.');
requireText(policyIntakeDetail, '<Ionicons name="alert-circle-outline"', 'Duplicate policy warning must use a clear attention icon.');

for (const detailAsset of ['products.motorInsurance', 'products.healthInsurance', 'products.familyInsurance', 'products.commercialInsurance']) requireText(policyDetail, `PartnerAssets.${detailAsset}`, `Policy detail is missing ${detailAsset} artwork.`);
requireText(policyDetail, 'source={data.vehicle ? (manufacturerLogo || PartnerAssets.products.motorInsurance) : PartnerAssets.products.commercialInsurance}', 'Combined customer vehicle row uses the manufacturer icon or insured-risk fallback.');
requireText(policyDetail, '<InsurerMiniInfo name={data.insurer.name} />', 'Policy overview must pass the actual insurer identity into the compact tile.');
requireText(policyDetail, "<PartnerInsurerLogo name={name || ''}", 'Compact insurer tile must preserve insurer identity for logo artwork.');
requireText(policyDetail, 'INSURER_SHORT_LABELS.find(([pattern]) => pattern.test(fullName))', 'Known insurers are shortened through a shared display-only matcher.');
for (const shortLabel of [
  'ICICI Lombard', 'IFFCO-TOKIO', 'TATA AIG', 'HDFC ERGO', 'Bajaj Allianz',
  'SBI General', 'Reliance General', 'Future Generali', 'Liberty General',
  'Royal Sundaram', 'Chola MS', 'New India Assurance', 'United India',
  'Oriental Insurance', 'National Insurance', 'Star Health', 'Care Health',
  'Niva Bupa', 'Aditya Birla Health', 'ManipalCigna', 'HDFC Life',
]) {
  requireText(policyDetail, `'${shortLabel}'`, 'Common insurer must have concise display label: ' + shortLabel);
}
requireText(policyDetail, ".replace(/\\s+insurance$/i, '')", 'Unknown insurer names drop safe generic insurance suffix.');
requireText(policyDetail, 'return compact || fullName;', 'Unknown insurer labels retain their original name if shortening would erase it.');
requireText(policyDetail, 'styles.insurerMiniInfo', 'Insurer summary must use a compact tile.');
requireText(policyDetail, 'styles.miniInfo, styles.insurerMiniInfo', 'Insurer tile must inherit the grey Policy Number background.');
requireText(policyDetail, '<MiniInfo label="Policy status" value={humanize(data.policy.status || data.policy.lifecycle_status)} threeColumn />', 'Policy status must share one row with the validity dates.');
requireText(policyDetail, '<MiniInfo label="Start date" value={formatDate(data.policy.start_date)} threeColumn />', 'Start date must sit beside the status without changing the value.');
requireText(policyDetail, '<MiniInfo label="End date" value={formatDate(data.policy.end_date)} threeColumn />', 'End date must sit beside the start date without changing the value.');
requireText(policyDetail, "miniInfoThreeColumn: { width: '31%', flexGrow: 1, minWidth: 0 }", 'Status and validity dates must fit in three equal responsive tiles.');
requireText(policyDetail, "motorCategoryPill: { backgroundColor: '#0A234A' }", 'Motor category pill must use navy background.');
requireText(policyDetail, "motorCategoryLabel: { color: '#FFFFFF' }", 'Motor category pill must have contrasting white text.');
requireText(policyDetail, "category === 'Motor' && styles.motorCategoryPill", 'Only Motor pill styling changes; other policy types preserve their appearance.');
requireText(policyDetail, 'getPartnerPolicyDetail(id)', 'Policy detail must preserve the existing scoped data service.');
// Policy Details keeps the navy title and a separate white summary, retaining all values.
for (const required of [
  "backgroundColor: '#0A234A', borderBottomWidth: StyleSheet.hairlineWidth",
  "headerTitle: { color: '#FFFFFF'",
  "summaryCard: {",
  "backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth",
  "summaryPolicyNo: { color: '#1B2536'",
  "backgroundColor: '#FFF2DE'",
  "{policyNumber}",
  "{category}",
  "Net Premium - {nullableMoney(data.premium.net_premium)}",
  "{formatDate(data.policy.start_date)} – {formatDate(data.policy.end_date)}",
  "PartnerInsurerLogo name={data.insurer.name}",
  "accessibilityLabel=\"Back\"",
]) {
  requireText(policyDetail, required, 'Navy Policy Details must retain all required values and navigation: ' + required);
}
if (policyDetail.includes(">Policy Period<")) {
  throw new Error('The navy Policy Details summary must not show the Policy Period label.');
}
requireText(policyDetail, 'navyStatusBar bottomNavigationNavy', 'System status bar remains navy and navigation remains visible.');




// Policy Details keeps its own four original policy-specific actions;
// only the visual layout matches the transparent Policies Quick Actions row.
for (const [label, kind, route] of [
  ['Policy Document', 'policy-document', '/policies'],
  ['Renew Policy', 'renew-policy', '/renewals'],
  ['Raise Claim', 'raise-claim', '/claims'],
  ['Customer Details', 'customer-details', '/customer/'],
]) {
  requireText(policyDetail, `label="${label}"`, `Policy Details must retain ${label}.`);
  requireText(policyDetail, `iconKind="${kind}"`, `Policy Details must retain its ${label} icon.`);
  requireText(policyDetail, route, `Policy Details must preserve the original ${label} route.`);
}
requireText(policyDetail, "backgroundColor: 'transparent'", 'Quick Actions must remain background-free.');
requireText(policyDetail, 'numberOfLines={1} adjustsFontSizeToFit', 'Action labels must use single-line auto fitting.');
requireText(policyDetail, 'styles.quickActionIcon', 'Icons must render directly without tiles.');
for (const asset of ['policy-document', 'customer-details']) {
  requireText(policyDetail, `require('../../assets/partner/quick-actions/${asset}.png')`, `3D quick-action illustration missing: ${asset}`);
}
requireText(policyDetail, "iconKind === 'renew-policy' || iconKind === 'raise-claim' ? styles.quickActionArtworkCompact : styles.quickActionArtwork", 'Only Renew and Claim use smaller artwork, preserving other illustrations.');
requireText(policyDetail, 'quickActionArtworkCompact: { width: 43, height: 43 }', 'Renew and Claim icons are reduced within unchanged 54px tap artwork slots.');
requireText(policyDetail, 'quickActionArtwork: { width: 54, height: 54 }', 'Document and Customer icons remain original size.');
for (const kind of ['premium-breakup', 'sales-ownership']) {
  requireText(policyDetail, `<PartnerPolicyDetailIcon kind="${kind}" size={22} showBadge={false} />`, `Disclosure icon ${kind} matches overview heading size.`);
}
requireText(policyDetail, "marginHorizontal: 0, marginBottom: 8, paddingHorizontal: 11", 'Premium and Sales disclosure headers span the card and align their contents with Policy Overview.');
requireText(policyDetail, 'gap: 7, backgroundColor:', 'Disclosure icon-to-title gap matches Policy Overview.');
requireText(policyDetail, '<Text style={styles.cardTitle}>Premium breakup</Text>', 'Premium title uses exact Overview heading typography.');
requireText(policyDetail, '<Text style={styles.cardTitle}>Sales ownership</Text>', 'Sales ownership title uses exact Overview heading typography.');
requireText(policyDetail, '<CardHeader iconKind="policy-overview" title="Policy Overview" tinted', 'Policy Overview header must use the source-and-ownership blue band.');
requireText(policyDetail, "policySectionHeaderTint: { backgroundColor: '#E8F0FB' }", 'Policy Overview uses the light-blue reference background.');
requireText(policyDetail, "premiumDisclosure: { minHeight: 47, marginHorizontal: 0, marginBottom: 8, paddingHorizontal: 11, borderRadius: 0, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#E8F0FB' }", 'Premium breakup uses the same full-width light-blue header.');
requireText(policyDetail, "commercialRow: { minHeight: 47, marginHorizontal: 0, marginBottom: 8, paddingHorizontal: 11, borderRadius: 0, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#E8F0FB' }", 'Sales ownership uses the same full-width light-blue header.');

requireText(policyDetail, "iconKind === 'renew-policy'", 'Renew Policy retains its own icon choice.');
requireText(policyDetail, "iconKind === 'raise-claim'", 'Raise Claim retains its own icon choice.');
requireText(policyDetail, 'PartnerAssets.actions.quickRenewals', 'Renew Policy uses the exact Home Renewals icon.');
requireText(policyDetail, 'PartnerAssets.actions.quickClaims', 'Raise Claim uses the exact Home Claims icon.');
if (policyDetail.includes('quickGlyph')) throw new Error('Generic vector icons must not replace the Home action artwork.');
if (policyDetail.includes('Ionicons name={iconName} size={32}')) throw new Error('Flat quick-action glyph must not return.');

for (const obsolete of ['label="Policy Intake"', 'label="Add Policy"', 'label="Case Register"', 'label="Add Partner"', 'styles.quickBlue', 'borderRightColor']) {
  if (policyDetail.includes(obsolete)) throw Error('Policy Details must not replace original actions or reintroduce backgrounds: ' + obsolete);
}
requireText(policyDetail, 'navyStatusBar bottomNavigationNavy', 'Policy Details must use a navy system status bar and footer safe area.');
requireText(policyDetail, '<PartnerCaseBottomNavigation activeTab="Policies" />', 'Policy Details must use existing navigation with Policies selected.');
const detailFooter = read('components/partner-case-bottom-navigation.tsx');
for (const label of ['Home', 'Business', 'Policies', 'Claims', 'More']) {
  requireText(detailFooter, `label: '${label}'`, `Bottom navigation must retain ${label}.`);
}
requireText(detailFooter, 'items.filter(item => item.allowed)', 'Bottom navigation must remain permission gated.');
requireText(detailFooter, 'activeTab === item.label', 'Current section must be visually marked.');

if (policyDetail.includes('styles.quickBlue') || policyDetail.includes('borderRightColor')) {
  throw Error('Policy detail must not restore colored Quick Action tiles or dividers.');
}

requireText(policyDetail, '<PartnerPolicyDetailIcon kind={iconKind}', 'Policy detail reusable sections must render the professional policy icon component.');
for (const kind of [
  'quick-actions', 'policy-document', 'renew-policy', 'raise-claim', 'customer-details',
  'policy-overview', 'category', 'product', 'business-type', 'issuance-date', 'insurer',
  'idv', 'premium', 'premium-breakup', 'customer-vehicle', 'commercial-attribution',
  'sales-ownership', 'policy-period',
]) {
  const configKey = kind.includes('-') ? `'${kind}':` : `${kind}:`;
  requireText(policyDetailIcon, configKey, `Policy detail professional icon system is missing ${kind}.`);
}
for (const directKind of ['premium-breakup', 'sales-ownership']) {
  requireText(policyDetail, `kind="${directKind}"`, `Policy detail must render the professional ${directKind} icon.`);
}
if (policyDetail.includes('kind="policy-period"')) throw new Error('Policy Period must not render an icon in the summary.');
requireText(policyDetailIcon, "backgroundColor: palette.bg", 'Policy detail professional icons must render semantic tone backgrounds.');
requireText(policyDetailIcon, "borderColor: palette.border", 'Policy detail professional icons must keep bordered professional tiles.');
requireText(policyDetailIcon, "shadowColor: palette.fg", 'Policy detail professional icons must keep subtle semantic depth.');
if (policyDetail.includes('name="person-outline"') || policyDetail.includes('name="car-outline"') || policyDetail.includes("category === 'Motor' ? 'car-outline'")) throw new Error('Policy detail feature/entity identity must not regress to generic person/car glyphs.');

requireText(customerDetail, 'getPartnerInsurerLogoSource', 'Customer detail must resolve insurer logos for policy and claim rows.');
requireText(customerDetail, 'getPartnerManufacturerLogoSource', 'Customer detail must resolve manufacturer logos for vehicle rows.');
requireText(customerDetail, 'policy.insurer_name', 'Customer detail policy rows must bind insurer identity from real policy data.');
requireText(customerDetail, 'claim.insurer_name', 'Customer detail claim rows must bind insurer identity from real claim data.');
requireText(customerDetail, 'vehicle.make', 'Customer detail vehicle rows must bind manufacturer identity from real vehicle data.');
requireText(customerDetail, 'PartnerContactActions phone={data.customer.phone} email={data.customer.email}', 'Customer detail must preserve Call, WhatsApp and Email actions from real customer contact data.');
requireText(customerDetail, 'getPartnerCustomerDetail(id)', 'Customer detail must preserve the existing scoped data service.');
requireText(customerDetail, 'initials(data.customer.customer_name)', 'Customer detail must retain real-customer initials for identity.');
for (const oldGlyph of ['document-text-outline', 'car-outline', 'shield-outline']) if (customerDetail.includes(`name="${oldGlyph}"`)) throw new Error(`Customer detail feature rows must not regress to ${oldGlyph}.`);

for (const detailAsset of ['navigation.claims']) requireText(claimDetail, `PartnerAssets.${detailAsset}`, `Claim tracker is missing ${detailAsset} artwork.`);
requireText(claimDetail, 'getPartnerManufacturerLogoSource', 'Claim tracker must resolve linked manufacturer artwork.');
requireText(claimDetail, 'const [detailsOpen, setDetailsOpen] = useState(false)', 'Claim details must begin collapsed.');
requireText(claimDetail, 'CLAIM_STAGES.map', 'Claim journey must render the nine milestone rows.');
requireText(claimDetail, 'setDetailsOpen', 'Claim details accordion must remain interactive.');
requireText(claimDetail, 'setJourneyOpen', 'Claim Journey accordion must remain interactive.');
requireText(claimDetail, 'setDocumentsOpen', 'Documents accordion must remain interactive.');
requireText(claimDetail, 'getPartnerClaimDetail(id)', 'Claim tracker must preserve the existing scoped data service.');
requireText(claimDetail, 'pathname: \'/claim/stage\'', 'Stage rows must navigate to their dedicated view.');

requireText(search, 'PartnerAssets.emptyStates.noSearchResults', 'Universal Search must use the prepared no-results artwork.');
for (const featureAsset of ['navigation.customers', 'navigation.policies', 'navigation.claims']) requireText(search, `PartnerAssets.${featureAsset}`, `Universal Search is missing ${featureAsset} result artwork.`);
requireText(support, 'PartnerAssets.actions.supportVerified', 'Support fallback must use the prepared verified-support artwork.');
if (support.includes('asset={PartnerAssets.emptyStates.supportResolved}')) throw new Error('Support-unavailable errors must not misuse the support-resolved artwork.');
requireText(settings, 'PartnerAssets.status.settings', 'Settings must retain branded Check for updates artwork.');
const settingsSectionHeader = read('components/ui/partner-section-header.tsx');
requireText(settingsSectionHeader, 'settingsHeading ? <View style={styles.settingsAccent} /> : null', 'Settings section headings must have reference purple accent.');
requireText(settingsSectionHeader, 'fontWeight: \'900\', letterSpacing: 0.35', 'Settings headings must be bold and readable.');
for (const heading of ['Account', 'Device security', 'Privacy', 'App information']) {
  requireText(settings, `title="${heading}" settingsHeading compact`, `Settings must retain bold ${heading} heading.`);
}
requireText(settings, 'subtitle="Manage your profile details"', 'Profile row must show reference helper copy.');
requireText(settings, 'subtitle="Get help and assistance"', 'Support row must show reference helper copy.');
requireText(settings, "linkIcon: { width: 34, height: 34", 'Settings must use larger reference-style lavender icons.');

requireText(settings, 'icon="person-outline" title="Profile & registration"', 'Settings Account profile row must use the professional profile icon.');
requireText(settings, 'icon="headset-outline" title="Support"', 'Settings Account support row must use the professional support icon.');
requireText(settings, "controlTitle: { color: '#141C3F', fontSize: 13", 'Device security titles must use a dedicated non-flexing title style.');
requireText(settings, "controlCopy: { flex: 1, minWidth: 0, justifyContent: 'center' }", 'Device security title and helper copy must remain a compact vertical stack.');
requireText(settings, "controlSubtitle: { marginTop: 1", 'Device security helper text must sit directly below its row title.');
requireText(settings, 'controlRow: { minHeight: 46', 'Device security rows must keep the compact joined-list height.');
requireText(settingsSectionHeader, 'settingsRowCompact: { marginTop: 7, marginBottom: 4, minHeight: 20 }', 'Compact Settings headings reduce large vertical section gaps without changing other pages.');
for (const compactStyle of [
  'linkRow: { minHeight: 46',
  'infoRow: { minHeight: 28',
  'linkIcon: { width: 34, height: 34',
  'updateMenu: { marginTop: 5 }',
  'note: { marginTop: 6, minHeight: 34',
]) requireText(settings, compactStyle, 'Compact Settings layout contract: ' + compactStyle);
for (const item of ['Profile & registration', 'Support', 'Biometric re-entry', 'Partner notifications', 'Privacy Policy', 'Request account deletion', 'Check for updates']) {
  requireText(settings, item, 'Compact layout must preserve Settings action: ' + item);
}
for (const detail of ['INSUREIT Partner', 'Version', 'Runtime', 'Automatic on launch']) requireText(settings, detail, 'Compact app information must retain ' + detail);


requireText(profile, "marginHorizontal: -partnerTheme.spacing.lg,\n    marginTop: 0,\n    paddingHorizontal: 20,", 'Profile blue hero must attach directly below the navy title header with no blank gap.');
requireText(profile, 'name="log-out-outline"', 'Profile hero must expose the logout icon.');
requireText(profile, 'onPress={() => setLogoutOpen(true)}', 'Profile hero logout icon must open confirmation instead of signing out immediately.');
requireText(profile, '<PartnerConfirmDialog', 'Profile logout must use the shared confirmation dialog.');
requireText(profile, 'title="Sign out of INSUREIT Partner?"', 'Profile logout confirmation must match the More screen title.');
requireText(profile, 'message="You will need to sign in again to access your business and service workspace."', 'Profile logout confirmation must match the More screen message.');
if (profile.includes('styles.logoutArea') || profile.includes('styles.logoutButton')) throw new Error('Profile must not restore the bottom logout button.');

for (const activityAsset of ['status.policyActive', 'navigation.claims', 'navigation.policyIntake', 'actions.policyChecklist', 'status.announcement']) requireText(activity, `PartnerAssets.${activityAsset}`, `Activity is missing ${activityAsset} artwork.`);
for (const tinySize of ['fontSize: 7.2', 'fontSize: 7.5', 'fontSize: 8.5', 'fontSize: 8,']) if (activity.includes(tinySize)) throw new Error(`Activity must not regress to tiny timeline typography: ${tinySize}`);
if (activity.includes('<Text numberOfLines={1} style={styles.meta}>{item.meta}</Text>')) throw new Error('Recent Activity must not render insurer/company meta below the customer name.');
if (activity.includes('<Ionicons name="chevron-forward" size={20} color="#071C70" />')) throw new Error('Recent Activity record rows must not show a right-side chevron.');
requireText(activity, 'width: 52', 'Recent Activity logo tile must stay compact so details sit closer to the logo.');
requireText(activity, 'marginRight: 4', 'Recent Activity logo-to-detail spacing must stay compact.');
for (const impactMarker of ['function ImpactIcon(', 'icon="car-sport"', 'icon="people"', 'icon="document-text"', 'icon="shield-checkmark"', 'icon="trending-up"', 'icon="person-add"', 'icon="checkmark-done-circle"', 'icon="navigate-circle"']) requireText(impact, impactMarker, `Impact is missing professional icon marker ${impactMarker}.`);
for (const impactRoute of ["router.push('/customers')", "router.push('/(tabs)/policies')", "router.push('/(tabs)/claims')", "router.push('/business-report')", "router.push('/journey')"]) requireText(impact, impactRoute, `Impact clickable-card route is missing ${impactRoute}.`);
for (const tinySize of ['fontSize: 7.5', 'fontSize: 8.5', 'fontSize: 8,']) if (impact.includes(tinySize)) throw new Error(`Impact must not regress to tiny typography: ${tinySize}`);
requireText(journey, 'PartnerAssets.status.journey', 'Journey timeline and empty state must use journey artwork.');
for (const tinySize of ['fontSize: 7.5', 'fontSize: 8.5', 'fontSize: 8,']) if (journey.includes(tinySize)) throw new Error(`Journey must not regress to tiny typography: ${tinySize}`);
requireText(weeklyStory, 'PartnerAssets.actions.renewals', 'Your Week must keep renewal artwork for upcoming work.');
requireText(weeklyStory, "backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DCE9FA'", 'Your Week This Week pill must use the white treatment.');
requireText(weeklyStory, 'minWidth: 92, flexShrink: 0', 'Your Week This Week pill must not clip the Week label on compact widths.');
requireText(weeklyStory, "backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E7F0'", 'Your Week reflection card must use a white surface.');
requireText(weeklyStory, 'accessibilityState={{ expanded: comparisonOpen }}', 'Your Week comparison range control must expose expanded state.');
requireText(weeklyStory, '[7, 14, 30].map((days)', 'Your Week comparison range control must offer 7, 14 and 30 day options.');
requireText(weeklyStory, 'getPartnerBusinessRange(range.from, range.to)', 'Your Week non-default comparison ranges must load scoped business-range data.');
for (const tinySize of ['fontSize:7.5', 'fontSize:8.5', 'fontSize:8,', 'fontSize:9,']) if (weeklyStory.includes(tinySize)) throw new Error(`Your Week must not regress to tiny typography: ${tinySize}`);
for (const recognitionAsset of ['status.achievement', 'actions.policyChecklist', 'actions.renewals', 'status.journey']) requireText(recognition, `PartnerAssets.${recognitionAsset}`, `Recognition is missing ${recognitionAsset} artwork.`);
for (const tinySize of ['fontSize:7.5', 'fontSize:8.5']) if (recognition.includes(tinySize)) throw new Error(`Recognition must not regress to tiny typography: ${tinySize}`);
for (const learnAsset of ['actions.policyChecklist', 'status.verified']) requireText(learn, `PartnerAssets.${learnAsset}`, `Learn is missing ${learnAsset} artwork.`);
for (const tinySize of ['fontSize: 7.2', 'fontSize: 7.5', 'fontSize: 8.5', 'fontSize: 8,', 'fontSize: 9,']) if (learn.includes(tinySize)) throw new Error(`Learn must not regress to tiny typography: ${tinySize}`);

for (const pulseAsset of ['actions.businessPerformance', 'actions.renewals', 'navigation.claims', 'navigation.policyIntake']) {
  requireText(pulse, `PartnerAssets.${pulseAsset}`, `Pulse is missing ${pulseAsset} artwork.`);
}
requireText(pulse, 'getPartnerHome()', 'Pulse must preserve the existing Partner Home data service.');
requireText(pulse, '<PartnerStateView state="loading"', 'Pulse loading must use the shared Partner state system.');
requireText(pulse, 'state="error"', 'Pulse errors must use the shared branded Partner state system.');
for (const oldGlyph of ['trending-up-outline', 'refresh-outline', 'shield-checkmark-outline', 'document-text-outline']) {
  if (pulse.includes(`icon="${oldGlyph}"`)) throw new Error(`Pulse feature identity must not regress to ${oldGlyph}.`);
}
for (const tinySize of ['fontSize: 8.5', 'fontSize: 9,', 'fontSize: 8,', 'fontSize: 9.5']) {
  if (pulse.includes(tinySize)) throw new Error(`Pulse must not regress to tiny local typography: ${tinySize}`);
}

// Current exposed banners are generic business-growth artwork. Prevent semantic drift by keeping them out of
// operational/detail surfaces unless a future asset batch provides an exact matching banner.
for (const [name, source] of [
  ['Policies', policies], ['Claims', claims], ['Renewals', renewals], ['Customers', customers],
  ['Policy Intake history', policyIntakes], ['New Policy Intake', policyIntakeNew], ['Policy Intake detail', policyIntakeDetail],
  ['Search', search], ['Support', support], ['Policy detail', policyDetail], ['Customer detail', customerDetail], ['Claim detail', claimDetail],
]) {
  if (source.includes('PartnerAssets.banners.')) {
    throw new Error(`${name} must not use generic business-growth banners as operational semantics.`);
  }
}

// Business workspace resilience: Network is supplemental, never a page-wide blocker.
requireText(business, "key: 'business:workspace:v2'", 'Business dashboard must isolate its primary cache from old network-coupled entries.');
requireText(business, "key: 'business:network'", 'Partner Network must have an independently cached query.');
requireText(business, "retryTransientBusinessRead(getPartnerBusinessPerformance)", 'Business performance must retry transient request errors.');
requireText(business, "retryTransientBusinessRead(getPartnerNetwork)", 'Partner Network must retry transient errors independently.');
requireText(business, "if (!isLikelyConnectivityError(error)) throw error", 'Permission/authorization errors must never be retried as connectivity errors.');
requireText(business, "workspace.loading && !performance", 'Business page loading must not depend on a Network response.');
requireText(business, ") : !performance ? (", 'Only missing business performance may trigger a full-page Business error.');
requireText(business, "network ? network.total_partners : '—'", 'Partner Network must have an honest unavailable placeholder, not invented counts.');
requireText(business, "networkQuery.refresh()", 'Partner Network needs an independent recovery control.');
requireText(business, "networkQuery.ensureFresh()", 'Reopening Business must refresh the Network section.');
requireText(business, "networkQuery.error || networkQuery.stale", 'Supplemental Network failures should show a non-blocking warning.');
if (business.includes("if (networkResult.status === 'rejected') throw networkResult.reason")) {
  throw new Error('Business workspace must not fail when Partner Network fails.');
}
if (business.includes("!performance || !network")) {
  throw new Error('Business workspace must not hide existing business metrics for missing Network data.');
}

console.log('Partner visual-system completion contracts verified.');


for (const label of ['Total Policies', 'Active Policies', 'Expiring Soon', 'Lapsed Policies', 'Upcoming']) {
  requireText(policies, "label: '" + label + "'", 'Policies dropdown must retain ' + label + '.');
}
for (const contract of [
  'selectedStatus.label',
  'formatStatusCount(selectedStatus.count)',
  'onPress={openStatusMenu}',
  'onPress={() => selectSummary(option.filter)}',
  'setStatusMenuOpen(false)',
  'accessibilityState={{ selected }}',
  'visible={statusMenuOpen}',
]) {
  requireText(policies, contract, 'Policies status dropdown contract missing: ' + contract);
}
for (const forbidden of ['styles.summaryRow', 'styles.summaryChipSelected', 'Filter policies', 'accessibilityState={{ disabled: true }}']) {
  if (policies.includes(forbidden)) throw new Error('Policies must use the dropdown, not obsolete chips/disabled Filter: ' + forbidden);
}
for (const forbidden of ['See all policy status filters', '>See all</Text>', 'visible={seeAllOpen}', 'summarySeeAll:', 'statusSheetOverlay:']) {
  if (policies.includes(forbidden)) throw new Error('Policies screen must not render the See all button or modal: ' + forbidden);
}


// Business-line dropdown is separate from lifecycle status and applies to the scoped backend list.

requireText(policies, '<View style={styles.policyListHeadingSection}>\\n        <Pressable'.replace('\\n','\n'), 'Policies list heading is replaced directly by business-line dropdown.');
if (policies.includes('<Text style={styles.policyListTitle}>Policies</Text>')) throw new Error('Remove redundant Policies heading before business-line dropdown.');
requireText(policies, "businessLineButton:{flexDirection:'row',alignItems:'center',gap:7,minHeight:30,paddingHorizontal:3,backgroundColor:'transparent',borderWidth:0}", 'Business-line dropdown has no card background or border.');
requireText(policies, "businessLineText:{color:'#17365D',fontSize:12,fontWeight:'800'}", 'Borderless dropdown remains bold navy text.');
requireText(policies, 'accessibilityState={{expanded:lineMenuOpen}}', 'Business-line dropdown retains accessible expanded state.');
const partnerPolicyApi = read('lib/policies.ts');
for (const label of ["label:'All Policies'","label:'Motor'","label:'Non Motor'","label:'Life'","label:'Health'"]) {
  requireText(policies, label, 'Missing policy business-line option: '+label);
}
for (const item of ["useState<PartnerPolicyBusinessLine>('all')","onPress={openBusinessLineMenu}","visible={lineMenuOpen}","onPress={()=>selectBusinessLine(option.value)}","businessLine,","policies:list:${lifecycle}:${businessLine}:"]) {
  requireText(policies, item, 'Business-line dropdown is not wired to policy fetch/pagination: '+item);
}
requireText(partnerPolicyApi, "partner_app_list_policies_by_line", 'Filtered policy lists must use the server-side scoped RPC');
requireText(partnerPolicyApi, "businessLine === 'all'", 'Default all-policies view must retain the deployed RPC');
const migration = fs.readFileSync(path.join(root, '../../supabase/migrations/20261118113000_partner_policy_business_line_filter.sql'), 'utf8');
for (const item of ['partner_app_commercial_scope()', 'partner_branch_authorized_policy_ids()', 'count(*) over() as total_count', 'v_line not in', "GRANT EXECUTE ON FUNCTION public.partner_app_list_policies_by_line"]) {
  requireText(migration, item, 'Business-line RPC migration lost scoped paging or permissions contract: '+item);
}

requireText(policies, "value.includes('non motor')", 'Non Motor category must not fall into Motor substring matching');
requireText(migration, "ilike '%non motor%'", 'Server-side Non Motor category must match the card classifier');


// Renewal Work Queue uses a full-white canvas while other list screens retain their defaults.
const renewalScreen = read('app/renewals.tsx');
const sharedListScreen = read('components/partner-list-screen.tsx');
requireText(renewalScreen, 'whiteCanvas', 'Renewal Work Queue must opt in to white page background');
requireText(sharedListScreen, 'whiteCanvas = false', 'White canvas must not affect other Partner list screens');
requireText(sharedListScreen, 'whiteCanvas && styles.whiteCanvas', 'Only opted-in lists should render white canvas');
requireText(sharedListScreen, "whiteCanvas: { backgroundColor: '#FFFFFF' }", 'White canvas must match Policy Details white');
requireText(renewalScreen, 'navyStatusBar', 'Renewal Work Queue must retain its navy header and status bar');


// Policy list MTD / All bottom sheet, scoped database date/status filtering and counts.
const periodPolicyLib = read('lib/policies.ts');
const periodSql = fs.readFileSync(path.join(root,'../../supabase/migrations/20261119113000_partner_policy_period_status_filters.sql'),'utf8');
for(const phrase of ["setSortSheetOpen(true)","Sort by","MTD","All","sheetStatuses.map","Apply Filter","setPeriod(draftPeriod)","setLifecycle(draftLifecycle)","periodCounts.data?.[draftPeriod]?.[option.value]","styles.sortFloating"]) {
  requireText(policies,phrase,'Policy period/status bottom sheet is missing '+phrase);
}
for(const phrase of ["period,","policies:list:${period}:${lifecycle}","[period, lifecycle, debouncedSearch, businessLine]","setVisibleLimit(PAGE_SIZE)"]) {
  requireText(policies,phrase,'Period filter must invalidate fetched pages and reset pagination: '+phrase);
}
for(const phrase of ["partner_app_list_policies_by_period","partner_app_policy_period_counts","p_period: period","businessLine === 'all'"]) {
  requireText(periodPolicyLib,phrase,'Period filter must use server-side scoped RPC: '+phrase);
}
for(const phrase of ["partner_app_commercial_scope()","partner_branch_authorized_policy_ids()","v_scope_mode='none'","v_period='all'","Asia/Kolkata","coalesce(b.issuance_date,b.start_date,b.created_at::date)","count(*) filter (where f.lifecycle_status='expired')","REVOKE ALL ON FUNCTION public.partner_app_policy_period_counts"]) {
  requireText(periodSql,phrase,'Period filtering SQL must retain safe scope/count semantics: '+phrase);
}
