import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareReviewedCustomerEnrollment} from '../../../supabase/functions/_shared/customer-firebase-reviewed-enrollment.mjs';

const id='11111111-1111-4111-8111-111111111111';
const reviewer='22222222-2222-4222-8222-222222222222';
const secondReviewer='33333333-3333-4333-8333-333333333333';
const now=1800000000;
const phone='+919876543210';
const uid='approved-synthetic-firebase-uid';
const alias='c-'+id+'@customer-login.insureit.invalid';
const iso=seconds=>new Date(seconds*1000).toISOString();
const profile={id,role:'customer',is_active:true,phone:'919876543210'};
const authUser={id,phone:'919876543210',email:alias,email_confirmed_at:iso(now-100)};
const link={firebase_project_id:'insureit-customer-auth',firebase_uid:uid,profile_id:id,
  verified_phone_at_approval:phone,is_approved:true,is_active:true};
const firebase={uid,phone_number:phone,aud:'insureit-customer-auth',
  iss:'https://securetoken.google.com/insureit-customer-auth',
  auth_time:now-10,firebase:{sign_in_provider:'phone'}};
async function digest(){
  const a=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('insureit-customer-auth:'+uid));
  return Array.from(new Uint8Array(a),v=>v.toString(16).padStart(2,'0')).join('');
}
const proof=async()=>({id:7,customer_profile_id:id,uid_digest:await digest(),
  decision:'approved',reviewer_id:reviewer,second_reviewer_id:null,
  evidence_digest:'a'.repeat(64),consent_at:iso(now-200),ownership_verified_at:iso(now-180),
  reviewed_at:iso(now-120),expires_at:iso(now+1000),
  recovery_verified_at:iso(now-110),cohort_approved_at:iso(now-100)});

