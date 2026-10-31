import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(import.meta.dirname,"..");
const dashboard=readFileSync(resolve(root,"app/dashboard-v2/dashboard-data.ts"),"utf8");
const register=readFileSync(resolve(root,"app/policies/page.tsx"),"utf8");
assert.match(dashboard,/profile\.role === "relationship_manager" && access\.viewPolicies/);
assert.match(dashboard,/getAccessiblePolicyRmEmployeeIds\(profile\.id, profile\.role, "view_policies"\)/);
assert.match(dashboard,/query\.in\("rm_employee_id", rmEmployeeIds\)/);
assert.match(dashboard,/rmEmployeeIds !== undefined/);
assert.match(register,/getAccessiblePolicyRmEmployeeIds\(profile\.id, profile\.role, "view_policies"\)/);
assert.match(register,/query\.in\("rm_employee_id", accessibleRmEmployeeIds\)/);

// Applies to every authenticated RM, not a named account or a hardcoded RM ID.
assert.doesNotMatch(dashboard,/Parsottam|a8d8ef1f-914f-4e0c-93ab-694bcc99832d/);
assert.match(dashboard,/profile\.role === "relationship_manager"/);
// Keep non-RM Operations Head downline authorization and customer-based non-RM flows intact.
assert.match(dashboard,/isDownlineHead \? Boolean\(downlinePolicyFilter\)/);
assert.match(dashboard,/else if \(customerIds !== null\) query = query\.in\("customer_id", customerIds\)/);
console.log("RM Dashboard and Policy Register ownership filter regression passed");
