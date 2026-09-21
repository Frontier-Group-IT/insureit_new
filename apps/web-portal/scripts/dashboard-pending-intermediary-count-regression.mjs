import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function fail(message) {
  throw new Error(`[dashboard-pending-intermediary-count] ${message}`);
}

const source = readFileSync(resolve(process.cwd(), "app/dashboard-v2/dashboard-data.ts"), "utf8");

for (const expected of [
  'new Set(["submitted", "under_review", "changes_requested"])',
  'row.partner_status === "active_partner"',
  'accountContext(row.draft_data) !== "partner"',
  'row.final_type === "partner"',
  '"documents_pending"',
  'queueProfile.workflow_stage !== "iib_processing"',
  'buildIntermediaryDocumentSlots',
]) {
  if (!source.includes(expected)) fail(`missing pending-queue rule: ${expected}`);
}

if (source.includes("completedIntermediaryStatuses")) {
  fail("dashboard must not count every non-completed onboarding stage as pending");
}

console.log(JSON.stringify({
  dashboardMetric: "Intermediary onboarding",
  rule: "pending applications queue only",
  excludes: ["training_pending", "training_in_progress", "active_partner"],
  status: "ok",
}, null, 2));
