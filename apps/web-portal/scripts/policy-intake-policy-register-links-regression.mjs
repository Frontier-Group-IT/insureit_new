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
assert(quickLinks.includes('href="/policies/life-health-cases"'), "Proposal Pending must open the Case Register");
assert(quickLinks.includes('label="Proposal"'), "The left divider heading must be Proposal");
assert(quickLinks.includes('label="Policy Intake"'), "Action Required and In Review must remain under one Policy Intake divider heading");
assert(quickLinks.includes(">Pending</span>"), "The Proposal section must communicate its pending count");
assert(quickLinks.includes("grid-cols-[118px_208px]"), "Proposal and Policy Intake must render as two grouped top-level sections");
assert(quickLinks.includes("grid-rows-[18px_30px]"), "Each grouped section must keep a compact divider-heading row above its metrics");
assert(quickLinks.includes("grid-cols-[112px_96px]"), "Action Required and In Review must share one row beneath Policy Intake");
assert(quickLinks.includes("border-r-2 border-[#AFC3DB]"), "Proposal and Policy Intake must retain a stronger center divider");
assert(quickLinks.includes("function DividerHeading"), "Section headings must be embedded into horizontal divider lines");
assert(quickLinks.includes("h-px w-3 shrink-0 bg-[#D7E2F2]"), "Divider headings must begin on a horizontal rule");
assert(quickLinks.includes("h-px min-w-0 flex-1 bg-[#D7E2F2]"), "Divider headings must continue the horizontal rule after the label");
assert(quickLinks.includes("const totalPending = (summary.actionRequired ?? 0) + summary.inReview"), "Proposal Pending must be driven by actual pending Policy Intake work");
assert(quickLinks.includes("const pendingActive = totalPending > 0"), "Proposal Pending urgency must be driven by whether pending work exists");
assert(quickLinks.includes('"text-[#C62828]"'), "Proposal Pending and positive Action Required work must use the same red urgency tone");
assert(quickLinks.includes('"text-[#B54708]"'), "Positive In Review work must use a distinct review tone");
assert(quickLinks.includes('"text-[#66758B]"'), "Zero Policy Intake counts must remain visually neutral");
assert(!quickLinks.includes("rounded-2xl border border-[#D7E2F2] bg-[#F6F9FF]"), "Policy Register summary must not render an outer card background");
assert(!quickLinks.includes("bg-[#FFF0F0]"), "Action Required and Proposal counts must not render badge backgrounds");
assert(!quickLinks.includes("bg-[#FFF7E8]"), "In Review counts must not render badge backgrounds");
assert(!quickLinks.includes("ring-inset"), "Policy Register counts must not render inset badge rings");
assert(quickLinks.includes("const active = count > 0"), "Quick-link urgency must be derived from whether the count is positive");
assert(quickLinks.includes('variant === "action"'), "Action Required must keep its dedicated urgency treatment");
assert(!quickLinks.includes("AlertTriangle"), "Action Required must not render a separate status icon");
assert(!quickLinks.includes("Clock3"), "In Review must not render a separate status icon");
assert(!quickLinks.includes("ChevronRight"), "Policy Intake status links must not add chevrons that waste header space");

const intakePage = read("app/policy-intakes/page.tsx");
assert(intakePage.includes("type PolicyIntakeSearchParams = { view?: string }"), "Policy Intake route must accept the view query parameter");
assert(intakePage.includes('if (value === "in_review") return "in_review"'), "In Review deep links must be valid for reviewer and owner views");
assert(intakePage.includes('return reviewer ? "action" : "all"'), "Non-reviewers must still reject reviewer-only Action Required as their default/deep-link fallback");
assert(intakePage.includes('if (!reviewer) query = query.eq("submitted_by_profile_id", profile.id)'), "Non-reviewer Policy Intake lists must remain restricted to records submitted by the logged-in user");
assert(intakePage.includes("initialView={initialView}"), "Policy Intake route must pass the deep-linked initial view into the workspace");

const caseRegister = read("app/policies/life-health-cases/page.tsx");
assert(caseRegister.includes('Case register'), "Proposal Pending destination must remain the Case Register");
assert(caseRegister.includes('type CaseFilter = "pending" | "issued" | "all"'), "Case Register must retain its pending default view");

const workspace = read("components/policy-intake-workspace.tsx");
assert(workspace.includes("export type PolicyIntakeViewKey"), "Policy Intake view keys must remain explicit and typed");
assert(workspace.includes('useState<ViewKey>(initialView ?? (reviewer ? "action" : "all"))'), "Policy Intake workspace must honor the validated owner In Review deep link without granting reviewer defaults");
assert(workspace.includes('action: baseFiltered.filter((row) => row.status === "ready_for_review" || row.status === "needs_attention" || (row.status === "processing" && row.ocr_status === "failed")).length'), "Policy Intake workspace Action Required semantics must include ready-for-review, needs-attention, and failed OCR rows");
assert(workspace.includes('inReview: baseFiltered.filter((row) => row.status === "in_review").length'), "Policy Intake workspace In Review semantics must remain unchanged");

console.log("policy intake policy register links regression: ok");
