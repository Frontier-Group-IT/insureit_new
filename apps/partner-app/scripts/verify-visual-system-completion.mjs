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
for (const phrase of [
  "justifyContent: 'center', gap: 3",
  "barPlotSlot: { height: 72, width: '100%'",
  "barTrack: { height: '100%', width: '92%'",
  "fontSize: 11, lineHeight: 13, fontWeight: '700'",
  "const visiblePremiumLabel = compact && displayPremiumLabel.length > 6",
  "displayPremiumLabel.replace(/(Cr|L|k)$/",
  "<Text numberOfLines={2} style={[styles.barValue, Platform.OS === 'ios' && styles.barValueIos, { bottom: height + 3, height: visiblePremiumLabel.includes('\\n') ? 26 : 14 }]}>",
  "paddingTop: 27",
]) requireText(business, phrase, 'Business Month-wise Trend values must use independent full-width labels without iOS autoshrink: ' + phrase);
for (const marker of [
  "const displayPremiumLabel = Platform.OS === 'ios' ? premiumLabel.replace(/^₹/, '') : premiumLabel;",
  "barValueIos: { color: '#000000', fontSize: 9, lineHeight: 12, fontWeight: '400' }",
  "Platform.OS === 'ios' && styles.barValueIos",
  "const premiumLabel = formatCompactCurrency(premium);",
  "const axisLabels = [3, 2, 1, 0].map((multiple) => formatCompactCurrency(multiple * step));",
]) requireText(business, marker, 'Only iOS should remove the rupee prefix and use small regular black labels; Android and Y-axis stay unchanged: ' + marker);
if (business.includes("barValue: { position: 'absolute', left: 0, right: 0, height: 27")) {
  throw new Error('Trend amount labels must not reserve the obsolete 27dp height for single-line values.');
}
if (business.includes('minimumFontScale={0.85} style={[styles.barValue') || business.includes('styles.barTrackCompact')) {
  throw new Error('Trend premium labels cannot be constrained to the narrow blue bar');
}

const businessReport = read('app/business-report.tsx');
const customers = read('app/customers.tsx');
requireText(businessReport, 'hideTopBar', 'Business Report must hide its default light header.');
requireText(businessReport, 'navyStatusBar', 'Business Report must render the navy status area.');
for (const marker of [
  '<PartnerCasePageHeader title="Business Report" icon="business-outline" onBack={() => router.back()} />',
  "artwork={require('../assets/partner/business-report/premium-wallet-3d.png')}",
  "artwork={require('../assets/partner/business-report/policies-approved-3d.png')}",
  "artwork={require('../assets/partner/business-report/customers-shield-3d.png')}",
  '<SectionHeading title="Last 6 Months · Net Premium"',
  '<SectionHeading title="Business by Product · Net Premium"',
  '<ReportRow',
  'tone="purple"',
]) requireText(businessReport, marker, 'Business Report reference layout must retain: ' + marker);
if (/headerWaveRear|headerWaveFront|styles\.pageHeader|styles\.headerTitleRow|borderBottomLeftRadius: 22/.test(businessReport)) {
  throw new Error('Business Report must use the shared straight navy header without decorative waves or curves.');
}
if (businessReport.includes('chevron-forward') || businessReport.includes('chevron-right')) {
  throw new Error('Business Report rows must not display navigation chevrons.');
}
if (businessReport.includes('EATD Net Premium')) {
  throw new Error('MTD premium must not be mislabeled EATD without a matching backend calculation.');
}
requireText(businessReport, 'getPartnerBusinessReportNet()', 'Business Report data source must remain unchanged.');
requireText(businessReport, 'bottomNavigation={<PartnerStackBottomNavigation activeTab="business" />}', 'Business Report must retain its existing bottom navigation.');

const policies = read('app/(tabs)/policies.tsx');
const datePicker = read('components/ui/partner-date-picker.tsx');
for (const phrase of [
  "KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}",
  "selectedDatePreset(draftFromDate,draftToDate)===option.key",
  "styles.advancedPresetSelected",
  "styles.advancedPresetTextSelected",
  '<PartnerDatePicker directSelect label="From"',
  '<PartnerDatePicker directSelect label="To"',
  '<Text style={styles.sortSectionLabel}>Date Range</Text>',
]) requireText(policies, phrase, 'Policies filter sheet must retain keyboard-safe direct date selection and highlighted presets: ' + phrase);
if (policies.includes('<Text style={styles.sortSectionLabel}>Source</Text>') ||
    policies.includes('<Text style={styles.sortSectionLabel}>RM</Text>')) {
  throw new Error('Do not duplicate Source/RM headings above their search inputs');
}
for (const phrase of [
  "directSelect?: boolean",
  "open && directSelect",
  "calendarCells.map((day, index)",
  "onPress={() => { void partnerSelectionHaptic(); onChange(day); setOpen(false); }}",
  "accessibilityState={{ disabled: outside, selected }}",
  "Platform.OS === 'ios' && !directSelect",
]) requireText(datePicker, phrase, 'Direct-select date filter must close on valid day tap while preserving shared picker behavior: ' + phrase);

const claims = read('app/(tabs)/claims.tsx');
const renewals = read('app/renewals.tsx');
const policyIntakes = read('app/policy-intakes.tsx');
const policyIntakeNew = read('app/policy-intake-new.tsx');
const policyIntakeDetail = read('app/policy-intakes/[id].tsx');
const insurerPerformance = read('app/insurers.tsx');
requireText(insurerPerformance, 'source={PartnerAssets.status.businessGrowth}', 'Insurer performance header uses transparent 3D growth artwork.');
requireText(insurerPerformance, 'bottomNavigationNavy navyStatusBar', 'Insurer performance has a navy status area with white system icons.');
requireText(insurerPerformance, "referenceHeader: { marginHorizontal: -16, height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', backgroundColor: '#071E49' }", 'Insurer performance header must use the standard navy.');
requireText(insurerPerformance, "headerSearch: { width: '100%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD8E7', borderRadius: 999", 'Insurer search is full width with rounded corners.');
requireText(insurerPerformance, "dateSection: { marginHorizontal: 14, marginTop: 14", 'Insurer search and calendar use equal side margins.');
requireText(insurerPerformance, 'style={styles.calendarTrigger}', 'Date picker opens from the right side of insurer search.');
requireText(insurerPerformance, 'style={styles.selectedRangeRow}', 'Selected reporting dates appear under the search field.');
if (insurerPerformance.includes('styles.headerSearchBand') || insurerPerformance.includes('styles.dateRangeTrigger')) throw new Error('Insurer screen must not render duplicate full-width search band or date card.');
if (insurerPerformance.includes('BUSINESS PERFORMANCE') || insurerPerformance.includes('headerEyebrow')) throw new Error('Insurer header must show only the main title without eyebrow or unused style.');
requireText(insurerPerformance, "headerCopy: { flex: 1, minWidth: 0, justifyContent: 'center' }", 'Insurer header title is centered vertically.');
requireText(insurerPerformance, 'bottomNavigation={<PartnerStackBottomNavigation activeTab="business" />}', 'Existing Business-active footer must be preserved.');
for (const phrase of [
  "const INSURER_COLUMN_WIDTH = '31%'",
  "ScrollView horizontal showsHorizontalScrollIndicator",
  "numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}",
  "width: METRIC_WIDTHS[column.key]",
  "backgroundColor: METRIC_COLORS[column.key].header",
  "backgroundColor: METRIC_COLORS[column.key].cell",
  "policies: 75, premium: 105, payin: 90, retention: 95",
]) requireText(insurerPerformance, phrase, 'Insurer report must retain fixed names and readable horizontally scrolling colored financial columns: ' + phrase);


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

