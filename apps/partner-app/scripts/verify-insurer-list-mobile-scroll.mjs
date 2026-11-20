import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const screen = readFileSync(new URL('../app/insurers.tsx', import.meta.url), 'utf8');

// Insurer performance reference: compact full-width date filter, single inline calendar,
// compact pinned insurer names and readable horizontally scrolling authorized financial columns.
assert.match(screen, /function displayInsurerName\(name: string\): string/);
assert.match(screen, /const NAME_ALIASES: Array<\[RegExp, string\]>/);
for (const alias of ['United India', 'New India', 'ICICI Lombard', 'Tata AIG', 'Go Digit'])
  assert.ok(screen.includes(alias), 'Required short name ' + alias);
assert.match(screen, /accessibilityLabel=\{insurer\.name\}/);
assert.match(screen, /numberOfLines=\{2\} ellipsizeMode="tail"/);
assert.doesNotMatch(screen, /BUSINESS PERFORMANCE|headerEyebrow/, 'Unwanted secondary eyebrow and unused style must be removed');
assert.match(screen, /headerCopy: \{ flex: 1, minWidth: 0, justifyContent: 'center' \}/, 'Only title row is vertically centered');
assert.match(screen, /headerTitleRow: \{ flexDirection: 'row', alignItems: 'center', minWidth: 0, minHeight: 51 \}/, 'Icon and title share an aligned row');
assert.match(screen, /source=\{PartnerAssets\.status\.businessGrowth\}/, 'Header uses existing 3D business artwork');
assert.match(screen, /hideTopBar fullWidth/, 'Preserve compact header');
assert.match(screen, /bottomNavigationNavy navyStatusBar/, 'Insurer screen must paint navy top safe area with white iOS status icons');
const asset = readFileSync(new URL('../assets/partner/status/business-growth.png', import.meta.url));
assert.ok(asset.includes(Buffer.from('tRNS')), 'Insurer header 3D icon must have a transparent background');
assert.doesNotMatch(screen, /source=\{PartnerAssets\.actions\.businessPerformance\}/, 'Do not reuse opaque white-tile performance PNG');

assert.match(screen, /accessibilityLabel="Date Range"/, 'Date Range is the only register filter');
assert.match(screen, /styles\.dateRangeTrigger/, 'Full-width date range control remains');
assert.match(screen, /dateExpanded \? \(/, 'Calendar opens immediately beneath Date Range');
assert.match(screen, /calendarCells\.map/, 'Single shared calendar is displayed');
assert.match(screen, /setPickerTarget\('from'\)/, 'Range selects from and to dates');
assert.match(screen, /setPickerTarget\('to'\)/, 'From selection advances to To');
assert.doesNotMatch(screen, /contentContainerStyle=\{styles\.filterRow\}|Sort insurer register|DateTimePicker|dateModalOpen/, 'No financial filter strip, sort modal or native dual picker');
assert.doesNotMatch(screen, /sortButton|searchRow|tableScrollRef|Swipe table sideways/, 'No separate sort button or legacy table');
assert.match(screen, /<ScrollView horizontal showsHorizontalScrollIndicator/, 'Financial columns scroll horizontally as requested');
assert.match(screen, /styles\.fixedNames/, 'Insurer names remain visible in a pinned column');
assert.match(screen, /financialColumns: \{ flex: 1, minWidth: 0 \}/, 'Scrollable financial viewport fills remaining portrait width');
assert.match(screen, /const INSURER_COLUMN_WIDTH = '31%'/, 'Insurer name width remains at the existing 31%');
assert.match(screen, /fixedNames: \{ width: INSURER_COLUMN_WIDTH/, 'Pinned insurer names use the existing width');
assert.match(screen, /policies: 75, premium: 105, payin: 90, retention: 95/, 'Policies and Net Premium remain initially visible');
assert.match(screen, /METRIC_COLORS\[column\.key\]\.header/, 'Color-coded financial headers');
assert.match(screen, /METRIC_COLORS\[column\.key\]\.cell/, 'Color-coded financial data cells');
assert.match(screen, /numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.9\}/, 'Header labels stay on one line');
assert.match(screen, /styles\.financialRow/, 'All financial columns remain aligned row-by-row');
assert.match(screen, /formatInsurerCompactRupees\(amount\)/, 'Compact values fit in portrait');
assert.match(screen, /partnerAlert\(/, 'Exact whole-rupee values remain accessible via shared popup on tap');
for (const label of ["label: 'Policies'", "label: 'Net Premium'", "label: 'Pay-In'", "label: 'Retention'", "label: 'Payout'"])
  assert.ok(screen.includes(label), 'Missing register column ' + label);
assert.doesNotMatch(screen, /label: 'Amount'|key: 'amounts'/, 'Duplicate Amount column must not return');
assert.match(screen, /const canViewCommercials = employee && context\?\.can_view_insurer_commercials === true/, 'Commercial columns require the authenticated permission');
assert.match(screen, /headerTitleRow: \{ flexDirection: 'row', alignItems: 'center'/, 'Header icon and title must align in the same row');
assert.match(screen, /<View style=\{styles\.headerTitleRow\}>[\s\S]*?<Pressable[\s\S]*?source=\{PartnerAssets\.status\.businessGrowth\}[\s\S]*?Insurer-wise Performance/, '3D artwork sits with the header title, not above it');
assert.match(screen, /const columns: Array<\{ key: Metric \| 'policies'; label: string \}> = employee/, 'Actor-specific column sets');
assert.match(screen, /getPartnerInsurerRegister\(from, to\)/, 'Keep authorized RPC');
assert.match(screen, /setRange\(draft\)/, 'Applying date range refreshes query');
assert.match(screen, /validDateRange\(draft\.from, draft\.to\)/, 'Reject invalid ranges');
assert.match(screen, /if \(sortKey === 'payin_desc' && canViewCommercials\)/, 'Pay-In sort is commercially authorized only');
assert.match(screen, /if \(sortKey === 'retention_desc' && canViewCommercials\)/, 'Retention sort is commercially authorized only');
assert.match(screen, /accessibilityLabel=\{\`Sort by \$\{column\.label\}\`\}/, 'Column header sorting preserved');
assert.doesNotMatch(screen, /arrow-forward|summaryCard/, 'No row navigation or summary card');
console.log('Partner insurer inline date range and compact portrait register regression passed.');
