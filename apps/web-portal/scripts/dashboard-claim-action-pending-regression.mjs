import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function fail(message) {
  throw new Error(`[dashboard-claim-action-pending] ${message}`);
}

const dataSource = readFileSync(resolve(process.cwd(), "app/dashboard-v2/dashboard-data.ts"), "utf8");
const viewSource = readFileSync(resolve(process.cwd(), "app/dashboard-v2/dashboard-view.tsx"), "utf8");

for (const expected of [
  "actionPendingVehicles: number",
  "new Set(",
  "openClaims.map((row) => row.vehicle_id)",
]) {
  if (!dataSource.includes(expected)) fail(`missing vehicle-level pending-action rule: ${expected}`);
}

if (!viewSource.includes('label: "Claim action pending"')) fail("dashboard label was not updated");
if (!viewSource.includes("value: data.claims.actionPendingVehicles")) fail("dashboard card is not using unique vehicle count");
if (!viewSource.includes('href: "/claims?queue=active"')) fail("dashboard card must open active claims");
if (viewSource.includes('label: "Claim documents pending"')) fail("legacy Claim documents pending attention card still exists");

console.log(JSON.stringify({
  metric: "Claim action pending",
  unit: "unique vehicles",
  source: "open claims",
  clickThrough: "/claims?queue=active",
  status: "ok",
}, null, 2));
