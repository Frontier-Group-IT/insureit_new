import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveDailyReportActorIds as resolve } from "../lib/reports/daily-activity-actor-scope.ts";

const self = { mode: "self", profileIds: ["viewer", "unrelated"] };
const none = { mode: "none", profileIds: ["unrelated"] };
const team = { mode: "hierarchy", profileIds: ["colleague", "direct-report", "viewer", "direct-report"] };
const organization = { mode: "organization", profileIds: [] };

assert.deepEqual(resolve("viewer", "self", organization), ["viewer"], "Self must never inherit organization-wide access");
assert.deepEqual(resolve("viewer", "self", team), ["viewer"], "Self must never show downline");
assert.deepEqual(resolve("viewer", "all", self), ["viewer"], "Self-only role cannot expand using an All tab");
assert.deepEqual(resolve("viewer", "all", none), ["viewer"], "No hierarchy may not see unrelated actors");
assert.deepEqual(resolve("viewer", "all", team), ["viewer", "colleague", "direct-report"], "Hierarchy includes only authorized profile IDs");
assert.equal(resolve("viewer", "all", organization), null, "Organization-wide access remains an explicit resolver result");
assert.deepEqual(resolve("", "all", organization), [], "Unauthenticated identity fails closed");
assert.deepEqual(resolve("viewer", "all", {mode:"hierarchy",profileIds:[]}), ["viewer"], "Missing downline does not grant broad access");

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const source = read("../lib/reports/daily-activity.ts");
const page = read("../app/reports/(workspace)/daily/page.tsx");
assert.match(source, /resolveDailyReportActorIds\(viewer\.id, scope, access\)/, "All queries inherit verified actor scope");
assert.match(source, /\.in\("actor_id", actorIds\)/, "Audits are filtered server-side");
assert.match(source, /\.in\("finalized_by_profile_id",actorIds\)/, "Intake finalization is actor-scoped");
assert.match(source, /\.in\("converted_by",actorIds\)/, "Case conversions are actor-scoped");
assert.match(page, /await requireCapability\("view_reports"\)/, "Page requires report capability");
assert.doesNotMatch(source, /\.update\(|\.insert\(|\.upsert\(|\.delete\(/, "Report reader remains read-only");
console.log("Daily Report Phase 3 Self/All authorization matrix and source isolation passed.");
