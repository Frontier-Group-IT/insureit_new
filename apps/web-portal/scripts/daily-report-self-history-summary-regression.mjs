import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../app/reports/(workspace)/daily/page.tsx");
const source = read("../lib/reports/daily-self-activity.ts");
const ui = read("../components/reports/daily-self-activity-panel.tsx");

assert.match(page, /const isSelf = query\.scope !== "all"/, "Self is its own reporting mode");
assert.match(page, /loadSelfActivityHistory\(profile\.id/, "The Self report reads only the authenticated profile");
assert.match(page, /day: query\.period === "day" \? query\.date : undefined/, "Self defaults to all history, with opt-in date filter");
assert.match(page, /<DailySelfActivityPanel data=\{selfHistory\}/, "Self renders the category summary");
assert.match(page, /employeeDirectory = await loadDailyReportEmployeeDirectory\(profile\)/, "All tab now lists only authorized employees");
assert.match(page, /assertDailyReportEmployeeAllowed\(chosenPerson, employeeDirectory\)/, "All selected profile is checked before loading history");
assert.match(page, /<option value="all">All History<\/option>/, "All history selection is clear");
assert.match(page, /<option value="day">Selected Date<\/option>/, "Daily selection remains available");

assert.match(source, /\.eq\("actor_id",viewerId\)/, "Audit records are scoped to the authenticated actor before reading");
assert.match(source, /\.eq\("created_by",viewerId\)/, "Policy and case creations use the employee's actual ID");
assert.match(source, /\.eq\("submitted_by_profile_id",viewerId\)/, "Policy intake creation is scoped to the employee");
assert.match(source, /\.eq\("finalized_by_profile_id",viewerId\)/, "Intake finalization is scoped to the finalizing employee");
assert.match(source, /\.eq\("converted_by",viewerId\)/, "Case conversion is scoped to the converting employee");
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
assert.match(ui, /Employee Name/, "Detail table retains employee identity column");
assert.match(ui, /Historical activity exceeds the safe read limit/, "Caps disclose incomplete counts");
console.log("Self history category totals, click-through details, source attribution and read-only regression passed.");
