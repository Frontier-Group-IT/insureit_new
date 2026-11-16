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
assert.match(read("../components/reports/daily-report-header-controls.tsx"),/Daily Report employee selector/, "Employee selection is beside Reports heading");
assert.match(page,/<DailySelfActivityPanel/, "Activity summary and detail remain");
assert.doesNotMatch(page,/<DailyEmployeeDirectory/, "Standalone All directory removed");
assert.match(panel,/Back to summary/, "Category detail can return to summary");
assert.match(panel,/data\.unavailableSources/, "Operational partial-source warning is retained");
assert.match(panel,/categoryGroups\.map/, "Grouped category summaries remain");
assert.match(panel,/<DailyActivityHistoryRows rows=\{data\.rows\}/, "Detail table passes report rows to interactive renderer");
assert.match(read("../components/reports/daily-activity-history-rows.tsx"),/rows\.map/, "Clickable row renderer retains all records");
console.log("Daily Report extra labels and disclaimers removed without changing report controls.");
