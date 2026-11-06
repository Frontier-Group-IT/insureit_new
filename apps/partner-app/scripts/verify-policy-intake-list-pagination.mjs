import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('app/policy-intakes.tsx', 'utf8');
const api = readFileSync('lib/policy-intakes.ts', 'utf8');
const route = readFileSync('../web-portal/app/api/partner/policy-intakes/route.ts', 'utf8');

assert.match(app, /useState<IntakeFilter>\('all'\)/, 'Keep all-submissions default');
assert.match(api, /export const POLICY_INTAKE_PAGE_SIZE = 50/, 'Page size must match server cap');
assert.match(api, /export async function listPartnerPolicyIntakesPage\(offset = 0\)/, 'Fetch only requested page');
assert.match(api, /view=mobile_list&filter=all&limit=\$\{POLICY_INTAKE_PAGE_SIZE\}&offset=\$\{offset\}/, 'Mobile list requests scoped page');
assert.doesNotMatch(api, /export async function listPartnerPolicyIntakes\(\)/, 'Never require full export before displaying');
assert.match(app, /await listPartnerPolicyIntakesPage\(0\)/, 'Initial request must load only first page');
assert.match(app, /await listPartnerPolicyIntakesPage\(nextOffset\)/, 'Load more must request next offset');
assert.match(app, /setRows\(\(previous\) => \{[\s\S]*?new Set\(previous\.map\(\(row\) => row\.id\)\)/, 'Keep previously loaded records and dedupe');
assert.match(app, /setPageError\(/, 'Later-page failures must not overwrite loaded records');
assert.match(app, /pageError \? 'Retry Load More' : 'Load More'/, 'Offer explicit retry for failed page');
assert.match(app, /requestGeneration\.current/, 'Ignore stale requests after refresh');
assert.match(app, /Showing \{rows\.length\} of \{total\} submissions/, 'Clearly identify loaded subset');
assert.match(route, /if \(view === "mobile_list"\)/, 'Mobile server path must be specific');
assert.match(route, /if \(employeeRead\?\.mode === "or"\) query = query\.or\(employeeRead\.predicates\)/, 'Preserve employee read scope');
assert.match(route, /else if \(!employeeRead\) query = query\.or\(intakeReadScope\)/, 'Preserve partner read scope');
assert.match(route, /return json\(\{ ok: true, intakes: intakes \?\? \[\], total: count \?\? 0 \}\)/, 'Use scoped result and count');
assert.match(api, /response\.status === 401 \|\| response\.status === 403/, 'Differentiate expired or rejected access');
assert.match(api, /Network connection failed/, 'Show actionable network failure');
assert.match(api, /console\.warn\('\[partner-policy-intakes\] read failed'/, 'Record safe error categories');
console.log('Partner app resilient policy intake page loading regression passed');