// The redesigned Policy Overview, Premium and Sales cards are independently styled; the white policy hero remains unchanged.
// Customer and vehicle identity now share one compact row and separate heading.
requireText(policyDetail, '<CardHeader title="Customer & Vehicle Details" />', 'Combined customer and vehicle heading is present');
requireText(policyDetail, '<CardHeader title="Customer & Vehicle Details" /></View>\\n            <Card highlighted>'.replace('\\n','\n'), 'Only the Customer & Vehicle section requests the blue border');
requireText(policyDetail, "customerVehicleBorder: { borderColor: '#3993F5', borderWidth: 1, backgroundColor: '#F3F8FF' }", 'Customer & Vehicle card has a visible 1px blue border');
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
const overviewCard = policyDetail.slice(overviewStart, policyDetail.indexOf('</Card>', overviewStart) + '</Card>'.length);
const premiumStart = policyDetail.indexOf('styles.premiumDisclosure', overviewStart);
const commercialStart = policyDetail.indexOf('styles.commercialRow', premiumStart);
requireText(overviewCard, 'styles.overviewGrid', 'Existing overview fields remain visible');
if (!(premiumStart > overviewStart && commercialStart > premiumStart)) throw new Error('Premium and Sales must follow Policy Overview');
if (overviewCard.includes('styles.premiumDisclosure') || overviewCard.includes('styles.commercialRow')) throw new Error('Premium and Sales require independent colorful cards');
requireText(policyDetail, "premiumDisclosure: { minHeight: 50", 'Premium mint card retains its pressable disclosure');
requireText(policyDetail, "commercialRow: { minHeight: 50", 'Sales amber card retains its pressable disclosure');
requireText(policyDetail, 'accessibilityState={{ expanded: showPremiumDetails }}', 'Premium expansion remains');
requireText(policyDetail, 'accessibilityState={{ expanded: showCommercialDetails }}', 'Commercial expansion remains');
requireText(policyDetail, 'const [showPremiumDetails, setShowPremiumDetails] = useState(true);', 'Premium breakup opens expanded by default');
requireText(policyDetail, 'const [showCommercialDetails, setShowCommercialDetails] = useState(true);', 'Sales ownership opens expanded by default');
requireText(policyDetail, 'onPress={() => setShowPremiumDetails((value) => !value)}', 'Premium breakup is still collapsible');
requireText(policyDetail, 'onPress={() => setShowCommercialDetails((value) => !value)}', 'Sales ownership is still collapsible');
requireText(policyDetail, 'quickSectionHeading: { marginLeft: 3, marginRight: 3, marginBottom: 9', 'Quick Actions heading remains aligned with new color tiles');
requireText(policyDetail, 'externalSectionHeading: { marginLeft: -6, paddingLeft: 0, paddingRight: 2 }', 'Customer & Vehicle heading moves slightly left without moving its card');
requireText(policyDetail, 'contentWrap: { marginTop: 0, gap: 12, paddingBottom: 15 }', 'Colored section cards use 12px breathing room');
requireText(policyDetail, 'paddingHorizontal: 14, paddingTop: 10, paddingBottom: 9', 'Policy summary vertical padding is compact');
requireText(policyDetail, 'quickSection: { marginHorizontal: 0, paddingVertical: 8 }', 'Quick Actions tiles align with full-width content');
requireText(policyDetail, 'quickSectionHeading: { marginLeft: 3, marginRight: 3, marginBottom: 9', 'Quick Actions heading keeps its clear spacing');
requireText(policyDetail, "minHeight: 94, alignItems: 'center', justifyContent: 'center'", 'Quick Action rows use full colored tap targets');
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
const caseRegister = read('app/life-health-cases/index.tsx');
for (const fragment of [
  "{key:'all',label:'All'},{key:'pending',label:'Pending'}",
  "{key:'issued',label:'Issued'},{key:'rejected',label:'Rejected'}",
  "const [status,setStatus]=useState<LifeHealthStatus>('all');",
  "businessLineOptions.map(item=><Pressable",
  "filters.filter(item=>item.key!=='all').map(item=><Pressable",
  "onPress={()=>{setStatus('all');setBusinessLineMenuOpen(open=>!open);}}",
  "onPress={()=>{setBusinessLine(item.key);setStatus('all');setBusinessLineMenuOpen(false);}}",
  "onPress={()=>{setStatus(item.key);setBusinessLineMenuOpen(false);}}",
  'listLifeHealthCases({status,businessLine,search,offset,limit:10})',
  'filters:{marginTop:12,marginBottom:8,minHeight:42,flexDirection:\'row\',alignItems:\'center\',gap:6,position:\'relative\',zIndex:40,overflow:\'visible\'}',
  "businessLineMenu:{position:'absolute',top:46,left:0,width:148,zIndex:60,elevation:16",
]) requireText(caseRegister, fragment, 'Case Register All dropdown must float over unchanged search and records: '+fragment);
for (const obsolete of [
  '<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}',
  'styles.businessLineSelect',
  'styles.filterTrigger',
  'styles.filterSection',
  'const [filterOpen,setFilterOpen]=useState(false);',
]) {
  if (caseRegister.includes(obsolete)) throw new Error('Obsolete Case Register dropdown layout remains: '+obsolete);
}
const caseFilterPos = caseRegister.indexOf('<View style={styles.filters}>');
const caseMenuPos = caseRegister.indexOf('style={styles.businessLineMenu}');
const caseSearchPos = caseRegister.indexOf('style={styles.searchWrap}');
const caseHeadingPos = caseRegister.indexOf('style={styles.listHeading}');
const caseListPos = caseRegister.indexOf('{loading?<ActivityIndicator');
if (!(caseFilterPos>=0 && caseMenuPos>caseFilterPos && caseSearchPos>caseMenuPos && caseHeadingPos>caseSearchPos && caseListPos>caseHeadingPos)) {
  throw new Error('All dropdown must be anchored in top filters while search, heading and records stay below it.');
}
if (caseRegister.slice(caseHeadingPos,caseListPos).includes('businessLineMenuOpen')) {
  throw new Error('No business-line dropdown belongs beside the Cases heading.');
}
const lifeHealthCaseDetails = read('app/life-health-cases/[id].tsx');
for (const [fragment, purpose] of [
  ["const [expandedCaseTab,setExpandedCaseTab]=useState<'activity'|'remarks'|null>(null);", 'Both existing tabs must start collapsed'],
  ['<View style={styles.activityFilterTabs}>', 'Update existing tabs above case actions; do not add new tabs'],
  ['accessibilityState={{selected:expandedCaseTab===tab}}', 'Existing tab must expose selected accessibility state'],
  ['onPress={()=>setExpandedCaseTab(previous=>previous===tab?null:tab)}', 'Tapping the same tab must collapse its section'],
  ['styles.activityFilterTabActive', 'Selected tab must use underline styling'],
  ["activityFilterTabActive:{borderBottomColor:'#2582F8'}", 'Selected underline must be bright blue'],
  ["activityFilterTabs:{flexDirection:'row',alignItems:'stretch',backgroundColor:'#FFFFFF',borderBottomWidth:1,borderBottomColor:'#E7EAF0'}", 'Tabs must be white with grey divider'],
  ["activityFilterTextActive:{color:'#0A234A'}", 'Selected text must be navy'],
  ["activityFilterText:{fontSize:11,fontWeight:'600',color:'#52627A'", 'Inactive text must be muted'],
  ["{record.status_group==='pending'?<View style={styles.caseActions}>", 'Reject and save actions must remain below existing tabs'],
]) requireText(lifeHealthCaseDetails, fragment, purpose);
requireText(lifeHealthCaseDetails, 'setExpandedCaseTab(null);', 'Focus must reset both case history tabs to collapsed.');
if (lifeHealthCaseDetails.includes('onPress={()=>setExpandedCaseTab(tab)}')) throw new Error('Existing case filter must toggle closed when selected again.');
if (lifeHealthCaseDetails.includes('<Text style={styles.heroCaseNumber}')) throw new Error('Internal LH identifier must be hidden from the case header.');
requireText(lifeHealthCaseDetails, '<View style={styles.heroTitleStatus}>', 'Pending status must sit beside Life / Health Case title.');
requireText(lifeHealthCaseDetails, 'heroEditPencil:{width:44,height:44', 'Edit button must be prominent and have a full touch target.');
requireText(lifeHealthCaseDetails, '<Text style={styles.heroSubtitle} selectable>{record.customer_name} · {record.proposal_number}</Text>', 'Proposal number must remain complete and appear once in case header.');
if (lifeHealthCaseDetails.includes("activityFilterCount") || lifeHealthCaseDetails.includes('tabCountBadge')) throw new Error('Activity / Remarks tabs must not display badges.');
const deletionScreen = read('app/account-deletion.tsx');
const deletionBrandIndex = deletionScreen.indexOf('<View style={styles.heroBrand} accessibilityLabel="insureit Partner">');
const deletionSloganIndex = deletionScreen.indexOf('<View style={styles.heroCopy}>');
if (deletionBrandIndex < 0 || deletionSloganIndex < 0 || deletionBrandIndex >= deletionSloganIndex) {
  throw new Error('Account deletion must show the Partner logo left and the slogan right.');
}
requireText(deletionScreen, "heroCopy: { flex: 1, minWidth: 0, paddingLeft: 10, paddingTop: 14, alignItems: 'flex-end' }", "Account deletion slogan stays right-aligned and begins at the brand wordmark first text row.");
requireText(deletionScreen, "heroSloganBlock: { alignSelf: 'flex-end', width: 142, maxWidth: '100%', alignItems: 'flex-start' }", 'Slogan is right-anchored with a stable two-line width, while allowing narrow viewport shrink.');
requireText(deletionScreen, 'numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Your account,', 'First slogan row stays on one line.');
requireText(deletionScreen, 'numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>your choice', 'Second slogan row stays on one line.');
requireText(deletionScreen, "heroTitle: { width: '100%', fontSize: 19, lineHeight: 22", 'Both Y characters must share the same left origin in equal-width text rows.');
requireText(deletionScreen, '<View style={styles.heroSloganBlock}>', 'Both headline rows must use the same right-side alignment group.');
requireText(deletionScreen, "letterSpacing: -0.6, textAlign: 'left'", 'Account deletion title lines must start at the same column.');
requireText(deletionScreen, "intro: { fontSize: 14, lineHeight: 23, color: '#242657', fontWeight: '500', textAlign: 'justify', alignSelf: 'stretch' }", 'The introduction must justify to full content width without disturbing horizontal padding.');

for (const [fragment, reason] of [
  ['styles.hero', 'Branded deletion page has a hero'],
  ['styles.heroUnderline', 'Hero title uses purple accent underline'],
  ["backgroundColor: '#FFFFFF' },", 'Deletion heading must have a clean white background'],
  ["heroBrand: { width: 156, minHeight: 70", 'Official crest and Partner wordmark remain in a compact left-side lockup'],
  ["alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'flex-start'", 'Logo group top-aligns with the heading and stays left-aligned'],
  ["tintColor: '#0B438C'", 'The official crest must render navy on the white banner'],
  ['styles.heroBrandCopy', 'Crest and insureit Partner text must form a horizontal logo lockup'],
  ["alignItems: 'flex-start', backgroundColor: '#FFFFFF'", 'Deletion hero keeps its white banner and top alignment'],
  ["heroBrandName: { fontSize: 19, lineHeight: 22, fontWeight: '900', color: '#0B438C'", 'Wordmark uses dark navy on white'],

  ["require('../assets/insureit-partner-official.png')", 'Hero uses official Partner brand asset'],
  ['styles.cardHeader', 'Data retention explanation has a lavender info header'],
  ['name="information"', 'Data card shows an information icon'],
  ['name="trash-outline"', 'Deletion CTA shows a trash icon'],
  ['name="chevron-forward"', 'Deletion CTA shows a forward chevron'],
  ['styles.noteCard', 'Deletion advice uses a lavender support card'],
  ['styles.noteEmphasis', 'Password safety message remains emphasized'],
  ['submitAccountDeletionRequest().then(setRequest)', 'Existing deletion submission remains intact'],
  ['disabled={busy || active}', 'Duplicate deletion requests remain disabled'],
  ['<PartnerCaseBottomNavigation activeTab="More" />', 'Account deletion retains the five-tab navy footer'],
]) requireText(deletionScreen, fragment, reason);

