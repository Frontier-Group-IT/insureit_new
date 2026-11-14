import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('app/policy-intakes.tsx', 'utf8');
// Empty selected status/search results use existing illustration assets, centered only
// when there are no rows (never replacing errors, loading, or populated results).
assert.match(app, /import \{ PartnerAssets \} from '@\/lib\/partner-assets'/, 'Reuse Partner App artwork registry');
assert.match(app, /debouncedQuery \? PartnerAssets\.emptyStates\.noSearchResults : PartnerAssets\.emptyStates\.noPolicies/, 'Use search artwork for empty search and policy artwork for empty status');
assert.match(app, /<Image[\s\S]*?style=\{styles\.emptyIllustrationImage\}[\s\S]*?resizeMode="contain"/, 'Render the illustration without cropping');
assert.match(app, /contentContainerStyle=\{\[styles\.content, !loading && !error && visibleRows\.length === 0 && styles\.emptyContent\]\}/, 'Only the successful empty state grows to fill available scroll area');
assert.match(app, /compactEmpty: \{ flex: 1, minHeight: 250,[^}]*justifyContent: 'center'/, 'Center illustration, title and message vertically');
assert.doesNotMatch(app, /styles\.emptyIllustrationAccent|styles\.emptyIllustration\}/, 'Remove the tiny legacy empty-state icon');
assert.match(app, /\{loading && !rows\.length \? \([\s\S]*?<PolicyIntakeSkeletonList \/>/, 'First-page loading uses compact skeleton cards');
assert.match(app, /function PolicyIntakeSkeletonList\(\)/, 'Loading skeleton is a dedicated component');
assert.match(app, /Array\.from\(\{ length: 7 \}/, 'Show seven reference-matching placeholders');
assert.match(app, /accessibilityLabel="Loading Policy Intakes" accessibilityRole="progressbar"/, 'Preserve an accessible loading description');
assert.match(app, /skeletonCard:|skeletonLogo:|skeletonStatus:/, 'Skeleton mirrors the logo, description and status card layout');
assert.doesNotMatch(app, /<PartnerStateView state="loading"/, 'Remove oversized loading card');
assert.match(app, /<PartnerStateView state="error"/, 'Errors retain their own state and retry');
assert.match(app, /visibleRows\.map\(\(row, index\) =>/, 'Available records remain visible with stagger index');
assert.match(app, /<View style=\{styles\.bottomNav\}>/, 'Bottom navigation remains outside the scroll body');

assert.match(app, /\{filter === 'all' \? <IntakeProgress row=\{row\} reduceMotion=\{reduceMotion\} \/> : null\}/, 'All shows the progress timeline for Completed and every other intake status');
assert.match(app, /const activeStep = row\.status === 'completed' \? 4 :/, 'Completed intake retains all four finished timeline stages');
assert.doesNotMatch(app, /filter === 'all' && row\.status !== 'completed'/, 'Do not hide Completed progress in All');
assert.doesNotMatch(app, /Customer name pending/, 'Missing names must not show placeholder');
assert.doesNotMatch(app, /<IntakeProgress row=\{row\} reduceMotion=\{reduceMotion\} \/>(?!\s*: null)/, 'Do not render an unconditional timeline in each status filter');
assert.match(app, /function IntakeProgress\(\{ row, reduceMotion \}: \{ row: PartnerPolicyIntake; reduceMotion: boolean \}\) \{/, 'Retain the existing per-record progress component with accessibility motion preference');
assert.doesNotMatch(app, /if \(row\.status === 'duplicate' \|\| row\.status === 'rejected'\) return null;/, 'All must show the timeline even for Duplicate and Rejected submissions');
assert.match(app, /const rejected = row\.status === 'rejected' \|\| row\.status === 'duplicate';/, 'Preserve rejected/duplicate progress indicator styling');
const api = readFileSync('lib/policy-intakes.ts', 'utf8');
const route = readFileSync('../web-portal/app/api/partner/policy-intakes/route.ts', 'utf8');

assert.match(app, /useState<IntakeFilter>\('action_required'\)/, 'Select Action Required by default on Policy Intake');
assert.match(app, /<Ionicons name="list" size=\{17\} color="#0860C8" \/>/, 'See all uses the reference list icon');
assert.doesNotMatch(app, /<Ionicons name="chevron-down" size=\{13\} color="#3156B8" \/>/, 'See all does not show a dropdown arrow');
assert.match(app, /seeAllButton:\s*\{[^}]*borderRadius:\s*18/, 'See all retains the rounded pill treatment');
assert.match(app, /const \[showAllStatuses, setShowAllStatuses\] = useState\(false\)/, 'See all sheet defaults closed');
assert.match(app, /accessibilityLabel="See all Policy Intake statuses"/, 'A visible See all control opens the selection sheet');
assert.match(app, /onPress=\{\(\) => setShowAllStatuses\(true\)\}/, 'See all must open the sheet');
assert.match(app, /<Modal[\s\S]*?visible=\{showAllStatuses\}[\s\S]*?animationType="slide"/, 'Use a slide-up bottom sheet');
assert.match(app, /<Text style=\{styles\.sheetTitle\}>Select status<\/Text>/, 'Bottom sheet has the status title');
assert.match(app, /\{FILTERS\.map\(\(item\) => \{[\s\S]*?accessibilityRole="radio"/, 'Reuse the existing seven status filters with single-select radio controls');
assert.match(app, /accessibilityState=\{\{ checked: selected \}\}/, 'Current selected status is highlighted accessibly');
assert.match(app, /setFilter\(item\.key\);\s*setShowAllStatuses\(false\);/, 'Tapping a status immediately filters and closes sheet');
assert.doesNotMatch(app, /Clear all|>Apply<|<Text[^>]*>Apply<\/Text>/, 'Single-select status sheet needs no Clear all or Apply buttons');
assert.match(app, /onRequestClose=\{\(\) => setShowAllStatuses\(false\)\}/, 'Back closes sheet without changing selection');
assert.match(app, /\{counts\[item\.key\]\}/, 'Status counts remain tied to the server-filter results');

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
assert.match(app, /row\.status === 'ready_for_review' \|\| row\.status === 'in_review'/, 'Only Ready and In Review become buttons');
assert.match(app, /styles\.openStatusReady : styles\.openStatusInReview/, 'Ready and In Review receive distinct solid button colors');
assert.match(app, /accessibilityRole="button"[\s\S]*?event\.stopPropagation\(\);[\s\S]*?router\.push\(\{ pathname: '\/policy-intakes\/\[id\]'/, 'Status button opens details once without triggering the parent card');
assert.match(app, /<PartnerStatusBadge label={statusLabel\(row\)} tone={statusTone\(row\)} \/>/, 'Other intake workflow states keep the existing badge');
assert.match(app, /openStatusText: \{ color: '#FFFFFF'/, 'Ready and In Review labels use white text');
assert.match(app, /styles\.openStatusButton/, 'Keep the action compact and aligned with the existing timestamp');
assert.match(app, /openStatusButton: \{ minHeight: 25, alignSelf: 'flex-end', paddingHorizontal: 7, borderRadius: 7/, 'Ready button must wrap text and chevron without a fixed minimum width');
assert.doesNotMatch(app, /openStatusButton: \{[^}]*minWidth/, 'Avoid oversized Ready button background');
assert.doesNotMatch(app, /<PartnerStatusBadge label="Fetched"/, 'Do not show a second Fetched pill');
assert.doesNotMatch(app, /accessibilityLabel="Document data fetched"/, 'No green OCR checkmark next to the PIR number');
assert.doesNotMatch(app, /<Ionicons name="checkmark" size=\{15\} color="#16A34A"/, 'Do not reintroduce the PIR green checkmark');
assert.ok(app.includes('<View style={styles.intakeNumberRow}>') && app.includes("<Text numberOfLines={1} style={styles.number}>{field(row, 'policy_number') || 'Policy pending'}</Text>"), 'Cards show policy number at the original title font size with honest pending fallback');
assert.match(app, /field\(row, 'insured_name'\) \|\| field\(row, 'customer_name'\) \|\| field\(row, 'name_of_insured'\)/, 'Customer name follows the mobile number using extracted insured-name data');
assert.match(app, /row\.lead_source_name \|\| 'Lead source unavailable'\} \(\$\{row\.submitted_by_name\?\.trim\(\) \|\| 'Submitter unavailable'\}\)/, 'Third line shows lead source followed by actual submitter in parentheses');
assert.doesNotMatch(app, /style=\{styles\.number\}>\{row\.intake_number\}/, 'Do not show PIR identifier as the title');
assert.match(route, /resolveIntakeSubmitterNames\(admin, intakes\)/, 'Mobile list must resolve actual submitters after authorized paging');
assert.match(route, /resolveIntakeSubmitterNames\(admin, listResult\.data \?\? \[\]\)/, 'Standard list uses the same canonical submitter resolution logic');
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
assert.doesNotMatch(app, /accessibilityLabel="Document data fetched"/, 'OCR success must not render an extra green check beside the PIR number');
assert.match(api, /export async function updatePartnerPolicyIntakeReview/, 'Mobile reviewer actions must use authenticated API');
assert.match(detail, /row.review_access.can_review/, 'Do not show reviewer actions to unauthorised accounts');
assert.match(detail, /row.review_access.can_finalize/, 'Finalization must require separate approve permission');
assert.match(detail, /Review & Finalize/, 'Keep the existing Operations handoff action');
assert.match(detail, /Resume Policy Onboarding/, 'Keep the resume action for in-review intakes');
assert.ok(detail.includes('await prepareNativePolicyOnboarding(latest.id, confirmedConflict, latest.reviewer_conflict_id)'), 'Native reviewer confirmation prepares app onboarding draft');
assert.match(detail, /updatePartnerPolicyIntakeReview\(row.id, status, reviewNote.trim\(\)\)/, 'Keep reviewer request and reject actions on the server');
assert.doesNotMatch(detail, /access_token.*Linking|Linking.*access_token/, 'Never transmit authentication tokens in browser links');
assert.match(route, /identity.actor_kind !== "employee"/, 'Nonemployee Partners must never receive Operations review grants');
assert.match(route, /hasEffectiveCapability\(profile, "review_policy_intakes", "edit"\)/, 'Review requires effective edit permission');
assert.match(route, /hasEffectiveCapability\(profile, "finalize_policy_intakes", "approve"\)/, 'Finalize requires effective approve permission');
assert.match(route, /if \(!access.can_review \|\| identity.actor_kind !== "employee"\)/, 'Reject server mutations from regular Partner/POSP/MISP identities');
assert.match(route, /getPartnerEmployeeIntakeReadScope\(identity\)/, 'Mutations must preserve scoped access');
assert.match(route, /loadPolicyIntakeDuplicateMatches\(admin, \[intake\]\)/, 'Duplicates cannot be reviewed');
assert.match(route, /in\("status", \["processing", "ready_for_review", "in_review", "needs_attention"\]\)/, 'Closed intakes must not be mutated');
// Duplicate details must agree with the canonical Operations website, not raw stored status.
assert.match(route, /const duplicateCheck = await loadPolicyIntakeDuplicateMatches\(admin, \[intake\]\)/, 'Detail must check the same canonical policy number matcher');
assert.match(route, /intake: match \? \{ \.\.\.namedIntake, status: "duplicate" \} : namedIntake/, 'Detail must retain effective duplicate state and authorized submitter name');
assert.match(route, /duplicate_match/, 'Detail must return the matching record details');
assert.match(route, /target_path: access.can_review \|\| access.can_finalize/, 'Link is only exposed to authorized Operations reviewers');
assert.match(route, /review_access: match \? \{ can_review: false, can_finalize: false \}/, 'Duplicate must not offer review or finalization actions');
assert.match(detail, /row.status === 'duplicate' && row.duplicate_match/, 'Mobile detail must display a duplicate notice');
assert.match(detail, /View Existing Policy/, 'Registered policy duplicates must link to the existing policy');
assert.match(detail, /View Earlier Intake/, 'Earlier intake duplicates must link to that intake');
assert.match(detail, /row\.attention_reason\?\.trim\(\) && row\.status !== 'duplicate'/, 'Duplicate must not offer replacement actions and empty Operations notes must not show a banner');
assert.match(detail, /!\['completed', 'rejected', 'duplicate'\]\.includes\(row.status\)/, 'Duplicate must not offer review actions');
assert.match(api, /export function partnerPolicyIntakeMatchUrl\(path: string\)/, 'Match destination must use trusted portal URL validation');
assert.ok(api.includes(String.raw`/^\/policies\/`), 'Registered policy URL must use the existing policy details view route');
assert.ok(api.includes(String.raw`/^\/policy-intakes\/`), 'Earlier intake URL must use existing intake detail route');

assert.match(detail, /const latest = await getPartnerPolicyIntake\(row\.id\)/, 'Resume must refresh authorized reviewer assignment before opening Operations');
assert.match(detail, /latest\.reviewer_conflict_name && !confirmedConflict/, 'Show conflict modal before browser navigation');
assert.match(detail, /<Modal transparent visible=\{Boolean\(reviewerConflictName\)\}/, 'Reviewer conflict uses compact in-app popup');
assert.match(detail, /Keep current reviewer/, 'Cancel preserves the existing reviewer');
assert.match(detail, /Change reviewer & continue/, 'Explicit confirmation is required before navigation');
assert.ok(detail.includes("pathname: '/policy-intakes/onboarding'"), 'Continue navigates within Partner App');
assert.doesNotMatch(detail, /takeOverReviewer|assigned_to_profile_id.*update/, 'App must not take over reviewer assignment directly');
assert.match(route, /reviewer_conflict_name: reviewerConflictName/, 'Server preflight supplies the conflict name');
assert.match(route, /access\.can_finalize && identity\.actor_kind === "employee"/, 'Reviewer name is revealed only with active finalizer access');
assert.match(route, /intake\.assigned_to_profile_id !== identity\.profile_id/, 'Only show the conflict for another assigned reviewer');

assert.match(api, /export async function createPartnerPolicyIntakeBridgeUrl/, 'Partner App requests secure one-use website handoff code');
assert.match(api, /refresh_token: session.refresh_token/, 'App transfers refresh token only via authenticated HTTPS request body');
assert.match(api, /policy-intakes\/bridge#code=/, 'Only opaque one-time code goes in URL fragment');
assert.doesNotMatch(api, /bridge\?access_token|bridge\?refresh_token/, 'Supabase credentials must not appear in browser URL');
assert.match(detail, /If you continue, the reviewer will be changed to you/, 'Single reviewer confirmation says what action will follow');
assert.match(route, /reviewer_conflict_id: reviewerConflictName \? intake.assigned_to_profile_id : null/, 'Exact reviewer is bound to takeover confirmation');

// Compact context-specific empty state should never affect the existing list query, pagination or error/loading states.
assert.match(app, /const EMPTY_SUBMISSION_COPY: Record<IntakeFilter,/, 'Each intake status has an explicit empty-state message');
for (const title of [
  'No action required', 'No submissions in review', 'Nothing processing right now',
  'No completed submissions yet', 'No duplicate submissions', 'No rejected submissions',
  'No policy submissions yet',
]) {
  assert.ok(app.includes(title), `Missing contextual empty state: ${title}`);
}
assert.match(app, /debouncedQuery \? 'No matching submissions' : EMPTY_SUBMISSION_COPY\[filter\]\.title/, 'Search takes precedence over filter empty copy');
assert.match(app, /styles\.compactEmpty/, 'Use a compact inline empty illustration, not an oversized panel');
assert.match(app, /styles\.emptyIllustration/, 'Use a subtle blue/purple illustration');
assert.doesNotMatch(app, /state="empty"/, 'Do not use the large shared empty-state card for filtered submissions');
assert.match(app, /!debouncedQuery && filter === 'all' && canPartnerAccess\(context, 'create_policy_intakes', 'edit'\)/, 'Only authorized users in an unfiltered All view see the Create first intake action');
assert.match(app, /onPress=\{\(\) => router\.push\('\/policy-intake-new'\)\}/, 'Create first intake keeps existing navigation');
assert.match(app, /<PolicyIntakeSkeletonList \/>/, 'Keep existing loading feedback with the skeleton list');
assert.match(app, /<PartnerStateView state="error"/, 'Keep existing error feedback');

const nativeForm = readFileSync('app/policy-intakes/onboarding.tsx', 'utf8');
const nativeClient = readFileSync('lib/policy-onboarding.ts', 'utf8');
const nativeApi = readFileSync('../web-portal/app/api/partner/policy-intakes/native-onboarding/route.ts', 'utf8');
assert.match(nativeForm, /Policy source & ownership/, 'Show source and ownership natively');
assert.match(nativeForm, /motorVehicleSection/, 'Motor insured and vehicle fields must be grouped under section 02');
assert.match(nativeForm, /Insured & vehicle/, 'Use the Operations vehicle section heading');
assert.match(nativeForm, /Policy product, premium & validity/, 'Motor policy and premium share section 03');
assert.match(nativeForm, /styles.registrationRow/, 'Keep the registration field and RC button in one row');
assert.match(nativeForm, /styles.registrationToggle/, 'Keep registration mode buttons in section heading');
assert.match(nativeForm, /Save & return to Intake/, 'Draft can be saved and reopened');
assert.match(nativeForm, /Book Active Policy/, 'Native Book Policy button uses shared server engine');
assert.ok(nativeForm.includes('bookNativePolicyOnboarding(id,revision,resolution,verifiedApprovalId)'), 'Booking uses revision-checked authenticated endpoint');
assert.match(nativeClient, /saveNativePolicyOnboarding/, 'Native draft uses authenticated API');
assert.match(nativeApi, /loadPolicyIntakeDuplicateMatches/, 'Native backend blocks duplicates');
assert.match(nativeApi, /onboardPolicyForVerifiedActor/, 'Native booking calls authoritative website booking engine');
assert.match(readFileSync('../web-portal/lib/policy-onboarding-engine.ts','utf8'), /save_motor_policy_with_date_approval_v1/, 'Native and website use the same transactional policy RPC');
assert.match(nativeApi, /hasEffectiveCapability\(profile,"finalize_policy_intakes","approve"\)/, 'Native API enforces Operations approve capability');
assert.match(nativeApi, /\.eq\("revision",body.revision as number\)/, 'Optimistic draft concurrency is preserved');
assert.ok(detail.includes("router.push({ pathname: '/policy-intakes/onboarding'"), 'Policy Onboarding opens in the native route');

// Motion must stay presentation-only and preserve search, status, pagination, and accessibility.
assert.match(app, /AccessibilityInfo\.isReduceMotionEnabled\(\)/, 'Respect OS reduced-motion preferences');
assert.match(app, /addEventListener\('reduceMotionChanged', setReduceMotion\)/, 'React to OS reduced-motion changes');
assert.match(app, /<Animated\.View style=\{\[styles\.searchBand, \{ opacity: searchEntrance, transform: \[\{ translateY: searchRise \}\] \}\]\}>/, 'Search band slides from bottom to top on screen focus');
assert.match(app, /searchRise\.setValue\(20\)/, 'Search begins below its final position');
assert.match(app, /onFocus=\{\(\) => setSearchFocused\(true\)\}/, 'Search focus shows a soft highlight');
assert.match(app, /<MotionFilterChip key=\{item\.key\} active=\{active\} reduceMotion=\{reduceMotion\}/, 'Every status chip has smooth selection transition');
assert.match(app, /<MotionCard key=\{row\.id\} index=\{index\} reduceMotion=\{reduceMotion\}>/, 'Each card has a capped staggered entrance');
assert.match(app, /Math\.min\(index, 7\) \* 42/, 'Card stagger stays short even when loading additional pages');
assert.match(app, /cardStatusBorder\(row\)/, 'Status-specific card accents do not change record semantics');
assert.match(app, /useNativeDriver: true/, 'Card and search animations use native-driver transforms');
assert.match(app, /scaleX: progressEntrance/, 'Only completed progress segments animate');
assert.match(app, /const visibleRows = rows;/, 'Motion does not re-filter authorized records');
// Completed, In Review and Ready alone receive the gentle status-pill zoom.
assert.match(app, /<StatusZoomPulse enabled=\{row\.status === 'completed' \|\| row\.status === 'ready_for_review' \|\| row\.status === 'in_review'\} reduceMotion=\{reduceMotion\}>/, 'Only Completed, Ready and In Review badges pulse');
assert.match(app, /function StatusZoomPulse\(/, 'Keep zoom scoped to the status pill');
assert.match(app, /toValue: 1\.045, duration: 550/, 'Limit pulse to a restrained 4.5 percent scale');
assert.match(app, /toValue: 1, duration: 550/, 'Return zoomed badge to its original scale');
assert.match(app, /if \(!enabled \|\| reduceMotion\)/, 'Honor system reduced-motion preference');
assert.match(app, /pulse\.stop\(\); scale\.stopAnimation\(\); scale\.setValue\(1\)/, 'Stop pulse when leaving the screen');
assert.match(app, /useNativeDriver: true/, 'Zoom animation should use native-driver transforms');
console.log('Partner app resilient policy intake page loading regression passed');
