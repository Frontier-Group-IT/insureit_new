import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const policiesPage = read("app/policies/page.tsx");
assert(policiesPage.includes('hasEffectiveCapability(profile, "review_policy_intakes", "edit")'), "Policy Register quick links must remain permission-gated to Policy Intake reviewers");
assert(policiesPage.includes("loadPolicyIntakeReviewSummary(admin)"), "Policy Register must load the Policy Intake review summary");
assert(policiesPage.includes("PolicyIntakePolicyRegisterLinksPortal"), "Policy Register must mount the Policy Intake quick-link portal");

const summary = read("lib/policy-intake-review-summary.ts");
assert(summary.includes("loadPolicyIntakeDuplicateMatches(admin, rows)"), "Policy Register counts must use the same duplicate detector as the Policy Intake queue");
assert(summary.includes('status: "Duplicate"'), "Duplicate intakes must be excluded from actionable Policy Register counts");
assert(summary.includes('row.status === "ready_for_review" || (row.status === "processing" && row.ocr_status === "failed")'), "Action Required count must match the Policy Intake queue definition");
assert(summary.includes('row.status === "in_review"'), "In Review count must match the Policy Intake queue definition");
assert(summary.includes(".limit(500)"), "Policy Register summary must use the same visible queue limit as Policy Intakes");

const quickLinks = read("components/policy-intake-policy-register-links.tsx");
assert(quickLinks.includes('.ui-page-stage a[href="/policies/new"]'), "Policy Intake quick links must mount beside the Policy Register Add Policy action");
assert(quickLinks.includes('href="/policy-intakes?view=action"'), "Action Required must deep-link to the Policy Intake Action Required view");
assert(quickLinks.includes('href="/policy-intakes?view=in_review"'), "In Review must deep-link to the Policy Intake In Review view");
assert(quickLinks.includes('text-[#C62828]'), "Policy Intake quick links must keep the approved red emphasis");

const intakePage = read("app/policy-intakes/page.tsx");
assert(intakePage.includes("type PolicyIntakeSearchParams = { view?: string }"), "Policy Intake route must accept the view query parameter");
assert(intakePage.includes('return value === "in_review" ? "in_review" : "action"'), "Reviewer deep links must resolve only to Action Required or In Review");
assert(intakePage.includes("initialView={initialView}"), "Policy Intake route must pass the deep-linked initial view into the workspace");

const workspace = read("components/policy-intake-workspace.tsx");
assert(workspace.includes("export type PolicyIntakeViewKey"), "Policy Intake view keys must remain explicit and typed");
assert(workspace.includes('useState<ViewKey>(reviewer ? (initialView ?? "action") : "all")'), "Policy Intake reviewers must open the requested deep-linked view while non-reviewers remain on All");
assert(workspace.includes('action: baseFiltered.filter((row) => row.status === "ready_for_review" || (row.status === "processing" && row.ocr_status === "failed")).length'), "Policy Intake workspace Action Required semantics must remain unchanged");
assert(workspace.includes('inReview: baseFiltered.filter((row) => row.status === "in_review").length'), "Policy Intake workspace In Review semantics must remain unchanged");

console.log("policy intake policy register links regression: ok");
