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
// Policies use one search-row dropdown with all five live lifecycle counts.
assert.match(policies, /onPress=\{openStatusMenu\}/, 'Policies lifecycle dropdown opens from the search row');
assert.match(policies, /<Text style=\{styles\.quickActionsHeading\}>Quick Actions<\/Text>/, 'Quick Actions heading keeps its styling');
assert.match(policies, /<View style=\{styles\.policyListHeadingSection\}>\s*<Text style=\{styles\.policyListTitle\}>Policies<\/Text>/, 'Policies heading remains directly above the list beside the business-line filter');
assert.ok(policies.indexOf('<Text style={styles.policyListTitle}>Policies</Text>') > policies.indexOf('quickActions.map((action)'), 'Policies heading follows the four quick actions');
assert.ok(policies.indexOf('<Text style={styles.policyListTitle}>Policies</Text>') < policies.indexOf('{isOffline || collection.stale || summary.stale'), 'Policies title precedes the list and feedback');
assert.match(policies, /onPress=\{openBusinessLineMenu\}/, 'Business-line selection is immediately beside the Policies heading');

assert.ok(policies.includes("filterButton: {") && policies.includes("backgroundColor: '#FFFFFF'"), 'Policy filter outer area stays white');
assert.ok(policies.includes("filterNameBadge: {") && policies.includes("backgroundColor: '#17365D'"), 'Only the selected filter name uses a navy badge');
assert.ok(policies.includes('<View style={styles.filterNameBadge}>'), 'Selected name sits in its own navy badge');
assert.ok(policies.includes('name="chevron-down" size={14} color="#FFFFFF"'), 'Dropdown chevron is white on navy inside the badge');
assert.match(policies, /<View style=\{styles\.filterNameBadge\}>[\s\S]*?<Ionicons name="chevron-down" size=\{14\} color="#FFFFFF" \/>[\s\S]*?<\/View>/, 'Chevron and selected status label share the navy badge');
assert.match(policies, /filterNameBadge: \{[\s\S]*?flexDirection: 'row',[\s\S]*?alignItems: 'center'/, 'Navy label and chevron align horizontally');

for (const label of ['Total Policies', 'Active Policies', 'Expiring Soon', 'Lapsed Policies', 'Upcoming']) {
  assert.ok(policies.includes("label: '" + label + "'"), 'Preserve Policies status ' + label);
}
for (const lifecycle of ['all', 'in_force', 'expiring', 'expired', 'upcoming']) {
  assert.ok(policies.includes("filter: '" + lifecycle + "'"), 'Preserve lifecycle ' + lifecycle);
}
assert.match(policies, /count: summary\.data\?\.total_policies/, 'Dropdown counts use portfolio summary');
assert.match(policies, /onPress=\{\(\) => selectSummary\(option\.filter\)\}/, 'Dropdown selection filters policies');
assert.match(policies, /accessibilityState=\{\{ selected \}\}/, 'Dropdown selection announced accessibly');
assert.match(policies, /visible=\{statusMenuOpen\}/, 'Dropdown displays all options on demand');
assert.doesNotMatch(policies, /styles\.summaryRow|styles\.summaryScroll|styles\.summaryChipSelected|seeAllOpen|statusSheetOverlay/, 'Obsolete horizontal policy chips and See all removed');
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
assert.match(claims, /summaryAddClaim: \{ width: 88,[^\n]+flexShrink: 0/, 'Add Claim has reserved width and does not overlap filters');
assert.doesNotMatch(claims, /styles\.summaryCard|styles\.summaryIcon|styles\.summaryChange|styles\.addClaimButton/, 'Remove large Claims metric tiles and old Add Claim banner');
console.log('Primary tab navy sticky heading/search contracts passed');
