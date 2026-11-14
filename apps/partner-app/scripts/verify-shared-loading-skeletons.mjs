import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = 'apps/partner-app/';
const read = (path) => readFileSync(root + path, 'utf8');
const shared = read('components/ui/partner-state-view.tsx');
assert.match(shared, /if \(state === 'loading'\) \{\s*return <PartnerSkeletonList title=\{title \|\| 'Loading'\} \/>/, 'All PartnerStateView loading states use the shared skeleton');
assert.match(shared, /export function PartnerSkeletonList\(/, 'Expose a reusable skeleton for custom loading screens');
assert.match(shared, /accessibilityRole="progressbar" accessibilityLabel=\{title\}/, 'Shared skeleton has a meaningful accessible label');
assert.match(shared, /Array\.from\(\{ length: Math\.max\(1, Math\.min\(10, rows\)\) \}/, 'Skeleton displays a bounded number of placeholder rows');
for (const style of ['skeletonCard', 'skeletonLogo', 'skeletonTitleLine', 'skeletonSubtitleLine', 'skeletonBadge']) {
  assert.match(shared, new RegExp(style + ':\\s*\\{'), 'Missing shared skeleton visual: ' + style);
}
assert.doesNotMatch(shared, /<ActivityIndicator/, 'Loading skeleton must not show the large spinner panel');

const source = read('app/policy-intake-new.tsx');
assert.match(source, /<PartnerStateView state="loading" title="Loading lead sources" \/>/, 'Lead Source list uses shared loading skeleton');
assert.match(source, /error && sources\.length === 0/, 'Lead Source error feedback must remain separate from loading');
assert.match(source, /data=\{filteredSources\}/, 'Lead Source list still displays its actual authorized records');
assert.match(read('app/policy-intakes/onboarding.tsx'), /<PartnerStateView state="loading" title="Loading saved Policy Onboarding" \/>/, 'Policy Onboarding uses shared skeleton');
assert.doesNotMatch(read('app/policy-intakes/onboarding.tsx'), /Loading saved Policy Onboarding…/, 'Remove onboarding loading spinner and text');
assert.match(read('app/claim/select-vehicle.tsx'), /<PartnerSkeletonList title="Loading authorized vehicles" rows=\{4\} \/>/, 'Claim vehicle chooser has card skeleton');
const customers = read('app/customers.tsx');
assert.match(customers, /accessibilityLabel="Loading customer totals"/, 'Customer summary skeleton is labelled');
assert.match(customers, /kpiSkeletonBlock/, 'Customer summary uses metric placeholder blocks');
const stories = read('app/stories.tsx');
assert.match(stories, /accessibilityLabel="Loading INSUREIT Stories"/, 'Stories show theme-aware skeleton placeholders');
assert.doesNotMatch(stories, /<ActivityIndicator/, 'Stories initial load no longer uses a spinner');
for (const path of ['app/insurers.tsx', 'app/network.tsx', 'app/search.tsx', 'app/(tabs)/business.tsx', 'app/(tabs)/claims.tsx', 'app/(tabs)/policies.tsx', 'app/renewals.tsx', 'app/policy/[id].tsx']) {
  assert.match(read(path), /<PartnerStateView state="loading"/, 'Existing ' + path + ' screen is covered by the shared skeleton');
}
const intake = read('app/policy-intakes.tsx');
assert.match(intake, /<PolicyIntakeSkeletonList \/>/, 'Policy Intake retains its existing specialized skeleton');
assert.match(shared, /state === 'offline'/, 'Offline behavior remains separate');
assert.match(shared, /state === 'error'/, 'Error behavior remains separate');
console.log('Partner shared loading skeleton coverage and existing state behavior verified.');
