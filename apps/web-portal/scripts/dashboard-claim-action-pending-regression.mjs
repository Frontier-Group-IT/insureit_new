import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function fail(message) {
  throw new Error(`[dashboard-summary-consistency] ${message}`);
}

const dataSource = readFileSync(resolve(process.cwd(), "app/dashboard-v2/dashboard-data.ts"), "utf8");
const viewSource = readFileSync(resolve(process.cwd(), "app/dashboard-v2/dashboard-view.tsx"), "utf8");
const intakeWorkspaceSource = readFileSync(resolve(process.cwd(), "components/policy-intake-workspace.tsx"), "utf8");

for (const expected of [
  "actionPendingVehicles: number",
  "new Set(",
  "openClaims.map((row) => row.vehicle_id)",
]) {
  if (!dataSource.includes(expected)) fail(`missing vehicle-level claim metric: ${expected}`);
}

if (viewSource.includes('label: "Claim action pending"')) fail("claim action data must not be duplicated in Needs attention");
if (viewSource.includes('label: "Assistance requested"')) fail("claim assistance data must not be duplicated in Needs attention");
if (!viewSource.includes('label: "Open claims"')) fail("top-level Open claims KPI must remain available");

for (const expected of [
  'row.status === "needs_attention"',
  'row.status === "ready_for_review"',
  'row.status === "in_review"',
]) {
  if (!dataSource.includes(expected)) fail(`dashboard intake status mapping missing: ${expected}`);
  if (!intakeWorkspaceSource.includes(expected)) fail(`policy intake queue status mapping missing: ${expected}`);
}

if (!dataSource.includes("payinPoliciesMtd: new Set(payins.map((row) => row.policy_id)).size")) {
  fail("Pay-In policy count must count a configured Pay-In row even when the selected amount is zero");
}
if (!dataSource.includes("payoutPoliciesMtd: new Set(payouts.map((row) => row.policy_id)).size")) {
  fail("Pay-Out policy count must count a configured Pay-Out row even when the selected amount is zero");
}

console.log(JSON.stringify({
  policyIntake: "dashboard and queue action buckets include needs_attention",
  claims: "claim summary remains in the primary KPI section, not Needs attention",
  commercial: "Pay-In/Pay-Out policy counts are based on configured policy rows, including zero amounts",
  status: "ok",
}, null, 2));
