import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('apps/partner-app/app/policy/[id].tsx','utf8');
assert.match(source,/pageHeader:\s*\{[^}]*backgroundColor: '#0A234A'/,'Policy Details top bar uses navy');
assert.match(source,/summaryCard:\s*\{[^}]*backgroundColor: '#FFFFFF'/,'Policy summary has white background');
assert.match(source,/headerTitle:\s*\{ color: '#FFFFFF'/,'Header title has white contrast');
assert.match(source,/summaryPolicyNo:\s*\{ color: '#1B2536'/,'Policy number has dark contrast on white');
assert.match(source,/summaryNetPremium/,'Net Premium has dedicated inline secondary styling');
assert.match(source,/Net Premium - \{nullableMoney\(data\.premium\.net_premium\)\}/,'Net Premium is directly below policy number');
assert.match(source,/styles\.categoryPill[\s\S]{0,450}styles\.periodValue/,'Date range follows category badge, including conditional Motor badge styling');
assert.match(source,/formatDate\(data\.policy\.start_date\)\} – \{formatDate\(data\.policy\.end_date\)/,'Keep real policy dates');
assert.doesNotMatch(source,/>Policy Period</,'Do not show Policy Period label');
assert.doesNotMatch(source,/styles\.summaryDivider|styles\.premiumRow|styles\.periodDivider/,'Remove old split premium and period row from hero');
assert.ok(!source.includes('<CardHeader title="Premium" />'), 'Premium is inside the combined overview');
assert.ok(!source.includes('<CardHeader title="Commercial Attribution" />'), 'Commercial is inside the combined overview');
assert.ok(source.includes('<CardHeader title="Customer & Vehicle Details" />'), 'Customer and Vehicle share one outside heading');
assert.match(source,/styles\.premiumDisclosure/,'Premium disclosure remains expandable');
assert.match(source,/styles\.commercialRow/,'Commercial disclosure remains expandable');
assert.ok(!source.includes("<CardHeader title={data.vehicle ? 'Vehicle Details' : 'Insured Risk Details'} />"),
  'Vehicle/Risk no longer has a separate section');
assert.match(source, /iconKind \? <PartnerPolicyDetailIcon kind=\{iconKind\}/,
  'Icon is optional; keep icons in Policy Overview and other unchanged contexts');
assert.match(source, /<CardHeader iconKind="policy-overview" title="Policy Overview"/,
  'Policy Overview icon is retained');
assert.match(source, /iconKind === 'renew-policy'\s*\? PartnerAssets\.actions\.quickRenewals/, 'Renew Policy uses the exact Home Renewals asset');
assert.match(source, /iconKind === 'raise-claim'\s*\? PartnerAssets\.actions\.quickClaims/, 'Raise Claim uses the exact Home Claims asset');
assert.doesNotMatch(source, /quickGlyph/, 'QuickAction must not use generic vector fallback for Renewals or Claims');
assert.match(source, /iconKind="renew-policy" label="Renew Policy" onPress=\{\(\) => router\.push\('\/renewals'/, 'Renewal route remains unchanged');
assert.match(source, /iconKind="raise-claim" label="Raise Claim" onPress=\{\(\) => router\.push\('\/claims'/, 'Claims route remains unchanged');
assert.match(source,/PartnerCaseBottomNavigation activeTab="Policies"/,'Bottom navigation unchanged');
// Approved reference replaces pastel tiles with neutral surfaces and unified blue section headers.
assert.match(source, /<View style=\{styles.unifiedDetails\}>\s*<View style=\{styles.unifiedSection\}>/, 'One continuous white details container');
assert.match(source, /sectionHeaderFill: \{ backgroundColor: '#E6EFF9' \}/, 'Reference blue heading fill');
assert.match(source, /overviewItem: [^\n]*backgroundColor: '#FFFFFF'/, 'White outlined overview tiles');
assert.match(source, /miniInfo: [^\n]*backgroundColor: '#F5F7FA'/, 'Neutral premium and sales tiles');
assert.doesNotMatch(source, /styles\.tone(?:Blue|Purple|Mint|Amber|Rose)/, 'No multicoloured tiles');
for (const obsolete of ['styles.quickDocument', 'styles.quickRenewal', 'styles.quickClaim', 'styles.quickCustomer']) {
  assert.ok(!source.includes(obsolete), 'Obsolete colored action reference: ' + obsolete);
}
assert.match(source, /quickAction:\s*\{[\s\S]*?backgroundColor: 'transparent'/, 'Quick Action tiles are transparent');
assert.match(source, /<View style=\{styles.unifiedSection\}>\s*<CardHeader iconKind="policy-overview" title="Policy Overview"/, 'Overview heading within unified card');
assert.match(source, /<View style=\{styles.unifiedSection\}>\s*<Pressable accessibilityRole="button" accessibilityState=\{\{ expanded: showPremiumDetails \}\}/, 'Premium disclosure within unified card');
assert.match(source, /<View style=\{styles.unifiedSection\}>\s*<Pressable accessibilityRole="button" accessibilityState=\{\{ expanded: showCommercialDetails \}\}/, 'Sales disclosure within unified card');
assert.match(source, /premiumDisclosure:[^\n]*backgroundColor: '#E6EFF9'/, 'Premium header uses reference fill');
assert.match(source, /commercialRow:[^\n]*backgroundColor: '#E6EFF9'/, 'Sales header uses reference fill');
assert.match(source, /<Ionicons name="chevron-forward" size=\{13\} color="#0969CF"/, 'View All retains reference chevron');
console.log('Navy Policy Details hero, original icons and unified reference design verified.');
