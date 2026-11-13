import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const helper = read("../lib/daily-workflow-audit.ts");
const intake = read("../app/policy-intakes/actions.ts");
const edit = read("../app/policies/life-health-case-edit-actions.ts");
const reject = read("../app/policies/life-health-case-reject-actions.ts");
const report = read("../lib/reports/daily-activity.ts");

for (const action of [
  "policy_intake_review_started",
  "policy_intake_attention_requested",
  "policy_intake_rejected",
  "policy_intake_response_uploaded",
  "life_health_case_edited",
  "life_health_case_remark_added",
  "life_health_case_rejected",
]) {
  assert.match(helper, new RegExp(action), `Audit action ${action} must be explicitly allowlisted`);
  assert.match(report, new RegExp(action), `Daily Report must recognize ${action}`);
}
assert.match(helper, /actor_id: entry.actorId/);
assert.match(helper, /table_name: entry.table/);
assert.match(helper, /record_id: entry.recordId/);
assert.doesNotMatch(helper, /new_data:|old_data:|reason:|remarks:|ocr_fields:/, "Audit must not include sensitive payloads");
assert.match(helper, /catch \{[\s\S]*?Audit service unavailable/, "Logging failure must be isolated");
assert.doesNotMatch(helper, /throw new Error|throw error/, "Audit helper must never interrupt business writes");
assert.match(intake, /if\(intake.status!=="in_review"\) await recordDailyWorkflowActivity/, "Review logged only on actual transition");
assert.match(intake, /if\(error\|\|!saved\)return\{ok:false as const,error:"Could not update this intake."\};[\s\S]*?recordDailyWorkflowActivity/, "Review status logged only on successful update");
assert.match(intake, /if\(updateError\|\|!savedResponse\)return\{ok:false,error:"Could not attach the replacement document."\};[\s\S]*?recordDailyWorkflowActivity/, "Response upload logged after success");
assert.match(edit, /if \(caseError \|\| !savedCase\) return[\s\S]*?recordDailyWorkflowActivity/, "Case edited after saved confirmation");
assert.match(edit, /if \(saveError \|\| !saved\) return[\s\S]*?recordDailyWorkflowActivity/, "Remark logged after successful append");
assert.match(reject, /if \(saveError \|\| !saved\) return[\s\S]*?recordDailyWorkflowActivity/, "Case rejection logged after status transition");
assert.doesNotMatch(intake + edit + reject, /recordDailyWorkflowActivity\([^\n]+reason|recordDailyWorkflowActivity\([^\n]+newRemark/, "Raw reasons or remarks are never sent to audit helper");
assert.match(report, /getEmployeeAccessScope\(viewer\.id, viewer\.role, "view_reports"\)/, "Reader still scopes all events by reporting hierarchy");
console.log("Phase 2 workflow audit coverage, actor attribution, privacy and failure isolation passed.");
