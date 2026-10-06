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

console.log("Life/Health native onboarding architecture regression passed.");