// Support alone opts into the edge-to-edge canvas; the rest retain their inset.
requireText(support, 'style={styles.contentInset}', 'Support retains standard content margins below its full-width hero.');
requireText(support, 'marginHorizontal: 0, borderRadius: 0', 'Support hero reaches screen edges.');
for (const [screen, label] of [[settings, 'Settings'], [profile, 'Profile'], [support, 'Support'], [deletionScreen, 'Account deletion']]) {
  requireText(screen, label === 'Support' ? 'hideTopBar fullWidth navyStatusBar bottomNavigationNavy' : 'hideTopBar navyStatusBar bottomNavigationNavy', `${label} must opt into the Policy Details navy shell.`);
  requireText(screen, '<PartnerCaseBottomNavigation activeTab="More" />', `${label} must retain permission-aware five-tab navigation with More selected.`);
  requireText(screen, '<PartnerCasePageHeader', `${label} must use the Policy Details-style title strip.`);
}

const activity = read('app/activity.tsx');
const impact = read('app/impact.tsx');
const journey = read('app/journey.tsx');
const weeklyStory = read('app/weekly-story.tsx');
const stories = read('app/stories.tsx');
for (const fragment of [
  "import { useSafeAreaInsets } from 'react-native-safe-area-context';",
  'const insets = useSafeAreaInsets();',
  '<StatusBar style="light" backgroundColor="#092B62" />',
  'style={[styles.top, { paddingTop: insets.top + 11 }]}',
  'style={styles.progress}',
]) requireText(stories, fragment, 'All INSUREIT Story slides must keep progress dashes below Android/iOS status bars: ' + fragment);
// Stories reference: continuous illustrated slide, not the former floating card.
for (const [fragment, reason] of [
  ['style={styles.storyBackdrop}', 'Stories use a shared blue curved canvas'],
  ['style={styles.waveUpper}', 'Header wave is integrated with the story'],
  ['style={styles.waveMiddle}', 'Blue-white flowing background continues behind story copy'],
  ['style={styles.lessonBadge}', 'Eyebrow is a centered rounded badge'],
  ['style={styles.titleRule}', 'Centered title has the reference underline'],
  ['style={styles.body}', 'Story question is centered'],
  ['style={styles.illustrationWrap}', 'Large illustration sits underneath question'],
  ['style={styles.completedPill}', 'Completed learning status sits below illustration'],
  ['<StoryIllustration kind={story.kind} body={story.body} />', 'Artwork adapts to the current story type'],
  ["if (kind === 'learn' && /vehicle number/i.test(body))", 'Vehicle-servicing story uses car and number plate'],
  ["require('../assets/partner/actions/impact-blue-3d-car.png')", 'Learning illustration reuses bundled blue 3D car'],
  ['MH12AB1234', 'Example learning plate illustrates vehicle number'],
  ["onPress={openStory}", 'Story title retains navigation'],
  ['onTouchStart={handleStoryTouchStart}', 'Story taps are observed without blocking native scrolling'],
  ['onTouchEnd={handleStoryTouchEnd}', 'Story taps navigate when the finger is released'],
  ['onScrollBeginDrag={() => { navigationTouch.current = null; }}', 'Scrolling cancels pending tap navigation'],
  ['event.stopPropagation()', 'Story links do not trigger next or previous on tap'],
  ['if (event.nativeEvent.pageX < windowWidth / 2) previous();', 'Left-side taps navigate backwards'],
  ['else next();', 'Right-side taps navigate forwards'],
]) requireText(stories, fragment, 'Stories reference redesign missing: ' + reason);
for (const deprecated of ['styles.metricCard', 'styles.cardCorner', 'styles.metricHeader', 'styles.lowerWave', 'styles.titleArrow']) {
  if (stories.includes(deprecated)) throw new Error('Old card-based Stories layout remains: ' + deprecated);
}
// Touch navigation has no visible footer, preserves route controls and supports accessibility.
for (const forbidden of ['styles.footer', 'styles.footerHint', 'styles.navButton', 'styles.navButtonPrimary', 'styles.navDisabled']) {
  if (stories.includes(forbidden)) throw new Error('Stories must no longer show footer arrows or a slide count: ' + forbidden);
}
for (const required of [
  'accessibilityActions={[{ name: \'decrement\', label: \'Previous story\' }, { name: \'increment\', label: \'Next story\' }]}',
  "if (nativeEvent.actionName === 'decrement') previous();",
  "if (nativeEvent.actionName === 'increment') next();",
  'key={index}',
  'if (index <= 0) return;',
  'if (index >= data.items.length - 1) {',
]) requireText(stories, required, 'Story navigation accessibility or boundary regression: ' + required);
// Today story uses a dedicated responsive renewal summary; other slides remain shared.
for (const expected of [
  "story.kind === 'today' ? (",
  "<TodayRenewalStory story={story} onOpen={openStory} />",
  "function TodayRenewalStory({ story, onOpen }",
  "story.body.match(/₹",
  "story.title.match(/",
  "styles.todayCard",
  "styles.todayPremiumPanel",
  "styles.todayArtWrap",
  "styles.todayCalendar",
  "onTouchStart={(event) => event.stopPropagation()}",
]) requireText(stories, expected, 'Today renewal design regression: ' + expected);
if (stories.includes('₹939') || stories.includes('1 renewal is due in 7 days')) throw new Error('Today story renewal values must not be hardcoded');
// Monthly (Business) Story alone uses the new premium and policies snapshot.
for (const [needle, rationale] of [
  ["story.kind === 'business' ? (", 'Only Business Story receives the specialized layout'],
  ['<BusinessMonthStory story={story} onOpen={openStory} />', 'Live business story data powers its own full-screen snapshot'],
  ["const policyMatch = story.title.match(/^([0-9,]+) +(polic(?:y|ies)) *(.*)$/i)", 'Policy count and title stay data-driven'],
  ["const premium = story.metric !== undefined ? formatMetric(story) : null", 'Gross premium is formatted from live data'],
  ['<StoryHeading icon="stats-chart-outline" title={story.eyebrow} />', 'This Month uses the unified rounded heading'],
  ['style={styles.businessPremiumAmount}', 'Premium is the main headline'],
  ['style={styles.businessPoliciesCard}', 'Policies are summarized separately'],
  ['style={styles.businessPremiumCaption}', 'Business metric label is available beneath the summary'],
  ['style={styles.businessIllustrationWrap}', 'Monthly growth artwork sits directly below figures'],
  ["if (kind === 'business')", 'Dedicated native business artwork is used'],
  ['style={styles.businessGrowthBars}', 'Native growth bars remain responsive'],
  ['style={styles.businessRupeeCoin}', 'Rupee illustration is present'],
  ['style={styles.businessCashCoin}', 'Premium illustration is present'],
  ['onTouchStart={(event) => event.stopPropagation()}', 'Business story summary link preserves route navigation without changing slides'],
  ['onTouchEnd={(event) => event.stopPropagation()}', 'Business story link tap does not advance the slide'],
]) requireText(stories, needle, 'Business Stories snapshot regression: ' + rationale);
for (const unexpected of [
  '₹1,11,71,203.76',
  '772 policies',
]) {
  if (stories.includes(unexpected)) throw new Error('Business Story figures must come from the actual story result, not a mockup: ' + unexpected);
}
// Unified five-screen Story design contract: dynamic metrics, shared styling and routed links.
for (const marker of [
  '<StoryHeading icon="sunny" title={story.eyebrow} tone="gold" />',
  '<StoryHeading icon="shield-checkmark-outline" title={story.eyebrow} />',
  '<StoryHeading icon="people" title={story.eyebrow} tone="violet" />',
  '<StoryHeading icon="stats-chart-outline" title={story.eyebrow} />',
  '<StoryHeading icon="time-outline" title={story.eyebrow} tone="green" />',
  'function ImpactStory({ story, onOpen }',
  'function LearnStory({ story, onOpen }',
  'function StoryPanel({ children }',
  'style={styles.unifiedPanel}',
  'style={styles.impactSmallGrid}',
  "story.metric !== undefined",
  "story.body.match(/([\\d,]+)\\s+customers?",
  "story.body.match(/([\\d,]+)\\s+claims?",
  'style={styles.impactProtectionArtwork}',
  'style={styles.journeyProgressTrack}',
  'style={styles.businessPremiumAmount}',
  "style={styles.learnStoryQuestion}",
]) requireText(stories, marker, 'Five Stories unified mockup parity: ' + marker);
// Story 3 (My Journey) keeps its own milestone-focused composition and real scoped data.
for (const [needle, rationale] of [
  ["story.kind === 'journey' ? (", 'Only the customer journey story uses its own layout'],
  ['<JourneyMilestoneStory story={story} />', 'My Journey renders the dedicated milestone composition'],
  ['function JourneyMilestoneStory({ story }', 'My Journey milestone renderer exists'],
  ['Number(story.progress_current)', 'Achieved count comes from live story progress'],
  ['Number(story.progress_target)', 'Target comes from live story progress'],
  ['Math.max(0, target - current)', 'Remaining count derives from target minus actual progress'],
  ['Math.round(completion)', 'Percentage is calculated from live progress'],
  ['<StoryHeading icon="people" title={story.eyebrow} tone="violet" />', 'Journey uses the unified violet heading'],
  ['style={styles.journeyBlueArc}', 'Journey uses the uninterrupted curved background'],
  ['style={styles.journeyProgressTrack}', 'Milestone progress has a dedicated track'],
  ["require('../assets/partner/status/journey.png')", 'Journey road uses the bundled 3D path illustration'],
  ["require('../assets/partner/actions/quick-customers.png')", 'Journey uses bundled 3D customer artwork'],
  ['style={styles.journeyTrophy}', '3D road milestone is decorated with a trophy'],
  ['style={styles.journeySceneTarget}', 'Target marker remains data-driven'],
  ['style={styles.journeySceneAchieved}', 'Achieved marker remains data-driven'],
]) requireText(stories, needle, 'My Journey slide regression: ' + rationale);
if (stories.includes('style={styles.growthBars}') || stories.includes('style={styles.sceneGrowthArrow}')) {
  throw new Error('Old generic journey bar-chart illustration must remain removed.');
}
for (const mockValue of ['2,606', '394 customers', '3,000 target', '87%']) {
  if (stories.includes(mockValue)) throw new Error('My Journey must not hardcode mockup milestones: ' + mockValue);
}

