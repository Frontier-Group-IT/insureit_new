import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../app/reports/(workspace)/daily/page.tsx");
const source = read("../lib/reports/daily-self-activity.ts");
const ui = read("../components/reports/daily-self-activity-panel.tsx");
const quickFilters = read("../components/reports/daily-report-quick-filters.tsx");

assert.match(page, /const isSelf = query\.scope !== "all"/, "Self is its own reporting mode");
assert.match(page, /loadSelfActivityHistory\(profile\.id/, "The Self report reads only the authenticated profile");
assert.match(page, /day: query\.period === "day" \? query\.date : undefined/, "Self defaults to all history, with opt-in date filter");
assert.match(page, /<DailySelfActivityPanel data=\{selfHistory\}/, "Self renders the category summary");
assert.match(page, /employeeDirectory = await loadDailyReportEmployeeDirectory\(profile\)/, "All tab now lists only authorized employees");
assert.match(page, /assertDailyReportEmployeeAllowed\(chosenPerson, employeeDirectory\)/, "All selected profile is checked before loading history");
assert.match(page, /resolveDailyReportPeriod\(query\)/, "Header period drives report history");
assert.match(page, /from: periodRange\.from, to: periodRange\.to/, "Period range filters actual event sources");

assert.match(source, /\.eq\("actor_id",viewerId\)/, "Audit records are scoped to the authenticated actor before reading");
assert.match(source, /\.eq\("created_by",viewerId\)/, "Policy and case creations use the employee's actual ID");
assert.match(source, /\.eq\("submitted_by_profile_id",viewerId\)/, "Policy intake creation is scoped to the employee");
assert.match(source, /\.eq\("finalized_by_profile_id",viewerId\)/, "Intake finalization is scoped to the finalizing employee");
assert.match(source, /\.eq\("converted_by",viewerId\)/, "Case conversion is scoped to the converting employee");
// Claims use their own existing actor-attributed records; do not invent audit
// events or credit the claim creator for someone else's update.
for (const [sourceName, actorColumn] of [
  ["Claim creation","created_by"],
  ["Claim stage edits","created_by"],
  ["Claim verification","verified_by"],
  ["Claim status history","changed_by"],
]) {
  assert.ok(source.includes('readDailyHistoryPages("'+sourceName+'"'), sourceName+" is included in source pagination");
  assert.match(source, new RegExp('\\.eq\\("'+actorColumn+'",viewerId\\)'), sourceName+" uses exact employee attribution");
}
assert.match(source, /driver_name/, "Driver edits are read from stored stage details");
assert.match(source, /previous!==driver/, "Changed driver names use stored before/after stage values");
assert.match(source, /Driver name: /, "Changed driver names have a readable field-level audit detail");
assert.match(source, /document_type,is_valid,created_at/, "Document verification reads retained verification outcome");
assert.match(source, /claim-verify:/, "Insurance Copy verification gets a stable unique report row");
assert.match(source, /event.from_status===event.to_status/, "Same-status notes are not duplicated as status changes");
assert.match(source, /row.claimControlNo=claim.claim_no/, "Claim details enrich only visible scoped records");

assert.match(source, /const counts=new Map<string,number>\(\)/, "Summary count is computed from all fetched recorded actions");
assert.match(source, /for\(const a of all\) counts\.set/, "Count is computed before selecting a category/page");
assert.match(source, /const filtered=category\?all\.filter/, "Drilldown includes only the selected category");
assert.match(source, /const partial = sources\.some\(s=>s\.result\.partial\)/, "Hard read caps and source failures mark incomplete counts");
assert.match(source, /if\(options\.day && !window\) throw/, "Malformed dates must not silently fetch all history");
assert.doesNotMatch(source, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/, "Self summary is strictly read-only");

assert.match(ui, /My Activity Summary/, "Self default is activity summary, not flat table");
assert.match(ui, /item\.count\.toLocaleString/, "Clickable category rows expose real computed totals");
assert.match(ui, /href=\{linkFor\(\{activity:item\.name,page:"1"\}\)\}/, "Clicking a category selects it");
assert.match(ui, /Back to summary/, "Drilldown returns to category totals");
assert.match(ui, /\$\{data\.category\} \(\$\{data\.selfName\}\)/, "Detail heading identifies the selected employee without a redundant table column");
assert.match(ui, /isOtherActivity \? \([\s\S]*?<th[^>]*>Employee Name<\/th>/, "Employee Name header appears only in Other Activities");
assert.match(ui, /Historical activity exceeds the safe read limit/, "Caps disclose incomplete counts");
console.log("Self history category totals, click-through details, source attribution and read-only regression passed.");
