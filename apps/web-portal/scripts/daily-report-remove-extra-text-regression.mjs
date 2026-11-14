import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const page=read("../app/reports/(workspace)/daily/page.tsx");
const panel=read("../components/reports/daily-self-activity-panel.tsx");
for(const phrase of [
  "Back to employees",
  "All recorded history",
  "Counts represent recorded actions, not necessarily distinct policy or customer records.",
  "Historical logs may not cover every action.",
  "Reports show existing recorded events and attributable creation/finalization history.",
  "Recorded employee activities · India Standard Time",
]) assert.ok(!(page+panel).includes(phrase),`Removed Daily Report phrase still present: ${phrase}`);
assert.doesNotMatch(page,/backToEmployees/, "Unused back-to-directory prop is removed");
assert.match(read("../components/reports/daily-report-header-controls.tsx"),/Daily Report visibility/, "Self and All switch moved beside Reports heading");
assert.match(page,/<DailySelfActivityPanel/, "Activity summary and detail remain");
assert.match(page,/<DailyEmployeeDirectory/, "Authorized employee directory remains");
assert.match(panel,/Back to summary/, "Category detail can return to summary");
assert.match(panel,/data\.unavailableSources/, "Operational partial-source warning is retained");
assert.match(panel,/data\.categories\.map/, "Category summaries remain");
assert.match(panel,/data\.rows\.map/, "Detail table remains");
console.log("Daily Report extra labels and disclaimers removed without changing report controls.");