const recognition = read('app/recognition.tsx');
const learn = read('app/learn.tsx');
for (const [screen, title, icon] of [
  [weeklyStory, 'A week with INSUREIT', 'bar-chart-outline'],
]) {
  requireText(screen, 'hideTopBar navyStatusBar bottomNavigationNavy', `${title} must use navy header and Android status bar like Profile.`);
  requireText(screen, '<PartnerCaseBottomNavigation activeTab="More" />', `${title} must show the permission-aware five-tab bottom navigation.`);
  requireText(screen, `<PartnerCasePageHeader title="${title}" icon="${icon}" onBack={() => router.back()} />`, `${title} must show a white title and back action on navy.`);
}

// My Achievements keeps navigation, dynamic data and an accessible progress indicator,
// while matching the new purple illustrated-card reference.
for (const fragment of [
  'hideTopBar', 'navyStatusBar', 'bottomNavigationNavy',
  '<PartnerCaseBottomNavigation activeTab="More" />',
  '<PartnerCasePageHeader title="My Achievements" icon="ribbon-outline" onBack={() => router.back()} />',
  'getPartnerRecognition()', 'accessibilityRole="progressbar"', 'accessibilityValue={{ min: 0',
  '(progress * 100).toFixed(1)', 'next.current.toLocaleString', 'formatDate(item.date)',
  'Unlocked achievements', 'name="star"', 'styles.headingRule',
  'styles.artworkTile', 'styles.achievementArtwork', 'styles.verticalRule',
  '{item.title}', 'A great start!', 'ACHIEVED', 'name="checkmark-circle"',
  'styles.dateRow', 'name="calendar-outline"',
  'NEXT MILESTONE', '{next.title}', 'Keep going,', 'on track!',
  'RING_SEGMENTS.map((segment, index)', 'styles.percentCircle',
  'styles.customersRow', 'View your full journey',
  'styles.journeyTint', 'styles.journeyArrow',
  "onPress={() => router.push('/journey')}",
]) requireText(recognition, fragment, 'My Achievements reference redesign must retain artwork, data and navigation.');
for (const unwanted of ['{item.body}', 'styles.remaining', 'styles.track', 'styles.fill', 'progressCaption']) {
  if (recognition.includes(unwanted)) throw new Error('My Achievements contains obsolete layout: ' + unwanted);
}
const recognitionAchievement = recognition.slice(recognition.indexOf('{data.items.map'), recognition.indexOf('{next ? ('));
if (!recognitionAchievement.includes('styles.earnedPill') || !recognitionAchievement.includes('styles.date')) {
  throw new Error('Each achievement must show its achieved badge and date.');
}

// The 60-Second Learn screen uses the approved compact, solid navy header.
for (const fragment of [
  'hideTopBar navyStatusBar bottomNavigationNavy',
  '<PartnerCaseBottomNavigation activeTab="More" />',
  'accessibilityLabel="Back"',
  '<Ionicons name="arrow-back" size={22} color="#FFFFFF" />',
  "require('../assets/partner/learn-stopwatch-reference.png')",
  '60-Second Learn</Text>',
  'Learn • Practice • Grow',
  "backgroundColor: '#0A234A'",
  'height: 64,',
  'headerArtwork: { width: 27, height: 33 }',
  "referenceTitle: { color: '#FFFFFF', fontSize: 15",
  "headerSubtitle: { color: '#C1D0E7', fontSize: 10",
  'headerAction: { width: 32, minHeight: 44',
]) requireText(learn, fragment, '60-Second Learn must use the compact navy stopwatch header and retain navigation.');
for (const removed of ['styles.headerGlow', 'styles.headerCurve', 'headerGlow: {', 'headerCurve: {', "backgroundColor: '#07347C'"]) {
  if (learn.includes(removed)) throw new Error('Compact Learn header must not include decorative blue curves: ' + removed);
}

// Learn matches the approved reference: independent white options, single-choice radio
// selection and explicit submission. Preserve learning progress while feedback expires after one second.
const learnSectionStart = learn.indexOf('<View style={styles.questionSection}>');
const learnSectionEnd = learn.indexOf('<View style={styles.optionsList}', learnSectionStart);
if (learnSectionStart < 0 || learnSectionEnd < 0) throw new Error('Learn reference question card or separate option list missing.');
const learnSection = learn.slice(learnSectionStart, learnSectionEnd);
for (const required of [
  '<View style={styles.questionHeadingRow}>',
  '<Ionicons name="bulb"',
  '<Text style={styles.questionMeta}>TODAY’S QUESTION</Text>',
  '<Text style={styles.question}>{data.card.prompt}</Text>',
  'styles.headingUnderline',
]) requireText(learnSection, required, 'Learn reference question card missing essential content.');
for (const required of [
  'optionsList: { marginTop: 17, gap: 10 }',
  "backgroundColor: '#FFFFFF'",
  'borderRadius: 21',
  'data.card.options.map',
  'accessibilityRole="radio"',
  'accessibilityState={{ disabled: Boolean(data.answered_today || submitting), checked: Boolean(isSelected) }}',
  'onPress={() => setSelectedOptionKey(option.key)}',
  'styles.radioOuter',
  'styles.radioOuterSelected',
  'styles.radioCenter',
  'async function submitAnswer()',
  'submitPartnerLearningAnswer(data.card.id, selectedOptionKey)',
  'accessibilityLabel="Submit Answer"',
  'disabled={!selectedOptionKey || submitting}',
  'onPress={() => void submitAnswer()}',
  'styles.lightbulbCircle',
  'styles.statsDivider',
  'styles.footnoteTitle',
  '<Stat value={data.stats.attempted_days} label="Learning days"',
  '<Stat value={data.stats.total_attempts} label="Cards completed"',
  'disabled={Boolean(data.answered_today || submitting)}',
  'const [showAnswerFeedback, setShowAnswerFeedback] = useState(false)',
  'const timeout = setTimeout(() => setShowAnswerFeedback(false), 1000)',
  'return () => clearTimeout(timeout)',
  'setShowAnswerFeedback(true)',
  '{answer && showAnswerFeedback ? (',
]) requireText(learn, required, 'Learn must retain progress, explicit submission and non-repeating one-second feedback.');
if (learn.includes('{answer ? (') || learn.includes('explanationExpanded ? (')) {
  throw new Error('Previously submitted answers must not permanently show feedback');
}
for (const removed of [
  'styles.questionCard', 'styles.topStrip', 'styles.streak', 'styles.badgeColumn',
  'correct_answers', 'You selected:', 'GOOD TO KNOW', 'NICE WORK', 'styles.selectedText', 'styles.answerEyebrow',
  'styles.categoryPill', 'styles.optionDivider', 'styles.optionsCard', 'onPress={() => choose(option.key)}',
]) if (learn.includes(removed)) throw new Error('Learn contains obsolete layout or immediate-submit behavior: ' + removed);

// Learning counters precede the question. Unanswered cards use a two-button
// action row with Cancel on the left, and the tip immediately below it.
const learnStatsAt = learn.indexOf('<View style={styles.statsCard}>');
const learnQuestionAt = learn.indexOf('<View style={styles.questionSection}>');
const learnOptionsAt = learn.indexOf('<View style={styles.optionsList}');
const learnActionsAt = learn.indexOf('<View style={styles.answerActions}>');
const learnTipAt = learn.indexOf('<View style={styles.footnote}>');
if (!(learnStatsAt >= 0 && learnStatsAt < learnQuestionAt && learnQuestionAt < learnOptionsAt
  && learnOptionsAt < learnActionsAt && learnActionsAt < learnTipAt)) {
  throw new Error('Learn must show progress above Today’s Question and Learning Tip below the action buttons.');
}
const learnActions = learn.slice(learnActionsAt, learnTipAt);
for (const required of [
  'accessibilityLabel="Cancel learning answer"',
  'onPress={() => router.back()}',
  'accessibilityLabel="Submit Answer"',
  'styles.cancelButton', 'styles.submitButton',
]) requireText(learnActions, required, 'Learn actions must preserve Cancel-left and Submit-right behaviors.');
if (!(learnActions.indexOf('styles.cancelButton') < learnActions.indexOf('styles.submitButton'))) {
  throw new Error('Cancel must appear to the left of Submit Answer.');
}
requireText(learn, "answerActions: { flexDirection: 'row'", 'Learn actions must share one horizontal row.');

