import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const screen = readFileSync(new URL('../app/insurers.tsx', import.meta.url), 'utf8');

// Insurer performance reference: full-width rounded search with right-side date button,
// Policies-style date-range bottom sheet and direct-select calendar while keeping pinned insurer names.
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

assert.match(screen, /accessibilityLabel="Date Range"/, 'Calendar button remains accessible inside search');
assert.ok(screen.includes('styles.dateSection') && screen.includes('styles.headerSearch, searchFocused'), 'Search remains in reporting filter area');
assert.match(screen, /<TextInput value=\{search\}[\s\S]*?style=\{styles\.headerSearchInput\}/, 'Existing insurer search state and input remain');
assert.ok(screen.includes('style={styles.calendarTrigger}') && screen.includes('pressCalendar(0.92)'), 'Calendar remains inside search with press feedback');
assert.match(screen, /<View style=\{styles\.selectedRangeRow\}>[\s\S]*?formatRange\(from, to\)/, 'Selected dates appear beneath search');
assert.match(screen, /headerSearch: \{ width: '100%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD8E7', borderRadius: 999/, 'Search is a full-width rounded pill');
assert.match(screen, /dateSection: \{ marginHorizontal: 14, marginTop: 14/, 'Search has equal left and right margins');
assert.doesNotMatch(screen, /styles\.headerSearchBand|styles\.dateRangeTrigger/, 'No duplicate navy search band or large Date Range card');
assert.match(screen, /<Modal visible=\{dateExpanded\} transparent/, 'Calendar trigger opens a modal bottom sheet rather than inline content');
assert.doesNotMatch(screen, /styles\.sheetTabs|styles\.sheetTab|styles\.sheetTabText/, 'Redundant purple Date Range tab must not render above the section heading');
assert.match(screen, /<View style=\{styles\.sheetHeader\}>[\s\S]*?<\/View>\s*<ScrollView showsVerticalScrollIndicator=\{false\}/, 'Sort by header directly precedes scrolling date range controls');
assert.match(screen, /<Text style=\{styles\.sheetSectionTitle\}>Date Range<\/Text>/, 'Keep one clear Date Range section heading');

assert.match(screen, /<PartnerDatePicker directSelect label="From"/, 'From uses the same centered calendar as Policies');
assert.match(screen, /<PartnerDatePicker directSelect label="To"/, 'To uses the same centered calendar as Policies');
assert.match(screen, /selectedPreset\(draft\.from, draft\.to\)/, 'Draft presets are shown before applying');
assert.match(screen, /applyPreset\(key\)/, 'MTD, 90 and 365 days select valid reporting ranges');
assert.match(screen, /setDraft\(range\)/, 'Closing the sheet discards uncommitted changes');
assert.match(screen, /onPress=\{applyDateRange\}/, 'Apply Filter is the only action that commits');
assert.match(screen, /setRange\(draft\)/, 'Applying the draft refreshes insurer figures');
assert.match(screen, /disabled[\s\S]*?All Dates unavailable, report supports a maximum of 366 days/, 'Unsupported all-history range remains disabled');
assert.match(screen, /maximumDate=\{new Date\(\)\}/, 'Calendar prevents future To dates');
assert.doesNotMatch(screen, /calendarCells\.map|styles\.datePanel|setPickerTarget/, 'Old inline calendar implementation is removed');
assert.doesNotMatch(screen, /contentContainerStyle=\{styles\.filterRow\}|Sort insurer register|dateModalOpen/, 'No legacy financial filter strip or sort popup');
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
console.log('Partner insurer combined search/date filter and compact portrait register regression passed.');

assert.match(screen, /useActivityMotion\(\)/, 'Respect reduced motion and focus');
assert.match(screen, /const ENTRANCE_ROWS = 6/, 'Bound initial animations');
assert.match(screen, /initialRows\.current = new Map/, 'Stable insurer identity controls both halves');
assert.match(screen, /nestedScrollEnabled/, 'Native nested horizontal scroll');
assert.match(screen, /scrollMetrics\.current\.content = width/, 'Measure horizontal overflow');
assert.match(screen, /pointerEvents="none" accessibilityElementsHidden/, 'Edge decoration does not intercept taps');
assert.match(screen, /initialLoading \? "Loading insurers…"/, 'Loading does not display a false zero count');
assert.match(screen, /<ReportValue text=\{amount == null \? '—' : formatInsurerCompactRupees\(amount\)\}/, 'Financial reveal preserves exact display formatter');

assert.match(screen, /fixedHeader=\{stickyTableHeader\}/, 'Sticky heading is overlaid without changing the parent scroll layout');
assert.match(screen, /stickyMetricsOffset\.setValue\(scrollMetrics\.current\.x\)/, 'Sticky metric headings track horizontal scroll');
assert.match(screen, /stickyTableVisible \?/, 'Sticky heading only renders while the table extends beneath the viewport');
assert.match(screen, /style=\{styles\.stickyHeaderOverlay\}/, 'Sticky header has a fixed visual layer');
assert.match(screen, /resetScrollOnFocus=\{false\}/, 'Preserve report scroll position on tab focus');
