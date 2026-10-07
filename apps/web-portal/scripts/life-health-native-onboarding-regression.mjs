import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(appRoot, relativePath));

function assert(condition, message) {
  if (!condition) throw new Error(`Life/Health native onboarding regression failed: ${message}`);
}

const unified = read("components/policy-unified-form.tsx");
const lifeHealth = read("components/life-health-policy-form.tsx");
const guard = read("components/policy-onboarding-product-guard.tsx");
const page = read("app/policies/new/page.tsx");
const routeLayout = read("app/policies/new/layout.tsx");
const summaryCss = read("app/policy-summary-stability.css");
const issuedEdit = read("components/life-health-issued-policy-edit-form.tsx");
const issuedEditAction = read("app/policies/life-health-issued-policy-edit-actions.ts");
const issuedEditPage = read("app/policies/[id]/edit/page.tsx");

assert(unified.includes('import { LifeHealthPolicyForm } from "@/components/life-health-policy-form";'), "PolicyUnifiedForm must own the Life/Health component import");
assert(unified.includes('const isLifeHealthPolicy=form.businessLine==="Life"||form.businessLine==="Health";'), "PolicyUnifiedForm must have an explicit Life/Health render branch");
assert(unified.includes('className="mx-auto w-full max-w-[1480px] pb-24"'), "shared onboarding workspace must explicitly occupy full available width");
assert(unified.includes('<LifeHealthPolicyForm key={form.businessLine}'), "Life/Health form must be rendered directly by PolicyUnifiedForm");
assert(unified.includes('source={{sourcingDate:form.issuanceDate'), "Life/Health must receive source state directly from React state");
assert(unified.includes('ID · {selectedSource.rmCode}'), "RM employee ID must be rendered natively in the shared source section");
assert(!unified.includes("PolicyTypeDevelopmentNotice"), "Life/Health must not fall back to the development notice");

assert(lifeHealth.includes("source: LifeHealthSourceSnapshot"), "LifeHealthPolicyForm must accept an explicit source snapshot prop");
assert(!lifeHealth.includes("sourceSnapshot("), "LifeHealthPolicyForm must not reconstruct source state from the DOM");
assert(!lifeHealth.includes("document.querySelector"), "LifeHealthPolicyForm must not query the document for source controls");
assert(lifeHealth.includes('id={`policy-section-${Number(number)}`}'), "Life/Health section IDs must align with section navigation targets");
assert(lifeHealth.includes('const PAYMENT_MODES = ["Cheque", "NEFT/RTGS", "UPI", "Credit/Debit Card", "Net Banking"];'), "Life/Health payment modes must not offer Cash");
assert(lifeHealth.includes('label="Address"'), "Life/Health customer section must include Address");
assert(unified.includes('label={isLifeHealthPolicy?"Proposal date":"Policy issuance date"}'), "Life/Health source date must be labeled Proposal date without changing other policy types");

assert(!guard.includes('createPortal'), "product guard must not portal-mount Life/Health onboarding");
assert(!guard.includes('data-life-health-native-portal'), "product guard must not create a Life/Health DOM mount point");
assert(!guard.includes('ensureLifeHealthMount'), "legacy Life/Health mount helper must be removed");
assert(!guard.includes('restoreLifeHealthMount'), "legacy Life/Health mount cleanup must be removed");

assert(!page.includes("PolicyLifeHealthOnboardingEnhancements"), "new policy page must not install the old Life/Health DOM enhancement observer");
assert(!routeLayout.includes("policy-summary-width.css"), "new policy route must not load the old Life/Health width rescue stylesheet");
assert(!summaryCss.includes("data-life-health"), "global summary stability CSS must not contain Life/Health portal rescue selectors");
assert(!exists("app/policies/new/policy-summary-width.css"), "old Life/Health route width rescue stylesheet must stay deleted");
assert(!exists("components/policy-life-health-onboarding-enhancements.tsx"), "old Life/Health MutationObserver enhancement bridge must stay deleted");

assert(issuedEdit.includes('commercialModal==="payin"?<ProjectedPayinModal'), "issued Life/Health edit must open the onboarding-style Projected Insurer Pay-in modal");
assert(issuedEdit.includes('commercialModal==="payout"?<PartnerPayoutModal'), "issued Life/Health edit must open the onboarding-style Partner Payout modal");
assert(issuedEdit.includes('title="Projected Insurer Pay-in"'), "issued Life/Health Pay-in modal title must match onboarding");
assert(issuedEdit.includes('title="Partner Payout"'), "issued Life/Health payout modal title must match onboarding");
assert(issuedEdit.includes('Save & Close'), "issued Life/Health commercial modals must preserve the onboarding Save & Close action");
assert(issuedEdit.includes('createPortal('), "issued Life/Health commercial modal must portal above the edit workspace like onboarding");
assert(!issuedEdit.includes('>{editing?"Done":"Edit"}</button>'), "issued Life/Health edit must not use the old inline Edit/Done commercial expansion");
assert(issuedEdit.includes("payinAfterTds: totalPayin - tds") || issuedEdit.includes("const payinAfterTds = totalPayin - tds"), "issued Life/Health edit must calculate Pay-in after TDS");
assert(issuedEdit.includes("retention:payinAfterTds-totalPayout"), "issued Life/Health edit must calculate retention from after-TDS Pay-in less payout");
assert(issuedEditAction.includes('total_projected_payin: totalProjectedPayin'), "issued Life/Health save must synchronize total projected Pay-in");
assert(issuedEditAction.includes('tds_amount: tdsAmount'), "issued Life/Health save must synchronize Pay-in TDS");
assert(issuedEditAction.includes('payin_after_tds: payinAfterTds'), "issued Life/Health save must synchronize after-TDS Pay-in");
assert(issuedEditAction.includes('retention_amount: retentionAmount'), "issued Life/Health save must synchronize payout retention");
assert(issuedEditPage.includes('retention:payinAfterTds - partnerPayout'), "issued Life/Health edit page must derive retention from current commercial components instead of stale stored retention");

console.log("Life/Health native onboarding architecture regression passed.");