// MISP must provide precise field-level errors, not a generic all-fields alert.
const mispForm = read('components/misp-partner-form.tsx');
for (const fragment of [
  "key==='aadhaar_number'?value.replace(/\\D/g,'').slice(0,12)",
  "field.key==='aadhaar_number'?12",
  'DP Aadhaar Number must contain exactly 12 digits.',
  'IFSC format is invalid.',
  'Account Number must contain 6 to 20 digits.',
  'validateMisp(form)',
  'setFieldErrors(firstInvalid?{[firstInvalid]:errors[firstInvalid]}:{})',
  'mispFieldOrder.find(key=>errors[key])',
  "partnerAlert(`${label} invalid`,errors[firstInvalid]",
  'fieldErrors[field.key]&&styles.invalidInput',
  'styles.fieldError',
]) requireText(mispForm, fragment, 'MISP must validate individual fields, accept 12 Aadhaar digits and show exact errors.');
if (mispForm.includes("partnerAlert('Check MISP details'")) throw new Error('MISP must not show the old generic validation popup.');

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
requireText(more, "<PartnerProfileMenuIcon kind={iconKind} size={42} />", 'Partner Profile/More icons including Policy Intake and Case Register must share the same 42px size.');


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
requireText(profileMenuIcon, 'styles.glyphDepth', 'Partner Profile icons must show layered dimensional glyph depth.');
requireText(profileMenuIcon, 'styles.glyphFace', 'Partner Profile icons must show a visible dimensional front face.');
requireText(profileMenuIcon, 'styles.topRim', 'Partner Profile icons must retain a softly illuminated raised tile.');
requireText(profileMenuIcon, 'styles.badgeShine', 'Partner Profile icon badge must retain native 3D highlights.');
requireText(profileMenuIcon, "borderTopColor: '#FFFFFF'", 'Partner Profile icons must retain a light beveled tile rim.');
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
requireText(business, 'Math.round((premium / top) * (compact ? 45 : 60))', 'Trend bars must scale to the same rounded axis ceiling as labels.');
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
requireText(business, "setTrendCustomOpen(true);", 'Selecting Custom must open a modal without replacing the last applied trend.');
requireText(business, 'setTrendCustomOpen(false);', 'Selecting a non-custom Month-wise Trend period must close the custom range panel.');
requireText(business, 'visible={trendCustomOpen}', 'Month-wise Trend custom range must render as an overlay popup, not a separate page card.');
requireText(business, 'directDateSelection', 'Trend popup must use a direct-select calendar.');
const rangeCard = read('components/partner-business-range-summary.tsx');
for (const phrase of ["directDateSelection?: boolean", "directSelect={directDateSelection}", "calendarVariant={directDateSelection ? 'dark' : 'default'}"]) requireText(rangeCard, phrase, 'Only the Trend custom popup should opt into the reference-style calendar: ' + phrase);
for (const phrase of ["calendarVariant?: 'default' | 'dark'", "calendarVariant === 'dark'", "styles.darkSelectedHeading", "styles.darkDaySelected"]) requireText(datePicker, phrase, 'Dark calendar must retain selected date, month navigation and one-tap selection: ' + phrase);

requireText(business, "setTrendRange('custom');", 'Trend period changes to Custom only after the successful range response.');
if (business.includes('Apply a custom range to view its net premium total.')) throw new Error('Do not replace the existing graph while the user chooses a custom date range.');
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
// the approved Policy Details redesign gives these four actions their own subtle color tiles.
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
for (const tone of ['quickDocument', 'quickRenewal', 'quickClaim', 'quickCustomer']) requireText(policyDetail, `styles.${tone}`, `Quick Actions must use approved colored tile: ${tone}`);
requireText(policyDetail, 'numberOfLines={1} adjustsFontSizeToFit', 'Action labels must use single-line auto fitting.');
requireText(policyDetail, 'styles.quickActionIcon', 'Existing 3D icons must render inside colored action tiles.');
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
requireText(policyDetail, "policySectionHeaderTint: { backgroundColor: '#EDE4FF' }", 'Policy Overview uses the approved lavender tint.');
requireText(policyDetail, "premiumDisclosure: { minHeight: 50, marginHorizontal: 0, marginBottom: 8, paddingHorizontal: 11, borderRadius: 0, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#DCF6F0' }", 'Premium breakup uses the approved mint header.');
requireText(policyDetail, "commercialRow: { minHeight: 50, marginHorizontal: 0, marginBottom: 8, paddingHorizontal: 11, borderRadius: 0, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFF0DC' }", 'Sales ownership uses the approved amber header.');

requireText(policyDetail, "iconKind === 'renew-policy'", 'Renew Policy retains its own icon choice.');
requireText(policyDetail, "iconKind === 'raise-claim'", 'Raise Claim retains its own icon choice.');
requireText(policyDetail, 'PartnerAssets.actions.quickRenewals', 'Renew Policy uses the exact Home Renewals icon.');
requireText(policyDetail, 'PartnerAssets.actions.quickClaims', 'Raise Claim uses the exact Home Claims icon.');
if (policyDetail.includes('quickGlyph')) throw new Error('Generic vector icons must not replace the Home action artwork.');
if (policyDetail.includes('Ionicons name={iconName} size={32}')) throw new Error('Flat quick-action glyph must not return.');

