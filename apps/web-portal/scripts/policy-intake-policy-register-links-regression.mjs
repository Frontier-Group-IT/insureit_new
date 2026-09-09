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
assert(quickLinks.includes('.ui-page-stage a[href="/policies/new"]'), "Policy Intake quick links must mount beside the Policy Register Add Policy action");
assert(quickLinks.includes("summary.actionRequired !== null"), "RM summaries must not render the reviewer-only Action Required shortcut");
assert(quickLinks.includes('href="/policy-intakes?view=action"'), "Action Required must deep-link to the Policy Intake Action Required view");
assert(quickLinks.includes('href="/policy-intakes?view=in_review"'), "In Review must deep-link to the Policy Intake In Review view");
assert(quickLinks.includes("const active = count > 0"), "Quick-link urgency must be derived from whether the count is positive");
assert(quickLinks.includes('active ? "text-[#C62828]" : "text-[#64748B]"'), "Positive Policy Intake counts must be red while zero counts remain neutral");
assert(quickLinks.includes('hover:bg-[#F8FAFC]'), "Policy Intake quick links must reveal only a subtle rounded hover surface");
assert(quickLinks.includes("rounded-xl px-2.5 transition-colors"), "Policy Intake quick links must retain rounded hit targets without a permanent card treatment");
assert(quickLinks.includes('className="ml-auto shrink-0 text-[15px] font-black leading-4 tabular-nums"'), "Policy Intake quick-link counts must sit on the far right of each rounded hover target");
assert(!quickLinks.includes("ChevronRight"), "Policy Intake quick links must not render chevrons");
assert(!quickLinks.includes("tone=\"danger\""), "Policy Intake quick links must not use the reverted highlighted danger-card treatment");
assert(!quickLinks.includes("tone=\"review\""), "Policy Intake quick links must not use the reverted highlighted review-card treatment");
assert(!quickLinks.includes("rounded-2xl border"), "Policy Intake quick links must not render permanent bordered cards");
assert(!quickLinks.includes('bg-[#FEE2E2]'), "Policy Intake quick-link icons must remain flat without red icon tiles");
assert(!quickLinks.includes('bg-[#FEF0C7]'), "Policy Intake quick-link icons must remain flat without amber icon tiles");
assert(!quickLinks.includes("hover:-translate-y-0.5"), "Policy Intake quick links must not use raised card hover motion");

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
