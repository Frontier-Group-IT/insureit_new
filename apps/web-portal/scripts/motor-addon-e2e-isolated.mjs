// Manual motor policy create/edit persistence verification.
// Requires an isolated Supabase database with the INSUREIT schema, and test-only
// onboarding/edit payload fixtures. Refuses to write to production.
import assert from "node:assert/strict";

const env = process.env;
const url = env.MOTOR_E2E_SUPABASE_URL?.replace(/\/$/,"");
const token = env.MOTOR_E2E_SUPABASE_SERVICE_ROLE_KEY;
const fixture = env.MOTOR_E2E_PAYLOAD_JSON;
if (!url || !token || !fixture) throw new Error("Missing isolated E2E URL, service-role key, or JSON fixture");
const parsedUrl = new URL(url);
assert.equal(parsedUrl.protocol,"https:","Isolated Supabase must use HTTPS");
const host = parsedUrl.hostname.toLowerCase();
assert.ok(host.endsWith(".supabase.co"),"Use a dedicated Supabase test project");
assert.notEqual(host,"ilzhsfqqjyppzzvfscmh.supabase.co","Production Supabase is forbidden");
assert.notEqual(host,"zvtaiaiatregbmidzchz.supabase.co","Unrelated production Supabase is forbidden");
assert.equal(env.MOTOR_E2E_ENABLE_WRITES,"I_AUTHORIZE_ISOLATED_TEST_WRITES","Explicit write authorization is required");
const testCase=JSON.parse(fixture);
for(const key of ["createPayload","editPayload"]) {
  assert.equal(typeof testCase[key],"object",key+" must be supplied");
}
const api=async(path,options={})=>{
 const response=await fetch(url+"/rest/v1/"+path,{
  ...options,headers:{
   apikey:token,Authorization:"Bearer "+token,
   "Content-Type":"application/json",
   Accept:"application/json",
   ...options.headers
  }
 });
 const raw=await response.text();
 const result=raw?JSON.parse(raw):null;
 if(!response.ok)throw Error(path+" failed ("+response.status+"): "+JSON.stringify(result));
 return result;
};
const rpc=(name,args)=>api("rpc/"+name,{method:"POST",body:JSON.stringify(args)});
const close=(actual,expected,label)=>assert.ok(Math.abs(Number(actual)-expected)<0.011,label+": "+actual+" vs "+expected);
const amount=Number(testCase.addOnAmount ?? 10539.73);
const od=Number(testCase.odPremium ?? 4675.17);
const payinPct=Number(testCase.odPayinPercent ?? 25);
const payoutPct=Number(testCase.odPayoutPercent ?? 10);
const round=v=>Math.round((v+Number.EPSILON)*100)/100;
assert.ok(amount>0&&od>=0&&payinPct>=0&&payoutPct>=0);
const create={
 ...testCase.createPayload,
 premium:{...testCase.createPayload.premium,addOnPremium:String(amount)}
};
console.log("Running isolated Motor creation and add-on save");
const created=await rpc("save_motor_policy_with_addon_v1",{p_operation:"create",p_payload:create});
assert.ok(created?.ok && created?.policyId,"Create RPC must return a saved policy ID");
const id=created.policyId;
console.log("Test Motor policy created:",id);
const snapshot=async()=>{
 const [prem,payin,payout]=await Promise.all([
  api("policy_premium_details?policy_id=eq."+encodeURIComponent(id)+"&select=od_premium,add_on_premium,net_premium,gst_amount,gross_premium"),
  api("policy_payin_details?policy_id=eq."+encodeURIComponent(id)+"&select=projected_od_amount,projected_od_percent,total_projected_payin,tds_amount,tds_percent,payin_after_tds"),
  api("policy_intermediary_payouts?policy_id=eq."+encodeURIComponent(id)+"&select=payout_basis,od_payout_amount,od_payout_percent,gross_payout&order=created_at.desc&limit=1")
 ]);
 assert.equal(prem.length,1,"One premium detail row required");
 assert.equal(payin.length,1,"One pay-in detail row required");
 return {premium:prem[0],payin:payin[0],payout:payout[0]??null};
};
const verify=(saved,addon)=>{
 close(saved.premium.add_on_premium,addon,"Persisted Add-on Premium");
 close(saved.payin.projected_od_amount,round((od+addon)*payinPct/100),"OD Pay-in includes add-on");
 close(saved.payin.payin_after_tds,round(Number(saved.payin.total_projected_payin)-Number(saved.payin.tds_amount)),"Pay-in after TDS");
 if(saved.payout?.payout_basis!=="FIXED_AMOUNT" && saved.payout){
  close(saved.payout.od_payout_amount,round((od+addon)*payoutPct/100),"OD Payout includes add-on");
 }
};
const first=await snapshot();
verify(first,amount);
console.log("Create persistence and OD commission verification passed");
const changed=round(amount+111.11);
const edit={
 ...testCase.editPayload,
 premium:{...testCase.editPayload.premium,addOnPremium:String(changed)}
};
console.log("Running isolated Motor edit with updated add-on");
const updated=await rpc("save_motor_policy_with_addon_v1",{
 p_operation:"edit",p_policy_id:id,p_payload:edit
});
assert.ok(updated?.ok,"Edit RPC must succeed");
const second=await snapshot();
verify(second,changed);
console.log("Edit persistence and recalculation verification passed");
let rejected=false;
try{
 await rpc("save_motor_policy_with_addon_v1",{
  p_operation:"edit",p_policy_id:id,
  p_payload:{...edit,premium:{...edit.premium,addOnPremium:"-1"}}
 });
}catch{rejected=true}
assert.ok(rejected,"Invalid add-on must reject edit");
const afterRejected=await snapshot();
assert.deepEqual(afterRejected,second,"Failed edit must leave all premium/pay-in/payout records intact");
console.log("Rejected edit rollback verification passed");
console.log("ISOLATED E2E VERIFIED. Test data remains in the isolated database for audit; no production writes or deployment.");
