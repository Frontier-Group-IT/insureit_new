import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('apps/partner-app/app/policy/[id].tsx','utf8');
assert.match(source,/pageHeader:\s*\{[^}]*backgroundColor: '#0A234A'/,'Policy Details top bar uses navy');
assert.match(source,/summaryCard:\s*\{[^}]*backgroundColor: '#FFFFFF'/,'Policy summary has white background');
assert.match(source,/headerTitle:\s*\{ color: '#FFFFFF'/,'Header title has white contrast');
assert.match(source,/summaryPolicyNo:\s*\{ color: '#1B2536'/,'Policy number has dark contrast on white');
assert.match(source,/summaryNetPremium/,'Net Premium has dedicated inline secondary styling');
assert.match(source,/Net Premium - \{nullableMoney\(data\.premium\.net_premium\)\}/,'Net Premium is directly below policy number');
assert.match(source,/styles\.categoryPill[\s\S]{0,300}styles\.periodValue/,'Date range follows category badge');
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
console.log('Navy Policy Details title and white policy summary verified.');
