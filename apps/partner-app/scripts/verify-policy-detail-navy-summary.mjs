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
for (const title of ['Premium', 'Customer Details', 'Commercial Attribution']) {
  assert.ok(source.includes('<CardHeader title="'+title+'" />'), 'Section '+title+' has no leading icon');
}
assert.ok(source.includes("<CardHeader title={data.vehicle ? 'Vehicle Details' : 'Insured Risk Details'} />"),
  'Vehicle/Risk section has no leading icon in either category');
assert.match(source, /iconKind \? <PartnerPolicyDetailIcon kind=\{iconKind\}/,
  'Icon is optional; keep icons in Policy Overview and other unchanged contexts');
assert.match(source, /<CardHeader iconKind="policy-overview" title="Policy Overview"/,
  'Policy Overview icon is retained');
assert.match(source,/PartnerCaseBottomNavigation activeTab="Policies"/,'Bottom navigation unchanged');
console.log('Navy Policy Details title and white policy summary verified.');