function harness(options={}){
  const calls={writes:0,operatorVerified:0,firebaseVerified:0,authLoaded:0};
  const operatorId=options.operatorId??reviewer;
  const rows={reviews:options.review};
  const db={
    auth:{
      getUser:async jwt=>{
        calls.operatorVerified++;
        assert.equal(jwt,'o'.repeat(150));
        return options.operatorError?{error:{message:'invalid'}}:
          {data:{user:{id:operatorId}},error:null};
      },
      admin:{getUserById:async uuid=>{
        calls.authLoaded++; assert.equal(uuid,id);
        return {data:{user:options.authUser??authUser},error:null};
      }},
    },
    rpc:async(name,args)=>{
      assert.equal(name,'customer_firebase_phone_collision_counts');
      assert.equal(args.p_customer_id,id);
      return options.collisionError
        ? {error:{message:'missing RPC'}}
        : {data:[{non_customer_count:options.staffCollision??0,
          other_customer_count:options.customerCollision??0}],error:null};
    },
    from:table=>{
      const filters=[];
      const builder={
        select:()=>builder,
        eq:(column,value)=>{filters.push([column,value]);return builder;},
        order:()=>builder,
        limit:async()=>{
          assert.equal(table,'customer_firebase_enrollment_reviews');
          assert.deepEqual(filters,[['customer_profile_id',id]]);
          return {data:[rows.reviews??null].filter(Boolean),error:options.reviewError?{}:null};
        },
        maybeSingle:async()=>{
          if(table!=='profiles')throw Error('unexpected single-row table');
          const who=filters.find(([k])=>k==='id')?.[1];
          assert.ok([id,reviewer,secondReviewer].includes(who));
          if(who===id)return {data:options.profile??profile,error:null};
          const staff=who===reviewer?options.staff:{id:who,role:'it_super_user',is_active:true};
          return {data:staff??{id:who,role:'it_super_user',is_active:true},error:null};
        },
        then:(resolve,reject)=>{
          let data;
          if(table!=='customer_firebase_identity_links')throw Error('unexpected query');
          if(filters.some(([key])=>key==='firebase_uid')) data=options.uidLinks??options.links??[link];
          else data=options.customerLinks??options.links??[link];
          return Promise.resolve({data,error:options.linkError?{message:'fail'}:null})
            .then(resolve,reject);
        },
        insert:()=>{calls.writes++;throw Error('writes not permitted');},
        update:()=>{calls.writes++;throw Error('writes not permitted');},
      };
      return builder;
    },
  };
  const admin={verifyIdToken:async (_jwt,revoked)=>{
    calls.firebaseVerified++; assert.equal(revoked,true);
    if(options.firebaseError)throw Error('revoked');
    return options.firebase??firebase;
  }};
  const run=()=>prepareReviewedCustomerEnrollment({
    db,firebaseAdmin:admin,customerFirebaseIdToken:'f'.repeat(150),
    operatorSupabaseAccessToken:'o'.repeat(150),targetCustomerUuid:id,nowSeconds:now,
  });
  return {run,calls};
}
test('trusted operator+Firebase+append-only approval classify ready without writing',async()=>{
  const h=harness({review:await proof()});
  const r=await h.run();
  assert.deepEqual(r,{ok:true,stage:'ready_for_explicit_limited_cohort',
    sameExistingUuid:true,sharedPhoneReviewed:false,writesPerformed:0});
  assert.deepEqual(h.calls,{writes:0,operatorVerified:1,firebaseVerified:1,authLoaded:1});
});
test('absence, revoked or stale Firebase tokens reject before any mapping changes',async()=>{
  for(const o of [{firebaseError:true},{firebase:{...firebase,auth_time:now-301}},
      {firebase:{...firebase,phone_number:'+919900000000'}},
      {firebase:{...firebase,firebase:{sign_in_provider:'password'}}}]){
    const h=harness({review:await proof(),...o});
    const r=await h.run();assert.equal(r.ok,false);assert.equal(h.calls.writes,0);
  }
});
test('no public client role flags can replace independently verified IT Super User',async()=>{
  const h=harness({review:await proof(),staff:{id:reviewer,role:'customer',is_active:true}});
  const r=await h.run();assert.equal(r.reason,'operator_not_authorized');assert.equal(h.calls.firebaseVerified,0);
  const b=harness({review:await proof(),operatorError:true});
  assert.equal((await b.run()).reason,'operator_session_invalid');
});
test('Customer must retain canonical UUID and Auth/profile phone; never pick staff by phone',async()=>{
  for(const o of [{profile:{...profile,role:'it_super_user'}},
    {authUser:{...authUser,id:reviewer}},
    {authUser:{...authUser,phone:'919999999999'}}]){
    const h=harness({review:await proof(),...o});
    assert.equal((await h.run()).ok,false);assert.equal(h.calls.writes,0);
  }
});
test('missing review, revocation, mismatched UID evidence or expired proof deny',async()=>{
  const approved=await proof();
  const cases=[null,{...approved,decision:'revoked'},
    {...approved,uid_digest:'b'.repeat(64)},
    {...approved,expires_at:iso(now-10)},
    {...approved,reviewer_id:secondReviewer},
    {...approved,consent_at:null}];
  for(const review of cases){
    const h=harness({review});
    assert.equal((await h.run()).ok,false);assert.equal(h.calls.writes,0);
  }
});
test('missing trusted collision inventory and conflicting immutable links deny',async()=>{
  for (const o of [{collisionError:true},{linkError:true},
    {uidLinks:[{...link,profile_id:reviewer}],customerLinks:[]},
    {uidLinks:[],customerLinks:[{...link,firebase_uid:'other'}]}]) {
    const h=harness({review:await proof(),...o});
    assert.equal((await h.run()).ok,false);assert.equal(h.calls.writes,0);
  }
});
test('shared staff phone requires separate reviewed active IT Super User',async()=>{
  const a=await proof();
  const denied=harness({review:a,staffCollision:1});
  assert.equal((await denied.run()).reason,'shared_phone_second_review_required');
  const good=harness({review:{...a,second_reviewer_id:secondReviewer},staffCollision:1});
  assert.equal((await good.run()).sharedPhoneReviewed,true);
  const bad=harness({review:{...a,second_reviewer_id:reviewer},staffCollision:1});
  assert.equal((await bad.run()).ok,false);
});
test('approved linking does NOT auto-write Auth aliases or map UID',async()=>{
  const a=await proof();
  const noAlias=harness({review:a,authUser:{...authUser,email:null,email_confirmed_at:null}});
  const aliasResult=await noAlias.run();
  assert.equal(aliasResult.stage,'approved_enrollment_requires_auth_recovery');
  assert.equal(noAlias.calls.writes,0);
  const noLink=harness({review:a,links:[]});
  assert.equal((await noLink.run()).stage,'operator_approved_atomic_uid_enrollment_pending');
  assert.equal(noLink.calls.writes,0);
  const userEmail=harness({review:a,authUser:{...authUser,email:'real@example.com'}});
  assert.equal((await userEmail.run()).reason,'existing_real_auth_email_requires_review');
});
