import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const source = read("../lib/reports/daily-activity.ts");
const page = read("../app/reports/(workspace)/daily/page.tsx");

assert.match(source,
  /if \(type === "policy"\) q = q\.or\("table_name\.eq\.policies,and\(table_name\.like\.policy_%,table_name\.neq\.policy_intake_requests\)"\)/,
  "Policy database predicate must exclude intake events before applying source pagination");
assert.match(source, /if \(name === "policy_intake_requests"\) return "intake"/,
  "Policy Intake is its own category");
assert.match(source, /if \(type !== "all" && group !== type\) continue;/,
  "Audit category must be checked before display");
assert.match(source, /else if \(type === "intake"\) q = q\.eq\("table_name", "policy_intake_requests"\)/,
  "Intake filter must include intake activity");
assert.match(source, /if \(\/upload\/i\.test\(action\)\) return "Uploaded"/,
  "Successful upload events are correctly labeled Uploaded");
assert.match(page, /const formatDate = new Intl\.DateTimeFormat\("en-IN"/,
  "Date formatter uses localized date");
assert.match(page, /const formatTime = new Intl\.DateTimeFormat\("en-IN"/,
  "Time formatter uses localized time");
assert.match(page, /timeZone:"Asia\/Kolkata",hour:"2-digit",minute:"2-digit",hour12:true/,
  "Time formatter uses IST and minutes");
assert.match(page, /const time = formatTime\.format\(occurredAt\)/,
  "Actual table uses the localized time with colon");
assert.doesNotMatch(page, /format\.formatToParts/,
  "Do not generate malformed HH MM AM/PM values by joining date parts with spaces");
assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/,
  "Daily Report reads remain non-mutating");
console.log("Daily Report Phase 5 policy/intake query separation and IST time accuracy passed.");
