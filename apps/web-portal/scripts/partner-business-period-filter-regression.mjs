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
console.log("Partner Business Report instant date filter regression passed.");
