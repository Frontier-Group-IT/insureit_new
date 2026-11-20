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
// Policies search shares the row with the exact Claims-style enabled Filter; lifecycle choices remain in the existing advanced sheet.
assert.match(policies, /<PartnerSearchField/, 'Policies search remains in the sticky header');
assert.match(policies, /sheetStatuses\.map/, 'Lifecycle statuses remain in Sort by');
assert.doesNotMatch(policies, /onPress=\{openStatusMenu\}/, 'Duplicate search-row lifecycle dropdown is removed');
assert.match(policies, /<Text style=\{styles\.quickActionsHeading\}>Quick Actions<\/Text>/, 'Quick Actions heading keeps its styling');
assert.ok(policies.includes('<View style={styles.policyListHeadingSection}>\n        <Pressable'), 'Business-line dropdown replaces the redundant Policies list heading');
assert.ok(!policies.includes('<Text style={styles.policyListTitle}>Policies</Text>'), 'Policies list does not repeat the page heading');
assert.ok(policies.indexOf('onPress={openBusinessLineMenu}') > policies.indexOf('quickActions.map((action)'), 'Business-line dropdown follows the four quick actions');
assert.ok(policies.indexOf('onPress={openBusinessLineMenu}') < policies.indexOf('{isOffline || collection.stale || summary.stale'), 'Business-line dropdown precedes the policy list and feedback');
assert.ok(policies.includes('onPress={openBusinessLineMenu}'), 'Business-line dropdown remains interactive');

// Status remains available in the Sort by sheet; no status dropdown is rendered in search.
for (const [fragment, description] of [
  ['sheetStatuses.map', 'Lifecycle status options are rendered'],
  ['setDraftLifecycle(', 'Lifecycle status selection is enabled'],
  ['setLifecycle(draftLifecycle)', 'Apply Filter commits the lifecycle status'],
  ['const draftStatusCounts =', 'Status counts remain scoped to the draft filters'],
  ['<PartnerSearchField', 'Search input remains in its sticky bar'],
]) assert.ok(policies.includes(fragment), description);
for (const removed of ['filterNameBadge: {', 'openStatusMenu', 'statusOptions.map', 'visible={statusMenuOpen}']) {
  assert.ok(!policies.includes(removed), 'Search bar no longer renders redundant status control: ' + removed);
}
assert.match(policies, /<Ionicons name="filter-outline" size={18} color="#3156B8" \/>/, 'Enabled inline Filter must use the exact Claims icon');
assert.match(policies, /onPress=\{openSortSheet\}/, 'Inline Filter must open existing Policies advanced filters');
assert.doesNotMatch(policies, /styles\\.summaryRow|styles\\.summaryScroll|styles\\.summaryChipSelected|seeAllOpen|statusSheetOverlay/, 'Obsolete horizontal policy chips and See all removed');
// Claims keeps three compact filters and the permission-gated Add action together in one row.
assert.match(claims, /<View style=\{styles\.summaryChips\} accessibilityLabel="Claim status filters">/, 'All Claims status chips remain visible in a single row');
assert.match(claims, /summaryChip: \{ flex: 1, minWidth: 0/, 'Claims chips divide available width rather than scroll');
for (const label of ['All Claims', 'Settled Claims', 'In Progress']) {
  assert.ok(claims.includes(`label: '${label}'`), `Preserve ${label} filter and summary count`);
}
assert.match(claims, /onPress=\{\(\) => selectSummary\(metric\.filter\)\}/, 'Status chip preserves existing claims filtering');
assert.match(claims, /metric\.value\.toLocaleString\('en-IN'\)/, 'Claim counts keep authorized backend summary values');
assert.match(claims, /summaryChipSelected: \{ backgroundColor: '#FFFFFF', borderColor: '#17365D'/, 'Selected status chip uses navy outline without competing with Add Claim');
assert.match(claims, /<\/View>\s*\{canPartnerStartClaim\(context\) \? \(\s*<HighlightedAddClaimButton/, 'Add Claim follows all three filters in the same permission-gated row');
assert.match(claims, /accessibilityLabel="Add Claim"/, 'Compact Add Claim remains accessible');
assert.match(claims, /onPress=\{\(\) => router\.push\('\/claim\/select-vehicle' as never\)\}/, 'Add Claim opens the existing vehicle-selection flow');
assert.match(claims, /summaryRow: \{[^\n]*flexDirection: 'row'/, 'Claims filters and Add Claim use a single horizontal row');
assert.match(claims, /summaryAddClaimMotion: \{ width: 88,[^\n]+flexShrink: 0/, 'Animated Add Claim has reserved width and does not overlap filters');
assert.doesNotMatch(claims, /styles\.summaryCard|styles\.summaryIcon|styles\.summaryChange|styles\.addClaimButton/, 'Remove large Claims metric tiles and old Add Claim banner');
console.log('Primary tab navy sticky heading/search contracts passed');
