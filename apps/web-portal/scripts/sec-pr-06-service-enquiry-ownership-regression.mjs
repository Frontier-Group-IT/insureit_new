import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";
const sql=readFileSync(new URL("../../../supabase/migrations/20261113090000_service_enquiry_customer_association_guard.sql",import.meta.url),"utf8");
for(const fragment of ["created_by = auth.uid()","c.profile_id = auth.uid()","source = 'customer_dashboard'","vehicle_id is null","claim_id is null","v.customer_id = service_enquiries.customer_id","cl.customer_id = service_enquiries.customer_id"])assert.ok(sql.includes(fragment),fragment);
assert.doesNotMatch(sql,/v\.customer_id\s*=\s*v\.customer_id|cl\.customer_id\s*=\s*cl\.customer_id/);
assert.doesNotMatch(sql,/drop policy[^\n]*select|drop policy[^\n]*update/i);
console.log("SEC-PR-06 customer association policy regression passed (static only).");
