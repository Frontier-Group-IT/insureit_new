import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('app/policy-intakes.tsx', 'utf8');
const api = readFileSync('lib/policy-intakes.ts', 'utf8');
const route = readFileSync('../web-portal/app/api/partner/policy-intakes/route.ts', 'utf8');

assert.match(app, /useState<IntakeFilter>\('all'\)/, 'Keep all-submissions default');
assert.match(api, /export const POLICY_INTAKE_PAGE_SIZE = 10/, 'Intake initial load and each Load More must match Policies: 10 per request');

assert.match(api, /export async function getPartnerPolicyIntake\(id: string\)/, 'Detail uses authorized single-item lookup');
assert.match(readFileSync('app/policy-intakes/[id].tsx', 'utf8'), /await getPartnerPolicyIntake\(id\)/, 'Detail screen never depends on fetching all pages');

assert.doesNotMatch(api, /export async function listPartnerPolicyIntakes\(\)/, 'Never require full export before displaying');
assert.match(api, /export async function listPartnerPolicyIntakesPage\(/, 'Keep offset-based paginated list function');
assert.match(api, /filter: PartnerIntakeFilter = 'all'/, 'Send selected status to server');
assert.match(api, /params\.set\('search', search\.trim\(\)\.slice\(0, 120\)\)/, 'Search full dataset on server, not loaded rows');
assert.match(api, /params\.set\('include_counts', 'true'\)/, 'Fetch full status counts separately from page data');
assert.match(api, /page\.counts\?\.\[key\]/, 'Reject missing full counts on initial request');
assert.match(app, /await listPartnerPolicyIntakesPage\(nextOffset, filter, debouncedQuery, false\)/, 'Load more in the current filter and search');
assert.match(app, /if \(page\.counts\) setCounts\(page\.counts\)/, 'Use server-reported totals');
assert.match(app, /listPartnerPolicyIntakesPage\(0, filter, debouncedQuery, true\)/, 'Always refresh current search/filter scoped counts');
assert.match(route, /loadPolicyIntakeDuplicateMatches\(admin, candidates\)/, 'Mobile must share Operations derived duplicate policy checks');
assert.match(route, /policyIntakeStatusCounts\(eligible, duplicateIds\)/, 'Status counts must reflect effective statuses of every scoped intake');
assert.match(route, /policyIntakeBucket\(row, duplicateIds\.has\(row\.id\)\) === filter/, 'Status filter must use same effective classification as counts');
assert.match(route, /pageIds = filtered\.slice\(offset, offset \+ limit\)/, 'Still return only requested page size');
assert.match(route, /employeeRead\?\.mode === "or"/, 'Preserve employee scope');
assert.match(route, /q = q\.or\(intakeReadScope\)/, 'Search remains scoped for partner accounts');
assert.match(app, /const visibleRows = rows;/, 'Never filter only the currently loaded page');
assert.match(app, /<PartnerStatusBadge label={statusLabel\(row\)} tone={statusTone\(row\)} \/>/, 'Keep existing workflow status badge');
assert.doesNotMatch(app, /<PartnerStatusBadge label="Fetched"/, 'Do not show a second Fetched pill');
assert.match(app, /row\.ocr_status === 'completed' \? \([\s\S]*?<Ionicons name="checkmark" size={15} color="#16A34A"/, 'A fetched intake must show a plain green check immediately beside the PIR number');
assert.match(app, /<View style={styles\.intakeNumberRow}>[\s\S]*?<Text numberOfLines={1} style={styles\.number}>{row\.intake_number}<\/Text>/, 'Place OCR check in same number row');
assert.match(app, /intakeNumberRow: \{ flexDirection: 'row', alignItems: 'center', gap: 4 \}/, 'Keep PIR number and plain icon tightly inline without badge styling');
assert.match(app, /row\.ocr_status === 'failed' && \(row\.status === 'processing' \|\| row\.status === 'needs_attention'\)/, 'Only show OCR failure warning when action is needed');
assert.match(app, /<Text style={styles\.updatedDate}>{formatDate\(row\.updated_at \|\| row\.created_at\)}<\/Text>/, 'Keep timestamp but remove Updated prefix');
assert.doesNotMatch(app, /Updated \{formatDate/, 'Remove redundant Updated text from timestamp');

assert.match(app, /setTimeout\(\(\) => setDebouncedQuery\(query\.trim\(\)\), 300\)/, 'Debounce server searches');
assert.doesNotMatch(app, /rows\.filter\(\(row\) => row\.status/, 'Never derive status counts from loaded rows');
assert.match(route, /includeCounts[\s\S]*url\.searchParams\.get\("include_counts"\)/, 'Counts controlled independently of pagination');



assert.match(app, /setRows\(\(previous\) => \{[\s\S]*?new Set\(previous\.map\(\(row\) => row\.id\)\)/, 'Keep previously loaded records and dedupe');
assert.match(app, /setPageError\(/, 'Later-page failures must not overwrite loaded records');
assert.match(app, /pageError \? 'Retry Load More' : 'Load More Submissions'/, 'Offer explicit retry for failed page');
assert.match(app, /requestGeneration\.current/, 'Ignore stale requests after refresh');
assert.doesNotMatch(app, /Showing \\{rows\\.length\\} of \\{total\\} submissions|Filter and search apply to loaded records|loadedSummary/, 'Never show loaded-record count or explanatory summary in Policy Intake UI');
assert.match(app, /nextOffset < total/, 'Show Load More only when more authorized submissions exist');
assert.match(app, /\{visibleRows\.length > 0 && nextOffset < total \? \(/, 'Do not render Load More when the selected filter or search shows zero records');
assert.doesNotMatch(app, /load more submissions below/i, 'Empty state must not refer to a hidden Load More action');
assert.match(app, /loadingMore && styles\.loadMoreButtonLoading/, 'Match Policies page loading button state');
assert.match(app, /<ActivityIndicator size="small" color="#FFFFFF" \/>/, 'Show loading spinner as on Policies page');
assert.match(app, /<Feather name="chevron-down" size=\{13\} color="#3156B8" \/>/, 'Match Policies page load-more chevron');
assert.match(app, /accessibilityState=\{\{ disabled: loadingMore \|\| loading \|\| refreshing, busy: loadingMore \}\}/, 'Prevent repeated taps during loading');
assert.match(app, /setRows\(page\.intakes\)/, 'Refresh restores first page');
assert.match(app, /setNextOffset\(page\.intakes\.length\)/, 'Refresh resets next offset to the first-page boundary');

assert.match(route, /if \(view === "mobile_list"\)/, 'Mobile server path must be specific');
assert.match(route, /if \(employeeRead\?\.mode === "or"\) query = query\.or\(employeeRead\.predicates\)/, 'Preserve employee read scope');
assert.match(route, /else if \(!employeeRead\) query = query\.or\(intakeReadScope\)/, 'Preserve partner read scope');

assert.match(api, /response\.status === 401 \|\| response\.status === 403/, 'Differentiate expired or rejected access');
assert.match(api, /Network connection failed/, 'Show actionable network failure');
assert.match(api, /console\.warn\('\[partner-policy-intakes\] read failed'/, 'Record safe error categories');
const detail = readFileSync('app/policy-intakes/[id].tsx', 'utf8');
assert.match(readFileSync('../web-portal/lib/policy-intake-status-buckets.ts', 'utf8'), /row.status === "ready_for_review"/, 'Ready-for-review intakes belong to canonical Action Required unless duplicate');
assert.match(app, /row\.ocr_status === 'completed' \? <PartnerStatusBadge label="Fetched"/, "Expose the same Fetched document-status badge as Operations");
assert.match(api, /export async function updatePartnerPolicyIntakeReview/, 'Mobile reviewer actions must use authenticated API');
assert.match(detail, /row.review_access.can_review/, 'Do not show reviewer actions to unauthorised accounts');
assert.match(detail, /row.review_access.can_finalize/, 'Finalization must require separate approve permission');
assert.match(detail, /Review & Finalize/, 'Keep the existing Operations handoff action');
assert.match(detail, /Resume Policy Onboarding/, 'Keep the resume action for in-review intakes');
assert.match(detail, /partnerPolicyIntakeReviewUrl\(row.id\)/, 'Use the existing trusted portal onboarding workflow');
assert.match(detail, /updatePartnerPolicyIntakeReview\(row.id, status, reviewNote.trim\(\)\)/, 'Keep reviewer request and reject actions on the server');
assert.doesNotMatch(detail, /access_token.*Linking|Linking.*access_token/, 'Never transmit authentication tokens in browser links');
assert.match(route, /identity.actor_kind !== "employee"/, 'Nonemployee Partners must never receive Operations review grants');
assert.match(route, /hasEffectiveCapability\(profile, "review_policy_intakes", "edit"\)/, 'Review requires effective edit permission');
assert.match(route, /hasEffectiveCapability\(profile, "finalize_policy_intakes", "approve"\)/, 'Finalize requires effective approve permission');
assert.match(route, /if \(!access.can_review \|\| identity.actor_kind !== "employee"\)/, 'Reject server mutations from regular Partner/POSP/MISP identities');
assert.match(route, /getPartnerEmployeeIntakeReadScope\(identity\)/, 'Mutations must preserve scoped access');
assert.match(route, /loadPolicyIntakeDuplicateMatches\(admin, \[intake\]\)/, 'Duplicates cannot be reviewed');
assert.match(route, /in\("status", \["processing", "ready_for_review", "in_review", "needs_attention"\]\)/, 'Closed intakes must not be mutated');
console.log('Partner app resilient policy intake page loading regression passed');
