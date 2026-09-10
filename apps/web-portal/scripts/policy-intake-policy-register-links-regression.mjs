import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const policiesPage = read("app/policies/page.tsx");
assert(policiesPage.includes('hasEffectiveCapability(profile, "review_policy_intakes", "edit")'), "Policy Register reviewer shortcuts must remain permission-gated to Policy Intake reviewers");
assert(policiesPage.includes('hasEffectiveCapability(profile, "view_policy_intakes", "view")'), "Policy Register RM tracking must require Policy Intake view access");
assert(policiesPage.includes('profile.role === "relationship_manager" && canViewPolicyIntakes'), "Only Relationship Managers with Policy Intake view access may receive the owner-scoped shortcut");
assert(policiesPage.includes("loadPolicyIntakeReviewSummary(admin)"), "Policy Register reviewers must load the organization Policy Intake review summary");
assert(policiesPage.includes("loadPolicyIntakeReviewSummary(admin, { submittedByProfileId: profile.id, includeActionRequired: false })"), "RM Policy Register summary must be scoped to the logged-in RM and omit reviewer-only Action Required");
assert(policiesPage.includes("PolicyIntakePolicyRegisterLinksPortal"), "Policy Register must mount the Policy Intake quick-link portal");

const summary = read("lib/policy-intake-review-summary.ts");
assert(summary.includes("actionRequired: number | null"), "Policy Register summary must support hiding reviewer-only Action Required");
assert(summary.includes('query = query.eq("submitted_by_profile_id", options.submittedByProfileId)'), "Owner Policy Intake summaries must be filtered by the submitting profile before counts are calculated");
assert(summary.includes("options.includeActionRequired ?? true"), "Reviewer summaries must retain Action Required by default");
assert(summary.includes("loadPolicyIntakeDuplicateMatches(admin, rows)"), "Policy Register counts must use the same duplicate detector as the Policy Intake queue");
assert(summary.includes('status: "Duplicate"'), "Duplicate intakes must be excluded from actionable Policy Register counts");
assert(summary.includes('row.status === "ready_for_review" || (row.status === "processing" && row.ocr_status === "failed")'), "Action Required count must match the Policy Intake queue definition");
assert(summary.includes('row.status === "in_review"'), "In Review count must match the Policy Intake queue definition");
assert(summary.includes(".limit(500)"), "Policy Register summary must use the same visible queue limit as Policy Intakes");

const quickLinks = read("components/policy-intake-policy-register-links.tsx");
assert(quickLinks.includes('.ui-page-stage a[href="/policies/new"]'), "Policy Intake queue must mount beside the Policy Register Add Policy action");
assert(quickLinks.includes("summary.actionRequired !== null"), "RM summaries must not render the reviewer-only Action Required shortcut");
assert(quickLinks.includes('href="/policy-intakes?view=action"'), "Action Required must deep-link to the Policy Intake Action Required view");
assert(quickLinks.includes('href="/policy-intakes?view=in_review"'), "In Review must deep-link to the Policy Intake In Review view");
assert(quickLinks.includes('href="/policy-intakes"'), "The Policy Intake queue label must open the Policy Intake workspace");
assert(quickLinks.includes("Policy Intake"), "The header queue must clearly identify its counts as Policy Intake work");
assert(quickLinks.includes("Pending Queue"), "The header queue must clearly communicate that these counts are pending work");
assert(quickLinks.includes("ClipboardList"), "The grouped Policy Intake queue must retain a clear parent icon");
assert(quickLinks.includes("const totalPending = (summary.actionRequired ?? 0) + summary.inReview"), "The subtle attention indicator must be driven by actual pending Policy Intake work");
assert(quickLinks.includes("motion-safe:animate-pulse"), "Pending Policy Intake work must receive a restrained motion-safe attention pulse");
assert(quickLinks.includes("motion-reduce:transform-none"), "Queue micro-motion must respect reduced-motion preferences");
assert(quickLinks.includes("rounded-2xl border border-[#D7E2F2] bg-[#F6F9FF]"), "Policy Intake counts must render inside one subtle grouped queue surface");
assert(quickLinks.includes("motion-safe:hover:-translate-y-px"), "The grouped queue may use only a one-pixel restrained hover lift");
assert(quickLinks.includes("hover:shadow-[0_7px_18px_rgba(49,86,184,0.10)]"), "The grouped queue hover state must remain subtle rather than heavy");
assert(quickLinks.includes("const active = count > 0"), "Quick-link urgency must be derived from whether the count is positive");
assert(quickLinks.includes('variant === "action"'), "Action Required must keep its dedicated urgency treatment");
assert(quickLinks.includes('"text-[#C62828]"'), "Positive Action Required work must retain a red urgency tone");
assert(quickLinks.includes('"text-[#B54708]"'), "Positive In Review work must use a distinct review tone rather than looking like the same queue state");
assert(quickLinks.includes('"text-[#66758B]"'), "Zero Policy Intake counts must remain visually neutral");
assert(quickLinks.includes("motion-safe:group-hover/item:scale-105"), "Status counts may use only a restrained hover scale micro-interaction");
assert(!quickLinks.includes("AlertTriangle"), "Action Required must not render a separate status icon");
assert(!quickLinks.includes("Clock3"), "In Review must not render a separate status icon");
assert(!quickLinks.includes("ChevronRight"), "Policy Intake status links must not add chevrons that waste header space");
assert(!quickLinks.includes("hover:-translate-y-0.5"), "Policy Intake queue must not use the older larger raised-card motion");

const intakePage = read("app/policy-intakes/page.tsx");
assert(intakePage.includes("type PolicyIntakeSearchParams = { view?: string }"), "Policy Intake route must accept the view query parameter");
assert(intakePage.includes('if (value === "in_review") return "in_review"'), "In Review deep links must be valid for reviewer and owner views");
assert(intakePage.includes('return reviewer ? "action" : "all"'), "Non-reviewers must still reject reviewer-only Action Required as their default/deep-link fallback");
assert(intakePage.includes('if (!reviewer) query = query.eq("submitted_by_profile_id", profile.id)'), "Non-reviewer Policy Intake lists must remain restricted to records submitted by the logged-in user");
assert(intakePage.includes("initialView={initialView}"), "Policy Intake route must pass the deep-linked initial view into the workspace");

const workspace = read("components/policy-intake-workspace.tsx");
assert(workspace.includes("export type PolicyIntakeViewKey"), "Policy Intake view keys must remain explicit and typed");
assert(workspace.includes('useState<ViewKey>(initialView ?? (reviewer ? "action" : "all"))'), "Policy Intake workspace must honor the validated owner In Review deep link without granting reviewer defaults");
assert(workspace.includes('action: baseFiltered.filter((row) => row.status === "ready_for_review" || (row.status === "processing" && row.ocr_status === "failed")).length'), "Policy Intake workspace Action Required semantics must remain unchanged");
assert(workspace.includes('inReview: baseFiltered.filter((row) => row.status === "in_review").length'), "Policy Intake workspace In Review semantics must remain unchanged");
assert(workspace.includes("min-w-0 flex-1 [&>div]:w-full xl:[&>div]:!w-full"), "Policy Intake desktop status controls must expand into the remaining filter-row space");
assert(workspace.includes("xl:[&>div>button]:!min-w-0 xl:[&>div>button]:!flex-1"), "Policy Intake desktop status options must distribute across the available status-tab width");
assert(workspace.includes("items-center justify-between gap-1"), "Policy Intake reviewer controls must keep My Active Work pinned to the far right of the available filter row");

console.log("policy intake policy register links regression: ok");
