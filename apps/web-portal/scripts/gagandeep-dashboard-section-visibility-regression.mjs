import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const page = read("app/dashboard/page.tsx");
const view = read("app/dashboard-v2/dashboard-view.tsx");
assert.match(page, /hideLowerDashboardSections=\{profile\?\.id === "7bda6ffc-340e-48aa-bd3d-4f1f62cf85d9" && profile\.role === "sales_head"\}/,
  "Only the verified Gagandeep sales-head profile may hide lower dashboard sections.");
assert.match(view, /hideLowerDashboardSections\?: boolean;/);
assert.match(view, /hideLowerDashboardSections = false/,
  "Everyone else must retain the standard dashboard by default.");
assert.match(view, /!hideLowerDashboardSections && showHealth \? <PortfolioHealth/,
  "Hide Portfolio health for Gagandeep.");
assert.match(view, /!hideLowerDashboardSections && hasWork \? <WorkMovement/,
  "Hide bottom Policy Intake and Claim movement together for Gagandeep.");
assert.match(view, /access\.viewPolicies \? <BusinessPerformance/,
  "Keep the existing business performance section.");
assert.match(view, /attention\.length \? <NeedsAttention/,
  "Keep Needs attention and its existing policy-intake summary.");
console.log("Gagandeep-only dashboard section visibility regression passed.");
