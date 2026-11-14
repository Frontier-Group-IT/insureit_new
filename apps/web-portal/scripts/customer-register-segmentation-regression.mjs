import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
const page = read("../app/customers/page.tsx");
const nav = read("../components/claim-manager/app-navigation.tsx");
const workspace = read("../app/customers/customer-workspace.tsx");
const backoffice = read("../components/backoffice-customer-register.tsx");

assert.match(nav, /href:"\/customers",label:"Internal Customer"/, "Sidebar must expose Internal Customer.");
assert.match(nav, /href:"\/customers\?segment=external",label:"External Customer"/, "Sidebar must expose External Customer.");
assert.match(page, /requireCapability\("view_customers"\)/, "Customer permission checks must remain active.");
assert.match(page, /getAccessibleCustomerIds\(profile\.id, profile\.role\)/, "Employee customer scope must remain active.");
assert.match(page, /request = request\.in\("id", accessibleIds\)/, "Customer scope must apply before classification.");
assert.match(page, /external_policies:external_policies!external_policies_customer_id_fkey\(count\)/, "External customer identification must use actual external policy relationships.");
assert.match(page, /hasExternalPolicy && !hasInternalPolicy : hasInternalPolicy \|\| !hasExternalPolicy/, "Registers must partition the same permitted customers without overlap.");
assert.match(page, /policies: isExternalRegister \? customer\.external_policies : customer\.policies/, "External register must show its own policy counts.");
assert.match(page, /profile\.role === "relationship_manager"/, "Relationship Manager mobile masking must remain enabled.");
assert.match(page, /key=\{registerTitle\}/, "Switching registers must reset client-side filters and selection.");
assert.match(workspace, /title\?: string/, "Standard register must show the selected heading.");
assert.match(backoffice, /title\?: string/, "Read-only register must show the selected heading.");

const classify = (internal, external) => external > 0 && internal === 0 ? "external" : "internal";
const scenarios = [
  [1, 0, "internal"], [0, 1, "external"], [1, 1, "internal"], [0, 0, "internal"], [4, 3, "internal"],
];
for (const [internal, external, expected] of scenarios) assert.equal(classify(internal, external), expected);
assert.match(workspace, /const PAGE_SIZE = 15;/, "Both customer registers must display 15 records per page.");
assert.match(workspace, /Math\.ceil\(filteredRows\.length \/ PAGE_SIZE\)/, "Page count must use the 15-row page size.");
assert.match(workspace, /filteredRows\.slice\(\(safePage - 1\) \* PAGE_SIZE, safePage \* PAGE_SIZE\)/, "Rows must paginate in groups of 15.");
assert.match(workspace, /pageSize=\{PAGE_SIZE\}/, "Pagination label must use the same 15-row page size.");
assert.match(page, /<CustomerWorkspace key=\{registerTitle\}/, "Both Internal and External customer registers must share the page size.");
console.log("Customer internal/external register segmentation and 15-row pagination regression passed.");


