import assert from 'node:assert/strict';
import { test } from 'node:test';
import { customerAuthAlias, isApprovedAuthAlias } from '../../../supabase/functions/_shared/customer-firebase-session-alias.mjs';
import { ensureCustomerSupabaseSessionAlias } from '../../../supabase/functions/_shared/customer-firebase-session-provision.mjs';
import { checkVerifiedFirebaseCustomerForSession, checkCustomerSessionEligibility } from '../../../supabase/functions/_shared/customer-firebase-session-policy.mjs';

const id='11111111-1111-4111-8111-111111111111', uid='firebase-test-uid';
const alias=customerAuthAlias(id);
const now=1800000000;
const firebase={aud:'insureit-customer-auth',iss:'https://securetoken.google.com/insureit-customer-auth',
  uid,phone_number:'+919876543210',auth_time:now-15,firebase:{sign_in_provider:'phone'}};
const link={firebase_project_id:'insureit-customer-auth',firebase_uid:uid,profile_id:id,
  is_approved:true,is_active:true,verified_phone_at_approval:'+919876543210'};
const profile={id,role:'customer',is_active:true,phone:'919876543210'};
const user=()=>({id,phone:'919876543210',phone_confirmed_at:null,email:null,email_confirmed_at:null});
const ready=authUser=>({firebase,link,profile,authUser,nowSeconds:now});

function mockedDb(nextEmail=alias) {
  const calls=[];
  let current=user();
  return {calls,db:{auth:{admin:{
    updateUserById:async (uuid,payload)=>{
      calls.push({uuid,payload});
      current={...current,email:nextEmail,email_confirmed_at:'2026-10-14T00:00:00Z'};
      return {data:{user:current},error:null};
    },
    getUserById:async()=>({data:{user:current},error:null}),
  }}}};
}
test('aliases are exactly one reserved non-deliverable mailbox per canonical UUID',()=>{
  assert.equal(alias,'c-'+id+'@customer-login.insureit.invalid');
  assert.ok(isApprovedAuthAlias(id,alias.toUpperCase()));
  assert.equal(isApprovedAuthAlias(id,'user@example.com'),false);
  assert.equal(customerAuthAlias('not-uuid'),null);
});
test('verified Firebase identity can be checked BEFORE Auth email provisioning',()=>{
  const p=ready(user());
  assert.equal(checkVerifiedFirebaseCustomerForSession(p).ok,true);
  assert.equal(checkCustomerSessionEligibility(p).reason,'session_identity_not_provisioned');
});
test('no alias writes with feature disabled',async()=>{
  const mock=mockedDb();
  const r=await ensureCustomerSupabaseSessionAlias({
    db:mock.db,authUser:user(),customerProfileId:id,enabled:false,
  });
  assert.equal(r.ok,false);assert.equal(r.reason,'alias_provision_disabled');
  assert.equal(mock.calls.length,0);
});
test('only an unprovisioned Auth user on the exact UUID can receive a system alias',async()=>{
  const mock=mockedDb();
  const r=await ensureCustomerSupabaseSessionAlias({
    db:mock.db,authUser:user(),customerProfileId:id,enabled:true,
  });
  assert.equal(r.ok,true);assert.equal(r.authUser.id,id);
  assert.equal(r.authUser.phone_confirmed_at,null);
  assert.deepEqual(mock.calls,[{uuid:id,payload:{email:alias,email_confirm:true}}]);
  assert.equal(checkCustomerSessionEligibility(ready(r.authUser)).ok,true);
});
test('user-provided Auth email is never overwritten',async()=>{
  const mock=mockedDb();
  const u={...user(),email:'personal@example.com',email_confirmed_at:'2026-10-11'};
  const r=await ensureCustomerSupabaseSessionAlias({db:mock.db,authUser:u,
    customerProfileId:id,enabled:true});
  assert.equal(r.reason,'existing_auth_email_not_system_owned');
  assert.equal(mock.calls.length,0);
});
test('wrong-UUID request or unexpected alias POST-WRITE fails closed',async()=>{
  const mock=mockedDb('other@example.com');
  const x=await ensureCustomerSupabaseSessionAlias({db:mock.db,authUser:user(),
    customerProfileId:'22222222-2222-4222-8222-222222222222',enabled:true});
  assert.equal(x.ok,false);
  assert.equal(mock.calls.length,0);
  const y=await ensureCustomerSupabaseSessionAlias({db:mock.db,authUser:user(),
    customerProfileId:id,enabled:true});
  assert.equal(y.reason,'auth_alias_postwrite_invariant_failed');
});
test('already provisioned alias does not issue a redundant admin write',async()=>{
  const mock=mockedDb();
  const u={...user(),email:alias,email_confirmed_at:'2026-10-11'};
  const r=await ensureCustomerSupabaseSessionAlias({db:mock.db,authUser:u,
    customerProfileId:id,enabled:false});
  assert.equal(r.ok,true);assert.equal(mock.calls.length,0);
});
