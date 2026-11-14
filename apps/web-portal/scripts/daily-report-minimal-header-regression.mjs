import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const page=read("../app/reports/(workspace)/daily/page.tsx");
const quick=read("../components/reports/daily-report-quick-filters.tsx");
const panel=read("../components/reports/daily-self-activity-panel.tsx");

assert.doesNotMatch(page, />Daily Report<\/h2>/, "Remove duplicate Daily Report heading");
assert.doesNotMatch(page, /Recorded employee activities · India Standard Time/, "Remove subtitle");
assert.doesNotMatch(page, />Read-only<\/span>/, "Remove read-only badge");
assert.doesNotMatch(page, /History Period|<form|>Apply<|>Reset</, "Remove History Period and Apply/Reset controls");
assert.match(page, /Daily Report visibility/, "Self/All selector remains");
assert.match(page, /<DailyReportQuickFilters/, "Keep useful quick filters");
assert.match(page, /<DailySelfActivityPanel/, "Retain employee activity summary and drilldown");
assert.match(page, /<DailyEmployeeDirectory/, "Retain authorized employee directory");
assert.match(quick, /type="date"/, "Keep date filter");
assert.match(quick, /onChange=\{e=>chooseDate\(e.target.value\)\}/, "Apply date immediately on selection");
assert.match(quick, /params\.set\("period","day"\)/, "Selected date activates day history");
assert.match(quick, /params\.set\("period","all"\)/, "Clearing date restores All History");
assert.match(quick, /type="search"/, "Keep employee search in All directory");
assert.match(quick, /window\.setTimeout/, "Employee search updates automatically without button");
assert.match(quick, /router\.replace/, "Auto filters update route query rather than mutate data");
assert.match(panel, /My Activity Summary/, "Activity counts remain");
assert.doesNotMatch(page+quick, /\.insert\(|\.upsert\(|\.delete\(|\.update\(/, "No operational writes");
console.log("Daily Report minimalist header and automatic filters regression passed.");
