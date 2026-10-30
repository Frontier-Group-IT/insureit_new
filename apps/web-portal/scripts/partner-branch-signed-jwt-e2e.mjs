// Opt-in true signed-JWT cross-Branch E2E regression.
// No credentials hardcoded or logged. Run with real, authorized staging test users.
// Required: SUPABASE_URL, SUPABASE_ANON_KEY, BRANCH_A_JWT, BRANCH_B_JWT,
// PARENT_JWT, BRANCH_A_POLICY_ID. Optional: BRANCH_A_CUSTOMER_ID, BRANCH_A_CLAIM_ID.
import assert from "node:assert/strict";
const required = ["SUPABASE_URL","SUPABASE_ANON_KEY","BRANCH_A_JWT","BRANCH_B_JWT","PARENT_JWT","BRANCH_A_POLICY_ID"];
for (const name of required) if (!process.env[name]) throw new Error(`Missing environment variable ${name}; no test executed`);
const base = process.env.SUPABASE_URL.replace(/\/$/,"");
async function rpc(jwt,name,args={}) {
 const res=await fetch(base+"/rest/v1/rpc/"+name,{
  method:"POST",
  headers:{apikey:process.env.SUPABASE_ANON_KEY,Authorization:"Bearer "+jwt,"Content-Type":"application/json"},
  body:JSON.stringify(args)
 });
 const text=await res.text();
 if (!res.ok) throw new Error(`RPC ${name} returned HTTP ${res.status}: access check aborted`);
 return JSON.parse(text);
}
const [a,b,parent]=await Promise.all([
 rpc(process.env.BRANCH_A_JWT,"partner_branch_authorized_policy_ids"),
 rpc(process.env.BRANCH_B_JWT,"partner_branch_authorized_policy_ids"),
 rpc(process.env.PARENT_JWT,"partner_branch_authorized_policy_ids")
]);
const target=process.env.BRANCH_A_POLICY_ID;
assert.ok(a.some(x=>x.policy_id===target),"Branch A must see its assigned policy");
assert.ok(!b.some(x=>x.policy_id===target),"Branch B must not see Branch A's policy");
assert.ok(parent.some(x=>x.policy_id===target),"Parent must see branch policy once");
assert.equal(new Set(parent.map(x=>x.policy_id)).size,parent.length,"No duplicate parent policy IDs");
const [aAccess,bAccess]=await Promise.all([
 rpc(process.env.BRANCH_A_JWT,"partner_app_policy_in_scope",{p_policy_id:target}),
 rpc(process.env.BRANCH_B_JWT,"partner_app_policy_in_scope",{p_policy_id:target})
]);
assert.equal(aAccess,true,"Branch A policy detail allowed");
assert.equal(bAccess,false,"Cross-Branch policy detail denied");
for(const [id,resource,fn] of [
 [process.env.BRANCH_A_CUSTOMER_ID,"customer","partner_app_customer_in_scope"],
 [process.env.BRANCH_A_CLAIM_ID,"claim","partner_app_claim_in_scope"]
]) if(id) {
 const key="p_"+resource+"_id";
 assert.equal(await rpc(process.env.BRANCH_A_JWT,fn,{[key]:id}),true,`Branch A ${resource} allowed`);
 assert.equal(await rpc(process.env.BRANCH_B_JWT,fn,{[key]:id}),false,`Cross-Branch ${resource} denied`);
}
console.log("Signed-JWT cross-Branch RPC checks passed; credentials not displayed.");
