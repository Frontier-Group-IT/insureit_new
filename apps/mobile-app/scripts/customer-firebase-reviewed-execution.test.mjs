import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executeReviewedCustomerEnrollment} from '../../../supabase/functions/_shared/customer-firebase-reviewed-execution.mjs';
import {customerAuthAlias} from '../../../supabase/functions/_shared/customer-firebase-session-alias.mjs';
const uuid='11111111-1111-4111-8111-111111111111';
const operator='22222222-2222-4222-8222-222222222222';
const now=1800000000,phone='+919876543210',uid='synthetic-uid';
const iso=n=>new Date(n*1000).toISOString();
async function review(){
  const a=await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode('insureit-customer-auth:'+uid));
  const hash=[...new Uint8Array(a)].map(b=>b.toString(16).padStart(2,'0')).join('');
  return {id:4,customer_profile_id:uuid,uid_digest:hash,reviewer_id:operator,
    second_reviewer_id:null,decision:'approved',evidence_digest:'a'.repeat(64),
    consent_at:iso(now-200),ownership_verified_at:iso(now-190),
    recovery_verified_at:iso(now-180),cohort_approved_at:iso(now-170),
    reviewed_at:iso(now-100),expires_at:iso(now+3000)};
}
const token={uid,phone_number:phone,aud:'insureit-customer-auth',
  iss:'https://securetoken.google.com/insureit-customer-auth',
  auth_time:now-10,firebase:{sign_in_provider:'phone'}};
function harness(r,{aliasMissing=false,revoked=false,rpcFailure=false,reviewDecision=null}={}) {
  const calls={id:0,admin:0,rpcWrites:0};
  const row=reviewDecision?{...r,decision:reviewDecision}:r;
  const db={
    auth:{
      getUser:async()=>{calls.id++;return {data:{user:{id:operator}},error:null};},
      admin:{getUserById:async()=>{calls.admin++;return {
        data:{user:{id:uuid,phone:'919876543210',
          email:aliasMissing?null:customerAuthAlias(uuid),
          email_confirmed_at:aliasMissing?null:iso(now-500)}},error:null,
      };}}
    },
    from(name){
      const b={
        select:()=>b,
        eq:(c,v)=>{b.eqArg=[c,v];return b;},
        order:()=>b,
        limit:async()=>{assert.equal(name,'customer_firebase_enrollment_reviews');
          return {data:[row],error:null};},
        maybeSingle:async()=>{
          if(name!=='profiles')throw Error('bad table '+name);
          const id=b.eqArg[1];
          if(id===operator)return {data:{id,role:'it_super_user',is_active:true},error:null};
          return {data:{id:uuid,phone:'919876543210',role:'customer',is_active:true},error:null};
        },
        then:(resolve,reject)=>{
          assert.equal(name,'customer_firebase_identity_links');
          return Promise.resolve({data:[],error:null}).then(resolve,reject);
        },
      };
      return b;
    },
    rpc:async(name,args)=>{
      if(name==='customer_firebase_phone_collision_counts')
        return {data:[{non_customer_count:0,other_customer_count:0}],error:null};
      assert.equal(name,'customer_firebase_enroll_reviewed');
      assert.equal(args.p_profile_id,uuid);
      assert.equal(args.p_firebase_uid,uid);
      assert.equal(args.p_operator_id,operator);
      assert.equal(args.p_evidence_digest,'a'.repeat(64));
      calls.rpcWrites++;
      return rpcFailure?{data:null,error:{message:'review changed'}}:
        {data:'enrolled',error:null};
    },
  };
  const firebaseAdmin={verifyIdToken:async()=>revoked?Promise.reject(Error('revoked')):token};
  const args={db,firebaseAdmin,customerFirebaseIdToken:'f'.repeat(150),
    operatorSupabaseAccessToken:'o'.repeat(150),targetCustomerUuid:uuid,
    nowSeconds:now};
  return {calls,args};
}
test('default does not even verify tokens or touch privileged database',async()=>{
  const h=harness(await review());
  assert.equal((await executeReviewedCustomerEnrollment(h.args)).reason,
    'explicit_operator_execution_required');
  assert.deepEqual(h.calls,{id:0,admin:0,rpcWrites:0});
});
test('server-validated audit, exact UUID and fresh Admin token may call only reviewed RPC',async()=>{
  const h=harness(await review());
  const r=await executeReviewedCustomerEnrollment({...h.args,apply:true});
  assert.equal(r.stage,'enrolled');
  assert.equal(r.writesPerformed,1);
  assert.equal(h.calls.rpcWrites,1);
  assert.equal(h.calls.id,2);
});
test('absent Auth alias/recovery blocks UID writes, even when operator approved',async()=>{
  const h=harness(await review(),{aliasMissing:true});
  const r=await executeReviewedCustomerEnrollment({...h.args,apply:true});
  assert.equal(r.reason,'auth_backup_restore_and_alias_required');
  assert.equal(h.calls.rpcWrites,0);
});
test('revoked or mismatched audit prevents any write',async()=>{
  for(const opt of [{revoked:true},{reviewDecision:'revoked'}]){
    const h=harness(await review(),opt);
    assert.equal((await executeReviewedCustomerEnrollment({...h.args,apply:true})).ok,false);
    assert.equal(h.calls.rpcWrites,0);
  }
});
test('atomic SQL failure cannot claim enrollment success',async()=>{
  const h=harness(await review(),{rpcFailure:true});
  assert.equal((await executeReviewedCustomerEnrollment({...h.args,apply:true})).reason,
    'atomic_enrollment_denied');
});
