import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const report = read("../app/intermediaries/applications/[id]/partner-business-report.tsx");
const filter = read("../app/intermediaries/applications/[id]/partner-business-period-filter.tsx");

assert.match(report, /<PartnerBusinessPeriodFilter basePath=\{basePath\}/, "Partner Business Report must use the instant filter.");
assert.doesNotMatch(report, /<button type="submit"[^>]*>Apply/, "No separate Apply button should remain.");
assert.doesNotMatch(report, /Apply dates/, "No separate custom-range Apply action should remain.");
assert.match(filter, /onChange=\{event => changePeriod\(event.target.value\)\}/, "Choosing a preset must apply immediately.");
assert.match(filter, /navigate\(next\)/, "Preset changes must navigate without a submit button.");
assert.match(filter, /if \(next === "custom"\) \{[\s\S]*?setVisible\(true\)/, "Custom must open the calendar.");
assert.match(filter, /function pickDate\(value: string\)/, "Calendar must support choosing dates.");
assert.match(filter, /navigate\("custom", start, value\)/, "Completing the range must apply automatically.");
assert.match(filter, /params\.set\("from", from\)/, "Custom from date must be in report URL.");
assert.match(filter, /params\.set\("to", to\)/, "Custom to date must be in report URL.");
assert.match(filter, /tab: "business", period: next, mix/, "Navigation must preserve Business Report tab and mix mode.");
assert.match(filter, /aria-label="Previous month"/, "Calendar must allow previous month navigation.");
assert.match(filter, /aria-label="Next month"/, "Calendar must allow next month navigation.");
assert.match(filter, /event\.key === "Escape"/, "Calendar must close using Escape.");
assert.match(filter, /closeOnOutside/, "Calendar must close after outside click.");
assert.match(report, /const exportParams = new URLSearchParams/, "Report export must retain the selected period.");

// Detailed Business MIS export must never place the full accessible customer
// directory in one URL (production failure was a 38,223-character GET).
const mis = read("../lib/reports/policy-business-mis-export.ts");
const route = read("../app/reports/export/policy-business/route.ts");
assert.match(mis, /const CUSTOMER_IDS_PER_REQUEST = 60/, "MIS customer scopes must be URL-safe batches.");
assert.match(mis, /customerIds\.slice\(index \* CUSTOMER_IDS_PER_REQUEST, \(index \+ 1\) \* CUSTOMER_IDS_PER_REQUEST\)/, "Every accessible ID must be partitioned without omission.");
assert.match(mis, /for \(const scopedIds of scopes\)/, "Export must load every authorized customer batch.");
assert.match(mis, /if \(scopedIds !== null\) request = request\.in\("customer_id", scopedIds\)/, "Each query must use ONLY its authorized customer IDs.");
assert.doesNotMatch(mis, /request\.in\("customer_id", customerIds\)/, "Do not send all accessible customers in one URL.");
for (const condition of [
  'fromDate', 'toDate', 'insurerId', 'rmEmployeeId',
  'intermediaryCode', 'businessLine', 'category',
]) assert.ok(mis.includes(`if (filters.${condition})`), `MIS must preserve the ${condition} filter`);
assert.match(mis, /rows\.length > MAX_EXPORT_ROWS/, "MIS must reject rather than silently truncate records.");
assert.match(mis, /rows\.sort\(/, "Combining customer batches must restore global issuance ordering.");
assert.match(mis, /a\.id\.localeCompare\(b\.id\)/, "Equal date rows require a deterministic policy tie-breaker.");
assert.match(route, /if \(truncated\)/, "Overflow must remain an HTTP 422, not a partial Excel file.");
assert.match(route, /loadPolicyBusinessMisExport\(profile, query\)/, "Authenticated report scope must remain server-controlled.");
const syntheticIds = Array.from({length: 1001}, (_, i) => `customer-${i}`);
const groups = Array.from(
  {length: Math.ceil(syntheticIds.length / 60)},
  (_, index) => syntheticIds.slice(index * 60, (index + 1) * 60),
);
assert.ok(groups.every(group => group.length <= 60));
assert.deepEqual(groups.flat(), syntheticIds, "Batch boundaries must not lose or duplicate authorized customers.");
console.log("Detailed Business MIS large-customer-scope export regression passed.");

console.log("Partner Business Report instant date filter regression passed.");
