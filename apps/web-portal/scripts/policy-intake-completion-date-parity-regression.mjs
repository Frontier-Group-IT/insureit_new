import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { policyIntakeActivityTimestamp, sortPolicyIntakesByActivity, policyIntakeStatusCounts } from "../lib/policy-intake-status-buckets.ts";

const oldCompleted = {id:"old-completed",status:"completed",created_at:"2026-11-14T06:13:00Z",finalized_at:"2026-11-16T05:59:00Z",ocr_status:"completed"};
const sameDayCompleted = {id:"same-day",status:"completed",created_at:"2026-11-16T04:05:00Z",finalized_at:"2026-11-16T04:43:00Z",ocr_status:"completed"};
const pending = {id:"pending",status:"processing",created_at:"2026-11-15T10:00:00Z",finalized_at:null,ocr_status:"pending"};
const sorted = sortPolicyIntakesByActivity([pending,sameDayCompleted,oldCompleted]);
assert.deepEqual(sorted.map(row=>row.id),["old-completed","same-day","pending"]);
assert.equal(policyIntakeActivityTimestamp(oldCompleted),oldCompleted.finalized_at);
assert.equal(policyIntakeActivityTimestamp(pending),pending.created_at);
assert.equal(policyIntakeStatusCounts(sorted,new Set()).completed,2);
assert.equal(oldCompleted.created_at,"2026-11-14T06:13:00Z", "original audit submission must not change");
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const operations=readFileSync(resolve(root,"app/policy-intakes/page.tsx"),"utf8");
const workspace=readFileSync(resolve(root,"components/policy-intake-workspace.tsx"),"utf8");
const api=readFileSync(resolve(root,"app/api/partner/policy-intakes/route.ts"),"utf8");
const partner=readFileSync(resolve(root,"../partner-app/app/policy-intakes.tsx"),"utf8");
assert.match(operations,/sortPolicyIntakesByActivity\(data \?\? \[\]\)/);
assert.match(operations,/created_at,finalized_at,ocr_status/);
assert.match(workspace,/dateValue\(policyIntakeActivityTimestamp\(row\)\)/);
assert.match(workspace,/Completed on: \{formatDateTime\(row\.finalized_at\)\}/);
assert.match(api,/sortPolicyIntakesByActivity\(filter === "all"/);
assert.match(api,/ocr_fields,created_at,finalized_at/);
assert.match(partner,/Completed: \$\{formatDate\(row\.finalized_at\)\}/);
console.log("Policy Intake completed-date parity regression passed");
