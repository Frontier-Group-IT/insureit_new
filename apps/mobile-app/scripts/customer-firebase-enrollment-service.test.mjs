import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareVerifiedEnrollment, commitVerifiedEnrollment } from '../../../supabase/functions/_shared/customer-firebase-enrollment-service.mjs';
const id='11111111-1111-4111-8111-111111111111',uid='uid-1', now=1800000000;
const profile={id,role:'customer',is_active:true,phone:'919876543210'};
const authUser={id,phone:'919876543210'};
const token={uid,aud:'insureit-customer-auth',iss:'https://securetoken.google.com/insureit-customer-auth',phone_number:'+919876543210',auth_time:now-20,firebase:{sign_in_provider:'phone'}};
const authorization={approvedCustomerUuid:id,consentRecorded:true,independentCustomerIdentityProof:true,ambiguousPhoneOwnership:false,signatureAndRevocationChecked:true};
function setup({verified=token,links=[],err=false}={}) {
  const calls={verify:0,writes:0};
  const firebaseAdmin={verifyIdToken:async (_token,revocation)=>{calls.verify++;assert.equal(revocation,true);if (!verified) throw Error('revoked');return verified;}};
  const db={from:()=>({select:()=>({eq:()=>({eq:async()=>({data:links,error:err?'oops':null}),then:undefined, /* terminal for profile query */ })})})};
  // Thenable simulation for Supabase query builder
  db.from=()=>({select:()=>{const builder={eq:()=>builder,then:(resolve)=>Promise.resolve({data:links,error:err?'oops':null}).then(resolve)};return builder;}});
  return {calls,firebaseAdmin,db};
}
test('verified signed token and separate canonical approval allow manual enrollment review only',async()=>{
 const s=setup();const result=await prepareVerifiedEnrollment({firebaseAdmin:s.firebaseAdmin,idToken:'x'.repeat(128),customer:{profile,authUser},db:s.db,authorization,nowSeconds:now});
 assert.equal(result.ok,true);assert.equal(result.action,'manual_approval_required');assert.equal(s.calls.verify,1);
});
test('reject revoked token and never touch Auth or link records',async()=>{
 const s=setup({verified:null});const result=await prepareVerifiedEnrollment({firebaseAdmin:s.firebaseAdmin,idToken:'x'.repeat(128),customer:{profile,authUser},db:s.db,authorization,nowSeconds:now});
 assert.equal(result.reason,'invalid_or_revoked_token');
});
test('reject absent independent approval before contacting Firebase',async()=>{
 const s=setup();const result=await prepareVerifiedEnrollment({firebaseAdmin:s.firebaseAdmin,idToken:'x'.repeat(128),customer:{profile,authUser},db:s.db,authorization:{...authorization,consentRecorded:false},nowSeconds:now});
 assert.equal(result.ok,false);assert.equal(s.calls.verify,0);
});
test('reject mapping query outage or wrong phone',async()=>{
 const s=setup({err:true});const result=await prepareVerifiedEnrollment({firebaseAdmin:s.firebaseAdmin,idToken:'x'.repeat(128),customer:{profile,authUser},db:s.db,authorization,nowSeconds:now});
 assert.equal(result.reason,'mapping_audit_unavailable');
 const b=setup({verified:{...token,phone_number:'+919999999999'}});
 const mismatch=await prepareVerifiedEnrollment({firebaseAdmin:b.firebaseAdmin,idToken:'x'.repeat(128),customer:{profile,authUser},db:b.db,authorization,nowSeconds:now});
 assert.equal(mismatch.ok,false);
});

test('explicit service-only executor refuses mutation without independent operator proof',async()=>{
 const s=setup();
 s.db.rpc=async()=>{throw Error('must never write');};
 const r=await commitVerifiedEnrollment({firebaseAdmin:s.firebaseAdmin,idToken:'x'.repeat(128),
 customer:{profile,authUser},db:s.db,authorization,nowSeconds:now,apply:true});
 assert.equal(r.reason,'privileged_operator_and_evidence_required');
});
test('approved server operator may commit through exactly one atomic RPC',async()=>{
 const s=setup();let calls=0;
 s.db.rpc=async(name,args)=>{
   calls++;
   assert.equal(name,'customer_firebase_enroll_approved');
   assert.equal(args.p_profile_id,id);
   assert.equal(args.p_firebase_uid,uid);
   return {data:'enrolled',error:null};
 };
 const r=await commitVerifiedEnrollment({firebaseAdmin:s.firebaseAdmin,idToken:'x'.repeat(128),
 customer:{profile,authUser},db:s.db,authorization:{...authorization,firebaseUid:uid,verifiedPhone:firebase.phone_number},
 operator:{verifiedPrivilegedStaff:true,id:'22222222-2222-4222-8222-222222222222'},
 evidenceDigest:'a'.repeat(64),nowSeconds:now,apply:true});
 assert.equal(r.action,'enrolled');assert.equal(calls,1);
});
