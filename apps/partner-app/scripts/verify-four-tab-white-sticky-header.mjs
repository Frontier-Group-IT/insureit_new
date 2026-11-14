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
assert.match(policies, /visible=\{seeAllOpen\}/, 'See all now opens a visible anchored filter menu');
assert.match(policies, /onPress=\{\(\) => \{ setFilterMenuOpen\(false\); setSeeAllOpen\(open => !open\); \}\}/, 'See all toggles the menu even when Total Policies is already selected');
assert.match(policies, /onPress=\{\(\) => selectSummary\(option\.filter\)\}/, 'Each visible menu option selects its existing lifecycle filter');
assert.match(policies, /setSeeAllOpen\(false\);\s*setQuery\(''\)/, 'Selecting an option closes the menu and resets search');
assert.match(policies, /accessibilityState=\{\{ expanded: seeAllOpen \}\}/, 'See all exposes the expanded state to assistive technology');
assert.match(policies, /summarySeeAllOptionCount/, 'Full filter menu includes policy counts');
for (const lifecycle of ["all", "in_force", "expiring", "expired", "upcoming"]) {
  assert.ok(policies.includes(`filter: '${lifecycle}' as const`), `All status options include ${lifecycle}`);
}
assert.doesNotMatch(policies, /styles\.summaryCard|styles\.summaryIcon|styles\.summaryPercent|formatPortfolioShare/, 'Remove the large metric tiles, icons and redundant percentages');
// Claims uses the Policies-style compact status/count strip; Add Claim takes the fixed See-all position.
assert.match(claims, /<ScrollView\s+horizontal\s+showsHorizontalScrollIndicator=\{false\}\s+style=\{styles\.summaryScroll\}/, 'Claims metrics scroll horizontally as compact status chips');
for (const label of ['All Claims', 'Settled Claims', 'In Progress']) {
  assert.ok(claims.includes(`label: '${label}'`), `Preserve ${label} filter and summary count`);
}
assert.match(claims, /onPress=\{\(\) => selectSummary\(metric\.filter\)\}/, 'Status chip preserves existing claims filtering');
assert.match(claims, /metric\.value\.toLocaleString\('en-IN'\)/, 'Claim counts keep authorized backend summary values');
assert.match(claims, /summaryChipSelected: \{ backgroundColor: '#17365D'/, 'Selected status chip uses navy fill');
assert.match(claims, /\{canPartnerStartClaim\(context\) \? \(\s*<Pressable/, 'Add Claim pill remains permission-gated');
assert.match(claims, /accessibilityLabel="Add Claim"/, 'Compact Add Claim remains accessible');
assert.match(claims, /onPress=\{\(\) => router\.push\('\/claim\/select-vehicle' as never\)\}/, 'Add Claim opens the existing vehicle-selection flow');
assert.match(claims, /styles\.summaryAddClaim/, 'Add Claim replaces See all at the right of claims status strip');
assert.match(claims, /summaryAddClaim: \{ minHeight: 40,[^\n]+borderRadius: 22/, 'Add Claim uses the same pill dimensions as Policies See all');
assert.doesNotMatch(claims, /styles\.summaryCard|styles\.summaryIcon|styles\.summaryChange|styles\.addClaimButton/, 'Remove large Claims metric tiles and old Add Claim banner');
console.log('Primary tab navy sticky heading/search contracts passed');
