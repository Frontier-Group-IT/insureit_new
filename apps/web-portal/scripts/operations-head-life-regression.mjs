import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { roleCapabilities, roleLabels } from "../lib/roles.ts";

const read = (name) => readFileSync(resolve(process.cwd(),name),"utf8");
assert.equal(roleLabels.operations_head_life,"Operations Head - Life");
assert.deepEqual(roleCapabilities.operations_head_life,["view_policies"],
  "Never enable edits before Life/Health and downline server guards exist");
const scope=read("lib/employee-access-scope.ts");
assert.match(scope,/role === "operations_head_life"/);
assert.match(scope,/ac167429-0ce0-4ffe-90ea-4040cb4fea95/);
assert.match(scope,/descendantIds\(root, employees\)/);
const policy=read("lib/policy-access-scope.ts");
assert.match(policy,/role === "operations_head_life"/);
assert.match(policy,/\.in\("business_line", \["Life", "Health"\]\)/);
const register=read("app/policies/page.tsx");
assert.match(register,/profile\.role === "operations_head_life"/);
assert.match(register,/query = query\.in\("business_line", \["Life", "Health"\]\)/);
const middleware=read("middleware.ts");
assert.match(middleware,/check\.role === "operations_head_life" && !isOperationsHeadLifePath\(pathname\)/);
const nav=read("components/claim-manager/app-navigation.tsx");
assert.match(nav,/role==="operations_head_life"/);
const migration=read("../../supabase/migrations/20261023101500_operations_head_life_role.sql");
assert.match(migration,/add value if not exists 'operations_head_life'/);
console.log("Operations Head Life provisional isolation contract passed.");
