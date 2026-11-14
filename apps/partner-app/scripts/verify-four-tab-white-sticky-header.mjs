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
assert.match(policies, /accessibilityLabel="See all policies"/, 'See all remains visible outside the horizontal chip scroll');
assert.match(policies, /onPress=\{\(\) => selectSummary\('all'\)\}/, 'See all resets to the unfiltered policy list');
assert.doesNotMatch(policies, /styles\.summaryCard|styles\.summaryIcon|styles\.summaryPercent|formatPortfolioShare/, 'Remove the large metric tiles, icons and redundant percentages');
console.log('Primary tab navy sticky heading/search contracts passed');
