import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveCustomerFirebaseCohort} from '../../../supabase/functions/_shared/customer-firebase-cohort-resolution.mjs';
import {customerAuthAlias} from '../../../supabase/functions/_shared/customer-firebase-session-alias.mjs';

const uuid='11111111-1111-4111-8111-111111111111';
const uid='synthetic-firebase-uid';
const phone='+919876543210';
const now=1800000000;
const iso=n=>new Date(n*1000).toISOString();
const p={
  profile:{id:uuid,phone,role:'customer',is_active:true},
  authUser:{id:uuid,phone,email:customerAuthAlias(uuid),email_confirmed_at:iso(now-500)},
  firebase:{uid,phone_number:phone,aud:'insureit-customer-auth',
    iss:'https://securetoken.google.com/insureit-customer-auth',
    auth_time:now-10,firebase:{sign_in_provider:'phone'}},
  link:{firebase_project_id:'insureit-customer-auth',firebase_uid:uid,
    profile_id:uuid,verified_phone_at_approval:phone,is_active:true,is_approved:true},
  nowSeconds:now,
};
async function digest(){
  const bytes=new TextEncoder().encode('insureit-customer-auth:'+uid);
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
const reviewer='22222222-2222-4222-8222-222222222222';
const second='33333333-3333-4333-8333-333333333333';
const review=async()=>({
  id:4,customer_profile_id:uuid,uid_digest:await digest(),decision:'approved',
  reviewer_id:reviewer,second_reviewer_id:null,
  consent_at:iso(now-400),ownership_verified_at:iso(now-390),
  recovery_verified_at:iso(now-380),cohort_approved_at:iso(now-370),
  reviewed_at:iso(now-100),expires_at:iso(now+2000),evidence_digest:'a'.repeat(64),
});
function mock({enabled=false,paused=true,review:row=null,staffCount=0,customerCount=0,
  controlError=false,reviewError=false,collisionError=false,reviewerActive=true,
  secondaryActive=true}={}) {
  const calls={reads:[],writes:0};
  const db={
    from(name){
      calls.reads.push(name);
      const builder={
        select:()=>builder,
        eq:(col,value)=>{builder.eqPair=[col,value];return builder;},
        order:()=>builder,
        limit:async()=>{
          assert.equal(name,'customer_firebase_enrollment_reviews');
          return {data:row?[row]:[],error:reviewError?{}:null};
        },
        maybeSingle:async()=>{
          if(name==='customer_firebase_rollout_control')
            return {data:{singleton:true,enabled,paused},error:controlError?{}:null};
          if(name==='profiles')return {data:{
            id:builder.eqPair[1],role:'it_super_user',
            is_active:builder.eqPair[1]===reviewer?reviewerActive:secondaryActive,
          },error:null};
          throw Error('unexpected db table '+name);
        },
        insert(){calls.writes++;throw Error('never write from cohort policy');}
      };
      return builder;
    },
    rpc:async name=>{
      assert.equal(name,'customer_firebase_phone_collision_counts');
      return collisionError?{error:{}}:{data:[{non_customer_count:staffCount,other_customer_count:customerCount}],error:null};
    },
  };
  return {db,calls};
}
test('default server mode remains two-UUID canary with no database reads',async()=>{
  const m=mock();
  const a=await resolveCustomerFirebaseCohort({db:m.db,principal:p,nowSeconds:now});
  assert.equal(a.ok,false);
  assert.equal(a.reason,'outside_approved_canary');
  assert.deepEqual(m.calls.reads,[]);
});
test('invalid mode, missing control and global paused kill switch fail closed',async()=>{
  const row=await review();
  const tests=[
    {enabled:false,paused:false},
    {enabled:true,paused:true},
    {enabled:true,paused:false,controlError:true},
  ];
  for(const config of tests){
    const m=mock({...config,review:row});
    const a=await resolveCustomerFirebaseCohort({db:m.db,principal:p,
      nowSeconds:now,serverMode:'approved_cohort'});
    assert.equal(a.reason,'cohort_kill_switch_closed');
    assert.equal(m.calls.writes,0);
  }
  const m=mock({enabled:true,paused:false,review:row});
  assert.equal((await resolveCustomerFirebaseCohort({db:m.db,principal:p,
    nowSeconds:now,serverMode:'open_all'})).reason,'rollout_mode_disabled');
});
test('restricted, unexpired, exact UID reviewed cohort works for existing Customer only',async()=>{
  const m=mock({enabled:true,paused:false,review:await review()});
  const a=await resolveCustomerFirebaseCohort({db:m.db,principal:p,
    nowSeconds:now,serverMode:'approved_cohort'});
  assert.equal(a.ok,true);
  assert.equal(a.cohort,'approved_cohort');
  assert.equal(m.calls.writes,0);
});
test('latest revoked, wrong UID, missing recovery and expired decisions deny',async()=>{
  const row=await review();
  for(const changed of [
    {...row,decision:'revoked'},
    {...row,uid_digest:'b'.repeat(64)},
    {...row,recovery_verified_at:null},
    {...row,cohort_approved_at:null},
    {...row,expires_at:iso(now-1)},
    {...row,cohort_approved_at:iso(now+10)},
  ]){
    const m=mock({enabled:true,paused:false,review:changed});
    const a=await resolveCustomerFirebaseCohort({db:m.db,principal:p,
      nowSeconds:now,serverMode:'approved_cohort'});
    assert.equal(a.ok,false);assert.equal(m.calls.writes,0);
  }
});
test('shared staff phone requires a DISTINCT active second IT reviewer',async()=>{
  const row=await review();
  const fail=mock({enabled:true,paused:false,review:row,staffCount:1});
  const a=await resolveCustomerFirebaseCohort({db:fail.db,principal:p,
    nowSeconds:now,serverMode:'approved_cohort'});
  assert.equal(a.reason,'shared_phone_review_not_approved');
  const ok=mock({enabled:true,paused:false,review:{...row,second_reviewer_id:second},staffCount:1});
  assert.equal((await resolveCustomerFirebaseCohort({db:ok.db,principal:p,
    nowSeconds:now,serverMode:'approved_cohort'})).ok,true);
  const bad=mock({enabled:true,paused:false,review:{...row,second_reviewer_id:second},
    staffCount:1,secondaryActive:false});
  assert.equal((await resolveCustomerFirebaseCohort({db:bad.db,principal:p,
    nowSeconds:now,serverMode:'approved_cohort'})).ok,false);
});
test('backend query outages or deactivated reviewer deny entire cohort',async()=>{
  const row=await review();
  for(const settings of [
    {reviewError:true},{collisionError:true},{reviewerActive:false},
  ]){
    const m=mock({enabled:true,paused:false,review:row,...settings});
    const a=await resolveCustomerFirebaseCohort({db:m.db,principal:p,
      nowSeconds:now,serverMode:'approved_cohort'});
    assert.equal(a.ok,false);
  }
});
