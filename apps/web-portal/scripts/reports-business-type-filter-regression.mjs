import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const finance = await readFile(new URL("../lib/reports/finance.ts", import.meta.url), "utf8");
const policyBusiness = await readFile(new URL("../lib/reports/policy-business.ts", import.meta.url), "utf8");
const compactFilters = await readFile(new URL("../components/reports/report-compact-filters.tsx", import.meta.url), "utf8");
const businessPage = await readFile(new URL("../app/reports/(workspace)/business/page.tsx", import.meta.url), "utf8");

const businessLines = ["Motor", "Non Motor", "Life", "Health"];

assert.match(
  finance,
  /businessLine:"Motor"\|"Non Motor"\|"Life"\|"Health"\|null/,
  "Finance reporting must support the same four business lines as the Business report.",
);
assert.match(
  finance,
  /function businessLine\([^)]*\)[^{]*\{return v==="Motor"\|\|v==="Non Motor"\|\|v==="Life"\|\|v==="Health"\?v:null\}/,
  "Finance filter parsing must preserve Motor, Non Motor, Life and Health instead of collapsing Life/Health to All Business.",
);
assert.match(
  finance,
  /p_business_line:filters\.businessLine/,
  "The validated business line must be forwarded to get_finance_report_v4.",
);

assert.match(
  policyBusiness,
  /businessLine: "Motor" \| "Non Motor" \| "Life" \| "Health" \| null/,
  "Policy Business reporting must keep the same four-line filter contract.",
);
for (const line of businessLines) {
  assert.ok(
    compactFilters.includes(`{value:"${line}",label:"${line}"}`),
    `Reports business selector must keep the ${line} option.`,
  );
}

assert.match(
  businessPage,
  /const businessQuery: PolicyBusinessQuery = \{ \.\.\.query,/,
  "Business report must receive the page query, including the business filter.",
);
assert.match(
  businessPage,
  /const financeQuery: FinanceQuery = \{ \.\.\.query,/,
  "Finance report must receive the same page query, including the business filter.",
);
assert.match(businessPage, /<CommercialFlow finance=\{finance\}/, "Summary commercials must come from the filtered finance report.");
assert.match(businessPage, /buildInsurerRows\(finance\)/, "Insurer rows must come from the filtered finance report.");
assert.match(businessPage, /buildRmRows\(finance\)/, "RM rows must come from the filtered finance report.");
assert.match(businessPage, /buildIntermediaryRows\(finance, report\)/, "Intermediary rows must come from the filtered finance report.");

console.log("Reports business-type global filter regression passed.");
