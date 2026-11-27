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
// Approved 25 Nov design: keep navy hero, original text colours and functional contracts,
// keep the three outer sections with flat divider-separated fields (26 Nov).
assert.match(source, /<View style=\{styles.separatedDetails\}>/, 'Separated details group exists');
for (const [section, color] of [['policyOverviewSection', '#EAF3FF'], ['premiumSection', '#E8F7F0'], ['salesSection', '#F0ECFF']]) {
  assert.ok(source.includes(`styles.${section}`), section + ' is rendered independently');
  assert.match(source, new RegExp(section + ": \\{ backgroundColor: '" + color + "'"), section + ' has approved background');
}
assert.match(source, /separatedDetails: \{ gap: 11 \}/, 'Visible gap between independent sections');
assert.match(source, /sectionHeaderFill: \{ backgroundColor: 'transparent' \}/, 'Heading background follows outer section tint');
for (const name of ['overviewItem', 'miniInfo']) {
  const style = source.match(new RegExp('\\b' + name + ': \\{([^}]+)\\}'));
  assert.ok(style, name + ' exists');
  assert.doesNotMatch(style[1], /backgroundColor|borderRadius|borderWidth/, name + ' must not be a nested card');
}
assert.match(source, /detailRow: [^\n]*borderTopWidth: StyleSheet.hairlineWidth/, 'Horizontal row dividers');
assert.match(source, /detailCellDivider: [^\n]*borderLeftWidth: StyleSheet.hairlineWidth/, 'Vertical field dividers');
assert.match(source, /index > 0 && styles.detailCellDivider/, 'No leading vertical divider');
assert.equal((source.match(/<DetailRow>/g) || []).length, 8, 'All overview, expanded overview, premium and ownership rows are flat');
const docs = readFileSync('apps/partner-app/components/partner-policy-documents.tsx', 'utf8');
const fileStyle = docs.match(/\bfile: \{([^}]+)\}/);
assert.ok(fileStyle);
assert.doesNotMatch(fileStyle[1], /backgroundColor|borderRadius|\bborderWidth/);
assert.match(fileStyle[1], /borderTopWidth: StyleSheet.hairlineWidth/);
assert.match(docs, /open\(file, true\)/, 'Document download retained');
assert.match(docs, /<Pressable[^\n]*accessibilityLabel=\{'View ' \+ label[^\n]*styles\.fileTop[^\n]*onPress=\{\(\) => void open\(file\)\}/, 'File icon and name must be one clickable preview target');
assert.match(docs, /<Pressable[^\n]*accessibilityLabel=\{'Download ' \+ label[^\n]*styles\.downloadAction[^\n]*open\(file, true\)/, 'Separate right download target must use download mode');
assert.match(docs, /downloadAction: \{ width: 44, minHeight: 44/, 'Download target must remain accessible');
assert.match(docs, /name="download-outline"/, 'Right-side download icon required');
assert.doesNotMatch(docs, /styles\.actions|>View<\/Text>|>Download<\/Text>/, 'Remove duplicate text action buttons');
assert.match(docs, /viewing \? <ActivityIndicator/);
assert.match(docs, /downloading \? <ActivityIndicator/);
assert.match(source, /styles\.overviewLabelRow/, 'Overview icon and label remain on one line');
for (const obsolete of ['styles.quickDocument', 'styles.quickRenewal', 'styles.quickClaim', 'styles.quickCustomer', 'styles.unifiedDetails', 'styles.unifiedSection', 'styles.tileBlue', 'styles.tileGreen', 'styles.tileAmber', 'styles.tileSlate']) {
  assert.ok(!source.includes(obsolete), 'Obsolete presentation style returned: ' + obsolete);
}
assert.match(source, /quickAction:\s*\{[\s\S]*?backgroundColor: 'transparent'/, 'Quick Action tiles remain transparent');
assert.match(source, /<View style=\{\[styles.policyDetailSection, styles.policyOverviewSection\]\}>\s*<CardHeader iconKind="policy-overview" title="Policy Overview"/, 'Policy Overview in independent blue section');
assert.match(source, /<View style=\{\[styles.policyDetailSection, styles.premiumSection\]\}>\s*<Pressable accessibilityRole="button" accessibilityState=\{\{ expanded: showPremiumDetails \}\}/, 'Premium disclosure in independent mint section');
assert.match(source, /<View style=\{\[styles.policyDetailSection, styles.salesSection\]\}>\s*<Pressable accessibilityRole="button" accessibilityState=\{\{ expanded: showCommercialDetails \}\}/, 'Sales disclosure in independent lavender section');
assert.match(source, /premiumDisclosure:[^\n]*backgroundColor: 'transparent'/, 'Premium header uses section colour');
assert.match(source, /commercialRow:[^\n]*backgroundColor: 'transparent'/, 'Sales header uses section colour');
assert.match(source, /<Ionicons name="chevron-forward" size=\{13\} color="#0969CF"/, 'View All chevron retained');
console.log('Navy Policy Details hero, original data/text colours and three separate coloured sections with flat divider-separated fields verified.');
