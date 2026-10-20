import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const page = readFileSync(fileURLToPath(new URL("../app/dashboard/page.tsx", import.meta.url)), "utf8");
const view = readFileSync(fileURLToPath(new URL("../app/dashboard-v2/dashboard-view.tsx", import.meta.url)), "utf8");
const business = readFileSync(fileURLToPath(new URL("../app/dashboard-v2/dashboard-business.ts", import.meta.url)), "utf8");

assert.match(page, /const isRelationshipManager = profile\?\.role === "relationship_manager"/);
assert.match(page, /dashboardCommercialAccess = commercial \|\| isRelationshipManager/, "RM should retain authorized business overview");
assert.match(page, /dashboardCommercialOperationsAccess = !isRelationshipManager && accountsCapability && commercial/, "RM must never receive Commercial Operations data");
assert.match(page, /getDashboardBusinessData\(profile, query, dashboardCommercialAccess, dashboardCommercialOperationsAccess\)/);
assert.match(business, /if \(commercialAccess && accountsAccess && policyIds\.length\)/, "Commercial Operations fetch must be access-gated");
assert.match(view, /business\.commercial \? <CommercialOperations/, "Section must render only when authorized data exists");
console.log("RM Commercial Operations isolation regression passed.");