const suggest = read("../components/customer-portal/customer-search-autocomplete.tsx");
const customerPolicies = read("../app/customer/(protected)/policies/page.tsx");
const customerPolicySearch = read("../app/customer/(protected)/policies/customer-policy-animated-search.tsx");
const customerVehicles = read("../app/customer/(protected)/vehicles/customer-vehicles-register.tsx");
const customerRenewals = read("../app/customer/(protected)/renewals/customer-renewals-register.tsx");
const customerClaims = read("../app/customer/(protected)/claims/page.tsx");
const customerClaimSearch = read("../app/customer/(protected)/claims/customer-claims-search.tsx");
assert.match(suggest, /q\.length < 2/, "Show suggestions after two characters.");
assert.match(suggest, /\.slice\(0, 5\)/, "Limit dropdown suggestions to five.");
assert.match(suggest, /createPortal\(/, "Keep dropdown above overflow-hidden register cards.");
assert.match(suggest, /ArrowDown/, "Support suggestion keyboard navigation.");
assert.match(suggest, /ArrowUp/, "Support reverse suggestion navigation.");
assert.match(suggest, /Escape/, "Support dismissal.");
assert.match(customerPolicies, /suggestions=\{policies\.filter/, "Use already authorized policy rows.");
assert.match(customerPolicySearch, /CustomerSearchAutocomplete/, "Policy register uses suggestions.");
assert.match(customerVehicles, /CustomerSearchAutocomplete/, "Vehicle register uses suggestions.");
assert.match(customerRenewals, /CustomerSearchAutocomplete/, "Renewal register uses suggestions.");
assert.match(customerClaims, /suggestions=\{enriched\.filter/, "Claim suggestions retain status-scope filtering.");
assert.match(customerClaimSearch, /CustomerSearchAutocomplete/, "Claim register uses suggestions.");



const autoSuggest = read("../components/operations-search-autocomplete.tsx");
const opsVehicle = read("../components/backoffice-vehicle-register.tsx");
const opsPolicy = read("../components/backoffice-policy-register.tsx");
const opsClaims = read("../app/claims/claims-workspace.tsx");
assert.match(autoSuggest, /q.length<2/, "Suggestions require two entered characters.");
assert.match(autoSuggest, /slice\(0,5\)/, "Suggestions are limited to five matches.");
assert.match(autoSuggest, /ArrowDown/, "Keyboard navigation must remain available.");
assert.match(autoSuggest, /Escape/, "Escape must dismiss suggestions.");
assert.match(autoSuggest, /createPortal\(/, "Dropdown must escape register overflow clipping.");
assert.match(autoSuggest, /prefers-reduced-motion/, "Animated prompts respect reduced motion.");
assert.match(backoffice, /OperationsSearchAutocomplete/, "Operations customer register uses authorized suggestions.");
assert.match(opsVehicle, /OperationsSearchAutocomplete/, "Operations vehicle register uses authorized suggestions.");
assert.match(opsPolicy, /OperationsSearchAutocomplete/, "Operations policy register uses authorized suggestions.");
assert.match(opsClaims, /OperationsSearchAutocomplete/, "Operations claims queue uses authorized suggestions.");


const policyClearSearch = read("../app/customer/(protected)/policies/customer-policy-animated-search.tsx");
assert.match(policyClearSearch, /params\.delete\("q"\)/, "Clearing Policy Search must remove stale server-side q.");
assert.match(policyClearSearch, /params\.delete\("page"\)/, "Clearing Policy Search must reset pagination.");
assert.match(policyClearSearch, /router\.replace\(/, "Clearing Policy Search must refresh results without a full-page reload.");
assert.match(policyClearSearch, /params\.set\("account", accountId\)/, "Clear search retains the selected authorized account.");
assert.match(policyClearSearch, /new URLSearchParams\(searchParams\.toString\(\)\)/, "Clear search retains selected source and lifecycle filters.");
assert.match(policyClearSearch, /onChange=\{changeSearch\}/, "Manual deletion and clear button must share the URL reset path.");
assert.doesNotMatch(suggest, /aria-label="Clear search"/, "Shared Customer autocomplete must not expose a clear button.");
assert.match(suggest, /onChange\(event\.target\.value\)/, "Shared Customer autocomplete retains controlled typing and manual deletion.");



const operationsClear = read("../components/operations-search-autocomplete.tsx");
const operationsPolicy = read("../components/backoffice-policy-register.tsx");
const operationsClaim = read("../app/claims/claims-workspace.tsx");
assert.match(operationsClear, /aria-label="Clear search"/, "Operations search fields provide an accessible clear action.");
assert.match(operationsClear, /function clearSearch\(\)\{onChange\(""\)/, "Clear button restores the unsearched register through controlled state.");
assert.match(operationsClear, /onClick=\{clearSearch\}/, "All shared operations search inputs use the clear action.");
assert.match(operationsPolicy, /onChange=\{value=>\{setQuery\(value\);setPage\(1\);\}\}/, "Policy searches reset pagination, including on clear.");
assert.match(operationsClaim, /if \(query\.trim\(\)\) params\.set\("q", query\.trim\(\)\)/, "Claim URL drops q after clearing.");


const customerPolicyDetail = read("../app/customer/(protected)/policies/[id]/page.tsx");
const policyHeroStart = customerPolicyDetail.indexOf('<section aria-labelledby="policy-detail-title"');
const policyHeroEnd = customerPolicyDetail.indexOf('</section>', policyHeroStart);
assert.ok(policyHeroStart >= 0 && policyHeroEnd > policyHeroStart, "Customer policy hero exists.");
const policyHero = customerPolicyDetail.slice(policyHeroStart, policyHeroEnd);
assert.match(policyHero, /id="policy-detail-title"[^>]*>\{policy\.policy_no\}<\/h1>/, "Policy hero retains the policy number heading.");
assert.match(policyHero, /getStaticInsurerLogo|insurerLogo/, "Policy hero retains insurer logo with existing fallback.");
assert.match(policyHero, /<StatusPill tone=\{status\.tone\}>\{statusLabel\}<\/StatusPill>/, "Policy hero retains status.");
assert.doesNotMatch(policyHero, /CopyPolicyNumber|sourceName|policy\.policy_type|policy\.insurer_name/, "Policy hero removes copy control and secondary text.");
assert.match(policyHero, /items-center gap-3/, "Policy number aligns vertically with insurer logo.");
assert.match(policyHero, /Vehicle<\/p>|Valid from<\/p>|Valid until<\/p>|Product<\/p>/, "Vehicle, validity and product summary remain in the header.");
assert.match(customerPolicyDetail, /<Detail label="Insurer" value=\{policy\.insurer_name\} \/>/, "Insurer remains available in policy details.");
assert.match(customerPolicyDetail, /<Detail label="Intermediary type" value=\{sourceName\} \/>/, "Source remains available in additional policy details.");
