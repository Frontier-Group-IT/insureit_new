import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const claim = read('../app/claim/[id].tsx');
const home = read('../app/(tabs)/index.tsx');
const business = read('../app/(tabs)/business.tsx');
const session = read('../lib/partner-session.ts');
const canonicalBranch = read('../../../supabase/migrations/20261030183500_partner_branch_canonical_portal_identity.sql');
const historicBranch = read('../../../supabase/migrations/20260915125000_group_branch_partner_identity.sql');

// Claim detail: retain only the navy navigation header; the duplicate title and
// standalone assistance button must no longer occupy a full content row.
assert.match(claim, /<View style=\{styles\.header\}>[\s\S]*?<Text style=\{styles\.headerTitle\}>Claim Tracker<\/Text>/);
assert.doesNotMatch(claim, /styles\.trackerTitleRow|styles\.trackerTitle|styles\.assistanceButton|styles\.assistanceText|accessibilityLabel="Get Assistance"/);
assert.match(claim, /<ScrollView[^>]*>[\s\S]*?\{loading \? <PartnerStateView/);
assert.match(claim, /<View style=\{styles\.hero\}>/);
assert.match(claim, /<View style=\{styles\.panel\}>[\s\S]*?Claim Journey/);

// Branch scope is server-authenticated; never use display names or blanket
// actor_kind=intermediary filtering (parents and POSPs must keep their cards).
assert.match(session, /function isPartnerBranchSession\(context: PartnerSessionContext \| null \| undefined\): boolean/);
assert.match(session, /context\?\.identity\.actor_kind !== 'intermediary'\) return false/);
assert.match(session, /context\.identity\.portal_access_type === 'branch'/);
assert.match(session, /context\.scope\.portal_access_type === 'branch'/);
assert.match(session, /context\.identity\.intermediary_type === 'branch'/);
assert.match(session, /Boolean\(context\.identity\.branch_id\)/);
assert.match(canonicalBranch, /'portal_access_type','branch'/);
assert.match(historicBranch, /'intermediary_type', 'branch'/);

// Branch Home: no commission/payout card or orphan divider; parent login stays
// on the original code path, with all business metrics intact.
assert.match(home, /const isBranchLogin = isPartnerBranchSession\(context\)/);
assert.match(home, /\{!isBranchLogin \? \(\s*<>\s*<View style=\{styles\.metricDivider\} \/>/);
assert.match(home, /<MetricCell\s+icon=\{<PartnerCommissionEarnedIcon/);
assert.match(home, /label=\{identity\.actor_kind === 'employee' \? 'Projected Retention' : 'Commission Earned'\}/);

// Branch Business: payout RPC is not requested, the payout overview card and
// quick-action remain visible for non-Branch (Partner/Group/employee) logins.
assert.match(business, /const isBranchLogin = isPartnerBranchSession\(context\)/);
assert.match(business, /isBranchLogin \? Promise\.resolve\(null\) : getPartnerPayoutSummary\(\)/);
assert.match(business, /\{!isBranchLogin \? \(\s*<OverviewCard\s+icon="commission"/);
assert.match(business, /\{!isBranchLogin \? <PayoutQuickAction payout=\{payout\}/);
assert.match(business, /label=\{context\?\.identity\.actor_kind === 'employee' \? 'Projected Retention' : 'Payout'\}/);
for (const label of ['Net Premium', 'Policies Sold', 'Customers', 'Renewals', 'Claims', 'Add Customer']) {
  assert.ok(business.includes(label), 'Keep non-payout business content: ' + label);
}
console.log('Partner Claim Tracker title removal and Branch-only payout visibility checks passed.');
