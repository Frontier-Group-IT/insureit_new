import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isValidDailyProfileId, isValidDailyRecordId, selfDateWindow,
} from "../lib/reports/daily-history-validation.ts";

// Production profiles.id, audit_logs.actor_id and record IDs are standard UUIDs.
const validIds=[
  "a73e84c3-2e16-40c8-9f43-52abca981c25",
  "00000000-0000-0000-0000-000000000000",
  "A73E84C3-2E16-40C8-9F43-52ABCA981C25",
];
for(const id of validIds) {
  assert.equal(isValidDailyProfileId(id),true, `Valid 8-4-4-4-12 profile ID rejected: ${id}`);
  assert.equal(isValidDailyRecordId(id),true,"Valid linked record ID rejected");
}
for(const id of ["", "abc", "a73e84c3-2e16-40c8-52abca981c25", "a73e84c3-2e16-40c8-9f43-52abca981c2g"]) {
  assert.equal(isValidDailyProfileId(id),false,"Invalid ID must fail closed");
}
assert.deepEqual(selfDateWindow("2026-11-14"),{
  from:"2026-11-13T18:30:00.000Z",to:"2026-11-14T18:30:00.000Z",
});
assert.equal(selfDateWindow("2026-11-31"),null,"Nonexistent dates cannot widen the report");
assert.equal(selfDateWindow("2026-11-14abc"),null);
assert.equal(selfDateWindow(undefined),null,"All History deliberately has no date window");

const source=readFileSync(new URL("../lib/reports/daily-self-activity.ts",import.meta.url),"utf8");
assert.match(source,/if\(!isValidDailyProfileId\(viewerId\)\) throw/,"Self and selected employee authorization use valid UUIDs");
assert.match(source,/isValidDailyRecordId\(x\.recordId\?\?""\)/,"Audit references use same UUID validation");
assert.match(source,/if\(options\.day && !window\) throw/,"Malformed dates fail closed");
console.log("Daily Report authentic UUID and IST date-window tests passed.");
