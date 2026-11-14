import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DAILY_PAGE_SIZE, DAILY_MAX_PAGE, DAILY_SOURCE_CAP,
  dailyPageWindow, dailyHasMore,
} from "../lib/reports/daily-activity-pagination.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const source = read("../lib/reports/daily-activity.ts");
const panel = read("../components/reports/daily-self-activity-panel.tsx");

assert.equal(DAILY_PAGE_SIZE, 30);
assert.equal(DAILY_MAX_PAGE, 40);
assert.equal(DAILY_SOURCE_CAP, 1260);
assert.deepEqual(dailyPageWindow("1"), {page: 1, start: 0, sourceLimit: 60});
assert.deepEqual(dailyPageWindow("19"), {page: 19, start: 540, sourceLimit: 600});
assert.deepEqual(dailyPageWindow("40"), {page: 40, start: 1170, sourceLimit: 1230});
assert.equal(dailyPageWindow("10000").page, 1, "Long or malformed query values fail closed");
assert.equal(dailyPageWindow("999").page, 40, "Maximum requested page is bounded");
for (const input of ["-1", "0", "nan", "2abc", "Infinity", "1.4", "", "01"]) {
  assert.equal(dailyPageWindow(input).page, 1, `Invalid page query: ${input}`);
}
assert.deepEqual(dailyHasMore(553, 540, 19), {hasNext: false, truncated: false}, "553 events have a valid nineteenth page");
assert.deepEqual(dailyHasMore(553, 510, 18), {hasNext: true, truncated: false}, "Busy-day eighteenth page links to nineteenth");
assert.deepEqual(dailyHasMore(1245, 1170, 40), {hasNext: false, truncated: true}, "Busiest days beyond page forty disclose truncation");

assert.match(source, /const \{ page, start, sourceLimit \} = dailyPageWindow\(query.page\)/);
assert.match(source, /const limit = sourceLimit/);
assert.match(source, /dailyHasMore\(events.length, start, page\)/);
assert.match(source, /table_name\.eq\.policies,and\(table_name\.like\.policy_%,table_name\.neq\.policy_intake_requests\)/, "Policy filter includes related policy tables but excludes intake before pagination");
assert.match(source, /\.not\("table_name", "like", "policy_%"\)/, "Other activity filter excludes policy sub-types");
assert.match(source, /\.not\("table_name", "ilike", "claim%"\)/, "Other activity filter excludes claim sub-types");
assert.match(panel, /data\.partial/, "The employee history UI discloses incomplete safe-limit reads");
assert.match(panel, /These counts may be incomplete/, "Truncation messaging does not claim complete coverage");
assert.doesNotMatch(source, /\.update\(|\.insert\(|\.delete\(|\.upsert\(/, "Reader stays strictly read-only");
console.log("Daily Report Phase 4 busy-day paging and category precision regression passed.");
