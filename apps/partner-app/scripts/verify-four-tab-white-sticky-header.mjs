import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (name) => readFileSync('apps/partner-app/' + name, 'utf8');
const screen = read('components/partner-screen.tsx');
const home = read('app/(tabs)/index.tsx');
const business = read('app/(tabs)/business.tsx');
const policies = read('app/(tabs)/policies.tsx');
const claims = read('app/(tabs)/claims.tsx');
assert.match(screen, /edges=\{\['top'\]\}/, 'Status bar safe area must remain separate');
assert.match(screen, /fixedWhiteHeader: \{[^\n]+backgroundColor: "#FFFFFF"/);
assert.match(screen, /fixedWhiteHeading:/);
assert.match(screen, /isHomeHero \? homeSearchControl : stickyControls/);
assert.match(home, /<PartnerScreen/);
assert.match(home, /stickyHeaderNavy/);
assert.match(business, /stickyHeaderNavy/);
assert.match(business, /stickyHeading="Business"/);
assert.match(business, /stickyControls=\{businessSearchControls\}/);
assert.match(policies, /stickyClaimsHeading/);
assert.match(policies, /stickySearchOverlay: \{[^\n]+backgroundColor: '#082657'/);
assert.match(claims, /stickyOverlay: \{[^\n]+backgroundColor: "#082657"/);
assert.match(claims, /<Text style=\{styles.stickyTitle\}>Claims<\/Text>/);
// Policies portfolio summary is a single horizontal row of name/count chips, not five KPI cards.
assert.match(policies, /<ScrollView\s+horizontal\s+showsHorizontalScrollIndicator=\{false\}\s+style=\{styles\.summaryScroll\}/, 'Policy status chips scroll horizontally on mobile');
for (const label of ['Total Policies', 'Active Policies', 'Expiring Soon', 'Lapsed Policies', 'Upcoming']) {
  assert.ok(policies.includes(`label: '${label}'`), `Preserve the ${label} metric and count`);
}
assert.match(policies, /metric\.value\.toLocaleString\('en-IN'\)/, 'Status chip counts use the source portfolio summary');
assert.match(policies, /onPress=\{\(\) => selectSummary\(metric\.filter\)\}/, 'Selecting a chip preserves existing policy lifecycle filtering');
assert.match(policies, /accessibilityState=\{\{ selected \}\}/, 'Selected lifecycle chip remains accessible');
assert.match(policies, /summaryChipSelected: \{ backgroundColor: '#17365D'/, 'Selected lifecycle uses navy contrast');
assert.match(policies, /accessibilityLabel="See all policy status filters"/, 'See all remains visible outside the horizontal chip scroll');
assert.match(policies, /<Modal[\s\S]*?visible=\{seeAllOpen\}[\s\S]*?animationType="slide"/, 'See all uses a visible bottom modal sheet');
assert.match(policies, /onPress=\{\(\) => \{ setFilterMenuOpen\(false\); setSeeAllOpen\(true\); \}\}/, 'See all opens the bottom sheet even when Total Policies is selected');
assert.match(policies, /onPress=\{\(\) => selectSummary\(option\.filter\)\}/, 'Each visible menu option selects its existing lifecycle filter');
assert.match(policies, /setSeeAllOpen\(false\);\s*setQuery\(''\)/, 'Selecting an option closes the menu and resets search');
assert.match(policies, /accessibilityState=\{\{ expanded: seeAllOpen \}\}/, 'See all exposes the expanded state to assistive technology');
assert.match(policies, /styles\.statusSheetCount/, 'Bottom status sheet includes source portfolio counts');
for (const lifecycle of ["all", "in_force", "expiring", "expired", "upcoming"]) {
  assert.ok(policies.includes(`filter: '${lifecycle}' as const`), `All status options include ${lifecycle}`);
}
assert.doesNotMatch(policies, /styles\.summaryCard|styles\.summaryIcon|styles\.summaryPercent|formatPortfolioShare/, 'Remove the large metric tiles, icons and redundant percentages');
// Claims keeps three compact filters and the permission-gated Add action together in one row.
assert.match(claims, /<View style=\{styles\.summaryChips\} accessibilityLabel="Claim status filters">/, 'All Claims status chips remain visible in a single row');
assert.match(claims, /summaryChip: \{ flex: 1, minWidth: 0/, 'Claims chips divide available width rather than scroll');
for (const label of ['All Claims', 'Settled Claims', 'In Progress']) {
  assert.ok(claims.includes(`label: '${label}'`), `Preserve ${label} filter and summary count`);
}
assert.match(claims, /onPress=\{\(\) => selectSummary\(metric\.filter\)\}/, 'Status chip preserves existing claims filtering');
assert.match(claims, /metric\.value\.toLocaleString\('en-IN'\)/, 'Claim counts keep authorized backend summary values');
assert.match(claims, /summaryChipSelected: \{ backgroundColor: '#17365D'/, 'Selected status chip uses navy fill');
assert.match(claims, /<\/View>\s*\{canPartnerStartClaim\(context\) \? \(\s*<Pressable/, 'Add Claim follows all three filters in the same permission-gated row');
assert.match(claims, /accessibilityLabel="Add Claim"/, 'Compact Add Claim remains accessible');
assert.match(claims, /onPress=\{\(\) => router\.push\('\/claim\/select-vehicle' as never\)\}/, 'Add Claim opens the existing vehicle-selection flow');
assert.match(claims, /summaryRow: \{[^\n]*flexDirection: 'row'/, 'Claims filters and Add Claim use a single horizontal row');
assert.match(claims, /summaryAddClaim: \{ width: 62,[^\n]+flexShrink: 0/, 'Add Claim has reserved width and does not overlap filters');
assert.doesNotMatch(claims, /styles\.summaryCard|styles\.summaryIcon|styles\.summaryChange|styles\.addClaimButton/, 'Remove large Claims metric tiles and old Add Claim banner');
console.log('Primary tab navy sticky heading/search contracts passed');
