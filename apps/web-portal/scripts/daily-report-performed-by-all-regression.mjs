import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../app/reports/(workspace)/daily/page.tsx");
const panel = read("../components/reports/daily-self-activity-panel.tsx");
const rows = read("../components/reports/daily-activity-history-rows.tsx");
const history = read("../lib/reports/daily-self-activity.ts");

assert.match(page, /reportMode=\{isSelf \? "self" : chosenPerson \? "employee" : "all"\}/);
assert.match(panel, /reportMode==="all" \? <th[^>]*>Performed By<\/th> : null/,
  "Only combined All shows the new header");
assert.match(panel, /showPerformedBy=\{reportMode==="all"\}/,
  "Only combined All passes performer visibility to rows");
assert.match(rows, /showPerformedBy \? <td[^>]*>\{customerField\(row\.performedByName\)\}<\/td> : null/,
  "Every category row shares the conditional performer cell");
assert.match(history, /actorId\?: string; performedByName\?: string/,
  "Each event may preserve its own actor without assigning an unrelated employee");

for (const [label, source] of [
  ["Audit", "a.actor_id"],
  ["Policy created", "a.created_by"],
  ["Intake submitted", "a.submitted_by_profile_id"],
  ["Intake finalized", "a.finalized_by_profile_id"],
  ["Case created", "a.created_by"],
  ["Case converted", "a.converted_by"],
  ["Claim created", "claim.created_by"],
  ["Claim stage", "edit.created_by"],
  ["Claim verification", "verification.verified_by"],
  ["Claim status", "event.changed_by"],
]) {
  assert.ok(history.includes("actorId:"+source), label+" must retain its own actor");
}
assert.match(history, /const visible=filtered\.slice\(start,start\+30\);[\s\S]*if\(combined\)/,
  "Only visible rows in combined All mode need name resolution");
assert.match(history, /actorIds\.includes\(id\)/, "Performer lookup stays within authorized actor scope");
assert.match(history, /\.select\("id,full_name"\)\.in\("id",visibleActorIds\)/,
  "Names are resolved in a single scoped profile lookup");
assert.doesNotMatch(history, /row\.performedByName=selfProfile/,
  "Current viewer is not a fallback for an unknown performer");
assert.doesNotMatch(history, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/,
  "Report remains read-only");
console.log("Daily Report combined All performer identity and conditional column regression passed.");