for (const obsolete of ['label="Policy Intake"', 'label="Add Policy"', 'label="Case Register"', 'label="Add Partner"', 'styles.quickBlue', 'borderRightColor']) {
  if (policyDetail.includes(obsolete)) throw Error('Policy Details must not replace original actions or introduce unrelated tiles: ' + obsolete);
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

requireText(customerDetail, "profile: { backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'flex-start'", 'Customer Details identity strip must be white with name aligned to avatar top.');
requireText(customerDetail, 'numberOfLines={1} ellipsizeMode="tail"', 'Long customer names must truncate to one line.');
requireText(customerDetail, "name=\"checkmark-circle\" size={19} color=\"#0CB76B\"", 'Verified customer icon remains alongside name.');
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
requireText(support, '<PartnerProfileMenuIcon kind="support" size={60} />', 'Support hero must use the More page 3D headset icon.');
for (const fragment of [
  'styles.heroTopRow',
  'styles.heroRight',
  'formatUpdatedAt(data.generated_at)',
  'styles.updatedLine',
  'styles.heroActions',
  'name="chatbubble-ellipses"',
  'name="document-text"',
]) requireText(support, fragment, 'Support hero must retain the right-aligned generated-at label and both shortcut icons.');
const supportRightIndex = support.indexOf('<View style={styles.heroRight}>');
const supportUpdatedIndex = support.indexOf('<View style={styles.updatedLine}>', supportRightIndex);
const supportActionsIndex = support.indexOf('<View style={styles.heroActions}>', supportRightIndex);
if (!(supportRightIndex > 0 && supportUpdatedIndex > supportRightIndex && supportActionsIndex > supportUpdatedIndex)) {
  throw new Error('Support right column must show updated-at above the two icon shortcuts.');
}
requireText(support, "textAlign: 'right', transform: [{ translateY: 0 }]", 'Support updated-at label should align with the left title without moving the icon row.');
for (const fragment of [
  "Platform.OS === 'ios' ? 1 : 2",
  "adjustsFontSizeToFit={Platform.OS === 'ios'}",
  "heroTitleIos: { fontSize: 11.2, lineHeight: 15 }",
  "heroIconShell: { height: 60, width: 60",
  "marginRight: 12, zIndex: 1, transform: [{ translateY: -6 }]",
  "heroInformation: { flex: 1, minWidth: 0, minHeight: 60, justifyContent: 'center', transform: [{ translateY: -6 }]",
  'name="chatbubble-ellipses" size={18}',
  'name="document-text" size={18}',
  'heroActionBubble: { width: 25, height: 25',
]) requireText(support, fragment, 'Support first section must retain compact Android icons and single-line iOS title: ' + fragment);
if (support.includes('PartnerAssets.actions.supportVerified')) throw new Error('Support hero must not reuse the old analytics icon.');
if (support.includes('asset={PartnerAssets.emptyStates.supportResolved}')) throw new Error('Support-unavailable errors must not misuse the support-resolved artwork.');
requireText(settings, 'PartnerAssets.status.settings', 'Settings must retain branded Check for updates artwork.');
const settingsSectionHeader = read('components/ui/partner-section-header.tsx');
if (settingsSectionHeader.includes('settingsAccent')) throw new Error('Settings headings must not display a decorative purple dash.');
requireText(settingsSectionHeader, 'fontWeight: \'900\', letterSpacing: 0.35', 'Settings headings must be bold and readable.');
for (const heading of ['Account', 'Device security', 'Privacy', 'App information']) {
  requireText(settings, `title="${heading}" settingsHeading compact`, `Settings must retain bold ${heading} heading.`);
}
requireText(settings, 'subtitle="Manage your profile details"', 'Profile row must show reference helper copy.');
requireText(settings, 'subtitle="Get help and assistance"', 'Support row must show reference helper copy.');
requireText(settings, "linkIcon: { width: 40, height: 40", 'Settings must use larger reference-style lavender icons.');

requireText(settings, 'icon="person-outline" title="Profile & registration"', 'Settings Account profile row must use the professional profile icon.');
requireText(settings, 'icon="headset-outline" title="Support"', 'Settings Account support row must use the professional support icon.');
requireText(settings, "controlTitle: { color: '#141C3F', fontSize: 14", 'Device security titles must use a dedicated non-flexing title style.');
requireText(settings, "controlCopy: { flex: 1, minWidth: 0, justifyContent: 'center' }", 'Device security title and helper copy must remain a compact vertical stack.');
requireText(settings, "controlSubtitle: { marginTop: 2", 'Device security helper text must sit directly below its row title.');
requireText(settings, 'controlRow: { minHeight: 60', 'Device security rows must keep the compact joined-list height.');
requireText(settingsSectionHeader, 'settingsRowCompact: { marginTop: 12, marginBottom: 7, minHeight: 22 }', 'Settings headings have balanced spacing to fit the update action on a phone.');
for (const compactStyle of [
  'linkRow: { minHeight: 58',
  'infoRow: { minHeight: 37',
  'linkIcon: { width: 40, height: 40',
  'updateMenu: { marginTop: 7 }',
  'note: { marginTop: 7, minHeight: 40',
]) requireText(settings, compactStyle, 'Comfortable Settings layout contract: ' + compactStyle);
for (const item of ['Profile & registration', 'Support', 'Biometric re-entry', 'Partner notifications', 'Privacy Policy', 'Request account deletion', 'Check for updates']) {
  requireText(settings, item, 'Compact layout must preserve Settings action: ' + item);
}
for (const detail of ['INSUREIT Partner', 'Version', 'Runtime', 'Automatic on launch']) requireText(settings, detail, 'Compact app information must retain ' + detail);


for (const fragment of [
  'marginHorizontal: 0,',
  'marginTop: 12,',
  'borderRadius: 24,',
  'minHeight: 124,',
  'sectionTitleRule: { flex: 1, height: 2',
  'details: { gap: 11, paddingBottom: 18 }',
  'minHeight: 98,',
  'detailVerticalRule:',
  'detailArtworkLeft:',
  'detailArtworkRight:',
  'registrationIcons: Record<string, ImageSourcePropType>',
  'registrationSideIcons: Record<string, ImageSourcePropType>',
  "profile-id-check-3d.png",
  "registration-3d.png",
  "employee-id-3d.png",
  "designation-bag-3d.png",
  "role-team-3d.png",
  "employee-id-detail-3d.png",
  "designation-briefcase-detail-3d.png",
  "role-shield-detail-3d.png",
  'onPress={() => void changeProfilePhoto()}',
  'value={identity.employee_code}',
  'value={identity.designation',
  'value={humanize(identity.role)}',
  '<PartnerCaseBottomNavigation activeTab="More" />',
]) requireText(profile, fragment, 'Refreshed Profile layout must retain registration details and key actions: ' + fragment);
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
for (const impactMarker of [
  'function ImpactIcon(',
  'PartnerAssets.actions.impactBlue3dCar',
  'PartnerAssets.actions.impactCustomerDetail',
  'PartnerAssets.actions.impactCustomerAdded',
  'PartnerAssets.actions.impactPolicyDocument',
  'PartnerAssets.actions.impactAddPolicy',
  'PartnerAssets.actions.quickClaims',
  'PartnerAssets.actions.businessPerformance',
  'PartnerAssets.actions.impactCustomerAdded',
  "borderBottomWidth: 1, borderBottomColor: '#D5DDE9'",
  'styles.monthDivider',
  'styles.monthStatDivider',
  'styles.cardDetails',
  '<ImpactIcon art={art} size={40} plain footprint />',
  '<ImpactIcon art={art} size={54} plain />',
]) requireText(impact, impactMarker, `Impact reference layout is missing ${impactMarker}.`);
if (impact.includes('icon={icon}') || impact.includes('styles.cardLeft')) throw new Error('Impact must keep blue artwork left with metric and label stacked to its right.');
requireText(impact, '<MonthStat art="monthly-policy" label="Policies"', 'Monthly policies must use the distinct Add Policy reference artwork.');
requireText(impact, '<ImpactIcon art="premium" size={49} plain />', 'Gross premium artwork must stay at 49px.');
requireText(impact, '<ImpactIcon art={art} size={54} plain />', 'Only monthly Policies and Customers artwork grows to 54px.');
requireText(impact, 'onPress={() => router.push(\'/journey\')}', 'Compact Journey card remains fully clickable.');
requireText(impact, 'marginTop: 12, minHeight: 96, overflow: \'hidden\'', 'Journey CTA must be compact.');
requireText(impact, 'journeyIconCircle: {', 'Journey art remains in the compact card.');
requireText(impact, 'style={styles.journeyCarScene}', 'Journey car artwork remains.');
if (impact.includes('styles.journeyArrowCircle') || impact.includes('journeyArrowCircle:') || impact.includes('name="arrow-forward"')) {
  throw new Error('Journey CTA must not render the removed circular right arrow.');
}

requireText(impact, '<ImpactCard art="policy" value={data.lifetime_policies}', 'Policy book must use the Policy Document reference artwork.');
for (const [fragment,reason] of [
  ['styles.footprintCard', 'Protection footprint is contained in one combined white card'],
  ['styles.footprintDivider', 'Protection footprint rows use internal thin dividers'],
  ['impactCard: {minHeight: 49', 'Protection footprint rows are compact'],
  ["textAlign: 'right', minWidth: 44", 'Footprint counts must align right before the chevron'],
  ["heroCoverageBadge: {width: 106", 'Coverage badge must align right without overlapping the value'],
  ["monthStat: { flex: 1, minWidth: 0, minHeight: 64", 'Monthly statistics must remain compact'],
  ['<Text style={styles.premiumLabel}>Gross premium</Text>', 'Gross premium label must be visible'],
  ['<ImpactIcon art={art} size={40} plain footprint />', 'Footprint illustrations must share the compact slot'],
  ['numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}', 'Footprint labels must remain on one line'],
  ['styles.impactLabel} numberOfLines={1}', 'Label must precede the numeric value'],
  ["fontSize: 17, lineHeight: 21", 'Footprint values use the compact font'],
  ['styles.heroCar', 'First banner includes enlarged existing 3D car'],
  ['styles.heroShield', 'First banner includes shield artwork'],
  ['Total Protection Value', 'First banner includes reference title'],
  ["Your coverage{'\\n'}this month", 'First banner includes the explicit two-line coverage badge'],
  ["backgroundColor: '#F0F6FF'", 'First banner retains reference light blue background'],
  ["borderBottomWidth: 1, borderBottomColor: '#D5DDE9'", 'First banner needs a straight full-width bottom divider'],
]) requireText(impact, fragment, 'Protection reference missing: ' + reason);
for (const [fragment, reason] of [
  ["heroDetails: {flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center'", 'Protection heading and amount must vertically center beside the car'],
  ["heroValueGroup: {flex: 1, minWidth: 0, gap: 0}", 'Protection heading and amount must have zero extra gap'],
  ["fontSize: 23, lineHeight: 28, fontWeight: '800', marginTop: 0", 'Protection amount must be reduced without top margin'],
  ['<Text style={styles.heroCoverageText} numberOfLines={2}>', 'Top-right coverage badge may use two lines'],
  ["heroTopRow: {flexDirection: 'row', alignItems: 'center'", 'Badge and value must share a vertically centered row'],
  ["footprintIconSlot: {flexShrink: 0, alignItems: 'center', justifyContent: 'center'}", 'Footprint icons must have standardized centered slots'],
  ["const artworkSize = footprint ? (footprintArtworkSize[art] ?? 36) : Math.round(size * 0.89)", 'Footprint artwork sizes must be normalized individually within the fixed slot'],
  ["heroCoverageBadge: {width: 106, flexShrink: 0, flexDirection: 'row', alignItems: 'center'", 'Coverage badge must be centered and stay compact'],
  ["customer: 40", 'Customer footprint artwork must use its normalized scale'],
  ["policy: 40", 'Policy footprint artwork must use its normalized scale'],
  ["claim: 31", 'Claims footprint artwork must not overpower the other icons'],
  ['<ImpactIcon art={art} size={54} plain />', 'Monthly Policies and Customers icons must be enlarged'],
  ["Platform.OS === 'android' && art === 'monthly-policy'", 'Android monthly policy icon must have a platform-specific visible asset'],
  ["require('../assets/partner/actions/add-policy-reference.png')", 'Android monthly policies must use an RGBA illustration'],
  [": IMPACT_ART[art]", 'Existing iOS icon assignments must remain'],
]) requireText(impact, fragment, 'Protection Delivered update missing: ' + reason);
if (impact.includes('styles.grid') || impact.includes('grid: { flexDirection:')) throw new Error('Protection footprint must not restore the two-column grid.');
if (impact.includes('borderRadius: 18, minHeight: 94')) throw new Error('Impact top summary must stay full-width and flat, not a rounded card.');
requireText(impact, 'styles.heroDivider', 'Impact final reference keeps the thin vertical divider between car and amount.');
requireText(impact, 'marginHorizontal: -partnerTheme.spacing.lg, minHeight: 96', 'Impact summary must connect to the header and span the full viewport.');
for (const impactRoute of ["router.push('/customers')", "router.push('/(tabs)/policies')", "router.push('/(tabs)/claims')", "router.push('/business-report')", "router.push('/journey')"]) requireText(impact, impactRoute, `Impact clickable-card route is missing ${impactRoute}.`);
for (const tinySize of ['fontSize: 7.5', 'fontSize: 8.5', 'fontSize: 8,']) if (impact.includes(tinySize)) throw new Error(`Impact must not regress to tiny typography: ${tinySize}`);
requireText(journey, 'PartnerAssets.status.journey', 'Journey timeline and empty state must use journey artwork.');
requireText(journey, 'navyTopBar navyStatusBar bottomNavigationNavy', 'My Progress must use navy header and status bar.');
requireText(journey, '<PartnerScreen title="My progress" artwork={require(\'../assets/partner/icons/more-journey-3d-new.png\')} onBack={() => router.back()}', 'My Progress header must use the selected 3D journey asset and no eyebrow.');
if (journey.includes('eyebrow="MY JOURNEY"')) throw new Error('My Progress must not show MY JOURNEY above its title.');
requireText(journey, 'bottomNavigation={<PartnerStackBottomNavigation activeTab="home" />}', 'My Progress must have the permission-gated Home bottom navigator.');
if (journey.includes('name="locate-outline"')) throw new Error('Milestone top-right circle icon must be removed.');
if (/calendar-outline|PartnerPolicyCalendarDialog|calendarOpen|setTimelineDate|\[timelineDate,|calendarButton|dateFilterRow|Clear timeline date filter/.test(journey)) throw new Error('Journey timeline must not include the removed calendar/date picker or its unused state.');
requireText(journey, "filter === 'all' || milestoneCategory(item.kind, item.title) === filter", 'Journey timeline must retain category filtering.');
requireText(journey, "hero: { marginHorizontal: -partnerTheme.spacing.lg, borderBottomWidth: 1, borderBottomColor: '#D7DFEB'", 'Milestone summary must connect to the navy header and span the viewport with a straight bottom divider.');
if (/next30Row|NEXT 30 DAYS|getPartnerRenewalSummary|renewalSummary|heroSectionDivider/.test(journey)) throw new Error('My Progress must not render or request the removed Next 30 Days section.');
requireText(journey, 'numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} accessibilityLabel={data.next_milestone.title}', 'Milestone heading must fit a single row.');
requireText(journey, "progressCircle: { width: 40, height: 40", 'Circular progress diameter must match the approved compact 40px design.');
requireText(journey, 'numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Milestone progress', 'Milestone progress label must remain on one line.');
requireText(journey, "progressColumn: { width: 86", 'Milestone progress column must shrink while keeping the title legible.');
requireText(journey, "progressCircleText: { color: '#6954D6', fontSize: 10", 'Circle percentage label must be 10px within the 40px ring.');
requireText(journey, 'label="Customers" artwork={PartnerAssets.actions.quickCustomers}', 'Customers summary must retain its existing illustration and link.');
requireText(journey, 'styles.summaryDivider', 'Combined summary must have two visible internal separators.');
requireText(journey, "summaryItem: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 5", 'All three summary metrics must left-align their icon and stacked text within equal-width segments.');
requireText(journey, "summaryArtwork: { width: 27, height: 29", 'Existing illustrated icons must remain compact.');
requireText(journey, "paddingHorizontal: 5, paddingVertical: 4, gap: 16", 'Summary icons must have 16px horizontal spacing from labels.');
requireText(journey, "transform: [{ translateY: -6 }]", 'Keep-going subtitle must move up independently of the progress label.');
requireText(journey, "timelineSection: { marginTop: 13 }", 'Timeline must have its own outside heading spacing.');
const timelineHeadingIndex = journey.indexOf('<Text style={styles.sectionTitle}>Journey timeline</Text>');
const timelineCardIndex = journey.indexOf('<View style={styles.card}>', timelineHeadingIndex);
const timelineSectionIndex = journey.indexOf('<View style={styles.timelineSection}>');
if (!(timelineSectionIndex >= 0 && timelineHeadingIndex > timelineSectionIndex && timelineCardIndex > timelineHeadingIndex)) {
  throw new Error('Journey timeline heading must precede, not sit inside, its card.');
}
if (journey.includes('styles.cardHeading')) throw new Error('Journey timeline must not restore its in-card heading.');
requireText(journey, "summaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: '#A6B3C6'", 'Full-width combined summary must retain separators.');
requireText(journey, "paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, backgroundColor: '#FFFFFF'", 'Milestone section vertical spacing must remain compact.');
requireText(journey, "left: 20 + Math.sin(angle) * 15.5", 'Ring segments must match the 40px circle geometry.');
requireText(journey, 'numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={item.subtitle}', 'Timeline descriptions must truncate to one line.');
requireText(journey, 'numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={item.title}', 'Timeline titles must truncate to one line.');
requireText(journey, "heroTitle: { color: '#17233A'", 'Milestone title must stay legible on white.');
requireText(journey, 'function CircularMilestoneProgress(', 'Milestone must have an accessible circular percentage indicator.');
requireText(journey, 'styles.heroHeadline', 'Milestone title and circular progress must share a compact header.');
for (const [fragment,purpose] of [
  ["styles.milestoneVerticalDivider", 'Milestone reference requires a thin vertical purple divider'],
  ["styles.milestoneEyebrow", 'Show uppercase NEXT MILESTONE eyebrow'],
  ["Keep going, you're on track!", 'Preserve reference subtitle'],
  ["styles.milestoneCopy", 'Left-align reference milestone label, title and subtitle'],
]) requireText(journey,fragment,purpose);

requireText(journey, 'styles.milestoneBottomRow', 'Subtitle and progress label must be on the same aligned horizontal row.');
requireText(journey, "milestoneBottomRow: { flexDirection: 'row', alignItems: 'center'", 'Subtitle and progress label must share the same baseline row.');
requireText(journey, 'styles.milestoneTopRow', 'Circle must remain aligned with the milestone title block.');
requireText(journey, '20 - Math.cos(angle) * 15.5', 'Progress segments must fit the reduced circular indicator.');
requireText(journey, 'styles.progressCircle', 'Milestone progress ring must replace the separate horizontal bar.');
requireText(journey, 'CIRCLE_SEGMENTS.map(', 'Progress ring must render its percentage-based circular segments.');
requireText(journey, 'accessibilityRole="progressbar"', 'Circular milestone progress must remain accessible.');
requireText(journey, 'Math.round(progress * 100)', 'Real progress percentage must be retained.');
for (const required of [
  'PartnerAssets.status.achievement',
  'PartnerAssets.actions.quickPolicyIntake',
  'PartnerAssets.actions.quickCustomers',
  'PartnerAssets.actions.quickClaims',
  'PartnerAssets.actions.payoutGrowth',
  'function journeyMilestoneArtwork(',
  'styles.summaryArtwork',
  'styles.achievementArtwork',
]) requireText(journey, required, 'My Progress must use bundled illustrated artwork: ' + required);
if (journey.includes('journeyMilestoneIcon(') || journey.includes('styles.summaryIcon')) throw new Error('My Progress must not restore vector milestone or summary icons.');
requireText(journey, 'style={styles.timelineArtwork}', 'Timeline rows must show their illustrated category icon.');
requireText(journey, "require('../assets/partner/status/journey-trophy-reference.png')", 'Use the exact supplied trophy image, locally bundled.');
requireText(journey, "summaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: '#A6B3C6'", 'Summary metrics must have visible vertical dividers.');
requireText(journey, "filterLabelRow: { width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 34", 'Timeline filters must fill equal-width tabs.');
requireText(journey, "borderRightColor: '#A6B3C6'", 'Timeline tabs need visible vertical dividers.');
requireText(journey, "filterUnderlineActive: { height: 3, backgroundColor: '#2488ED' }", 'Selected tab must have a blue underline.');
requireText(journey, 'styles.outsideHeading', 'Achievements heading and badge must move outside the card.');
requireText(journey, "summary: { marginTop: 12, paddingTop: 8, borderTopWidth: 1", 'Three metrics must remain inside the milestone card with their own divider.');
requireText(journey, "summaryDetails: { flexShrink: 1, minWidth: 0, alignItems: 'flex-start'", 'Summary label and count must center within equal-width metric segments.');
if (journey.indexOf('<Text style={styles.achievementDate}>') < journey.indexOf('<Text style={styles.achievementTitle}')) throw new Error('Isolated 3D-style achievement artwork must precede a one-line title, with the date underneath, as in the reference.');
requireText(journey, "achievementIcon: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center', marginBottom: 5, backgroundColor: 'transparent' }", 'Achievement art must stay isolated without background tiles.');
requireText(journey, 'achievementArtwork: { width: 48, height: 48 }', 'Isolated achievement artwork should match the compact reference size.');
requireText(journey, "if (value.includes('claim')) return PartnerAssets.actions.quickClaims", 'Claims achievements must retain the existing illustrated claim artwork.');
requireText(journey, "if (value.includes('customer')) return PartnerAssets.actions.quickCustomers", 'Customer achievements must retain the existing illustrated customer artwork.');
if (journey.includes('styles.progressTrack') || journey.includes('styles.heroArtwork')) throw new Error('Obsolete horizontal milestone bar or flag icon must be removed.');
for (const unwanted of ['NEXT CUSTOMER MILESTONE', 'Customers achieved', 'more customers to unlock', 'styles.heroNumbers', 'styles.heroBottom']) {
  if (journey.includes(unwanted)) throw new Error('My Progress must not restore removed milestone secondary content: ' + unwanted);
}
for (const required of ['styles.summaryDetails', 'numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={item.title}', "backgroundColor: '#E9E1FF'", 'styles.timelineArtwork', 'styles.timelineDivider', 'styles.timelineBody', 'styles.timelineDate', 'item.subtitle ?']) {
  requireText(journey, required, 'My Progress must preserve its compact summary, achievements and remarks-style timeline: ' + required);
}
for (const unwanted of ['styles.rail', 'styles.line']) {
  if (journey.includes(unwanted)) throw new Error('Journey timeline must not restore the vertical icon rail: ' + unwanted);
}

for (const tinySize of ['fontSize: 7.5', 'fontSize: 8.5', 'fontSize: 8,']) if (journey.includes(tinySize)) throw new Error(`Journey must not regress to tiny typography: ${tinySize}`);
requireText(weeklyStory, 'PartnerAssets.actions.quickRenewals', 'Your Week uses the Renewal Work Queue reference icon for upcoming work.');
if (weeklyStory.includes('styles.clockBadge') || weeklyStory.includes('name="time" size={12}')) throw new Error('Your Week must not overlay an extra clock badge on the renewal icon.');
requireText(weeklyStory, "backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DCE9FA'", 'Your Week This Week pill must use the white treatment.');
requireText(weeklyStory, 'minWidth: 92, flexShrink: 0', 'Your Week This Week pill must not clip the Week label on compact widths.');
requireText(weeklyStory, "backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#A6DFD1'", 'Your Week reflection card retains a white surface with the new mint-green border.');
requireText(weeklyStory, "shadowColor: '#36AA97'", 'Your Week reflection card uses a subtle green shadow.');
requireText(weeklyStory, 'style={styles.comparisonSectionHeading}', 'Your Week comparison title appears above the card.');
requireText(weeklyStory, "style={styles.compareHeader}", 'Your Week range selector remains inside the comparison card.');
requireText(weeklyStory, 'style={styles.headingRule}', 'Your Week Coming next heading has a horizontal accent rule.');
requireText(weeklyStory, 'name="calendar-outline" size={23} color="#168C7B"', 'Your Week Coming next heading uses a green calendar icon.');
requireText(weeklyStory, 'accessibilityState={{ expanded: comparisonOpen }}', 'Your Week comparison range control must expose expanded state.');
requireText(weeklyStory, '[7, 14, 30].map((days)', 'Your Week comparison range control must offer 7, 14 and 30 day options.');
requireText(weeklyStory, 'getPartnerBusinessRange(range.from, range.to)', 'Your Week non-default comparison ranges must load scoped business-range data.');
for (const tinySize of ['fontSize:7.5', 'fontSize:8.5', 'fontSize:8,', 'fontSize:9,']) if (weeklyStory.includes(tinySize)) throw new Error(`Your Week must not regress to tiny typography: ${tinySize}`);
for (const recognitionAsset of ['status.achievement', 'actions.renewals', 'status.journey']) requireText(recognition, `PartnerAssets.${recognitionAsset}`, `Recognition is missing ${recognitionAsset} artwork.`);
requireText(recognition, "if (icon === 'learn') return require('../assets/partner/status/learning-rhythm-3d.png');", 'Learning rhythm must use its dedicated 3D achievement artwork.');
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


// Lifecycle filtering remains in the existing advanced sheet, opened from the bottom-center Sort button.
requireText(policies,'<PartnerSearchField','Policies search must remain available');
requireText(policies,'sheetStatuses.map','Lifecycle filters must remain in Sort by');
for (const removed of ['statusMenuOpen','openStatusMenu','statusButtonRef','selectedStatus.label','visible={statusMenuOpen}']) {
  if (policies.includes(removed)) throw new Error('Remove redundant search-bar status dropdown: '+removed);
}
requireText(policies,'searchField: {','Search field should fill the available search row');
requireText(policies,'style={({ pressed }) => [styles.filterButton, pressed && styles.summaryChipPressed]}','Policies search must display the interactive right-side Filter button.');
requireText(policies,'<Ionicons name="filter-outline" size={18} color="#3156B8" />','Policies must use the exact Claims filter icon.');
requireText(policies,'<Text style={styles.filterText}>Filter</Text>','Inline filter label must match Claims.');

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
for (const item of ["useState<PartnerPolicyBusinessLine>('all')","onPress={openBusinessLineMenu}","visible={lineMenuOpen}","onPress={()=>selectBusinessLine(option.value)}","businessLine,","policies:list:${period}:${lifecycle}:${businessLine}:"]) {
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
for(const phrase of ["setSortSheetOpen(true)","Sort by","MTD","All","sheetStatuses.map","Apply Filter","setPeriod(draftPeriod)","setLifecycle(draftLifecycle)","draftStatusCounts?.[option.value]","style={({ pressed }) => [styles.filterButton, pressed && styles.summaryChipPressed]}"]) {
  requireText(policies,phrase,'Policy period/status bottom sheet is missing '+phrase);
}
for(const phrase of ["period,","policies:list:${period}:${lifecycle}","[period, lifecycle, debouncedSearch, businessLine, source, rm, fromDate, toDate]","setVisibleLimit(PAGE_SIZE)"]) {
  requireText(policies,phrase,'Period filter must invalidate fetched pages and reset pagination: '+phrase);
}
for(const phrase of ["partner_app_list_policies_by_period","partner_app_policy_period_counts","p_period: period","businessLine === 'all'"]) {
  requireText(periodPolicyLib,phrase,'Period filter must use server-side scoped RPC: '+phrase);
}
for(const phrase of ["partner_app_commercial_scope()","partner_branch_authorized_policy_ids()","v_scope_mode='none'","v_period='all'","Asia/Kolkata","coalesce(b.issuance_date,b.start_date,b.created_at::date)","count(*) filter (where f.lifecycle_status='expired')","REVOKE ALL ON FUNCTION public.partner_app_policy_period_counts"]) {
  requireText(periodSql,phrase,'Period filtering SQL must retain safe scope/count semantics: '+phrase);
}

for(const phrase of ["filterButton: {","minWidth: 68","borderLeftWidth: StyleSheet.hairlineWidth","borderLeftColor: '#D9DFEA'","filterText: { color: '#3156B8'"]) {
  requireText(policies,phrase,'Inline Policies Filter must match the existing Claims search control: '+phrase);
}
requireText(policies,'accessibilityLabel="Filter policies"','Inline Filter must have a useful accessible action label.');
requireText(policies,'accessibilityHint="Opens the same filters as Sort by"','Inline Filter must describe its shared filter sheet.');
requireText(policies,'style={({ pressed }) => [styles.filterButton, pressed && styles.summaryChipPressed]}','Inline Filter must be tappable with press feedback.');
if ((policies.split('onPress={openSortSheet}').length - 1) !== 2) {
  throw new Error('Both search-row Filter and floating Sort must open the same filter popup.');
}
requireText(policies,'accessibilityLabel="Sort and filter policies"','Bottom-center Sort must be accessible.');
requireText(policies,'style={({ pressed }) => [styles.sortFloatingButton','Bottom-center Sort must have a pressed state.');
requireText(policies,'sortFloatingPosition: { position: \'absolute\', bottom: 16','Bottom-center Sort must float above tab navigation.');
requireText(policies,'onPress={openSortSheet}','Floating Sort must open the existing advanced filter bottom sheet');
requireText(policies,'{isFocused && !sortSheetOpen && !lineMenuOpen ? (','Floating Sort must hide behind modal menus.');

for (const phrase of ["cardGap: { height: 5 }","minHeight: 68,","marginHorizontal: 10,","paddingVertical: 8,","insurerLogo: { width: 33, height: 33 }","customerName: { color: '#173A7D', fontSize: 13","policyNumber: { marginTop: 2, color: '#5C6C84', fontSize: 10","statusText: { fontSize: 9"]) {
  requireText(policies,phrase,'Policies cards should be less dense and use more of the available screen: '+phrase);
}

requireText(policies,"let savedPolicyPeriod: PartnerPolicyPeriod = 'all';","Policies must start on All (all time), not MTD");
requireText(policies,"let savedPolicyLifecycle: PartnerPolicyLifecycle = 'all';","Policies must start on All Policies status");
requireText(policies,"useState<PartnerPolicyPeriod>(savedPolicyPeriod)","The Sort by sheet and list must share the selected period");
requireText(policies,"useState<PartnerPolicyLifecycle>(savedPolicyLifecycle)","The Sort by sheet and list must share the selected status");

// The approved four-tab layout retains the period/status controls while adding
// searchable Source and RM and a native date range without resetting status.
for (const phrase of [
  "styles.advancedTabs","key:'period'","key:'source'","key:'rm'","key:'date'",
  "setFilterTab('period')","sheetStatuses.map","styles.sortChoiceCountBadge",
  "styles.advancedFooter","styles.advancedReset","styles.advancedApply",
  "Search source...","Search RM...","PartnerDatePicker directSelect label=\"From\"",
  "PartnerDatePicker directSelect label=\"To\"","onPress={applySortSheet}",
  "maxHeight:windowHeight-Math.max(safeAreaInsets.top,20)-12","sortPeriodSelected:{backgroundColor:'#FFFFFF',borderColor:'#4030AF',borderWidth:1.5}",
  "sortPeriodOption:{flex:1,minHeight:43","sortChoice:{flexDirection:'row',alignItems:'center',gap:11,minHeight:46",
]) requireText(policies,phrase,'The approved four-tab Sort by layout must remain compact: '+phrase);
if (policies.includes("setDraftPeriod(value);setDraftLifecycle('all');")) {
  throw new Error('Changing Period must not reset the selected policy lifecycle');
}
if (policies.includes("SortPurpleGradient") || policies.includes("sortPurpleGradient") || policies.includes('name="checkmark-circle" size={21}')) {
  throw new Error('Sort sheet must not use striped gradient pieces or the period checkmark');
}
