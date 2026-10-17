import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleCustomerFirebaseOperatorPreview} from
  '../../../supabase/functions/_shared/customer-firebase-operator-preview.mjs';
const customer='11111111-1111-4111-8111-111111111111';
const nowSeconds=1800000000;
const rawFirebase='f'.repeat(150), operator='o'.repeat(150);
const body={customer_profile_id:customer,firebase_id_token:rawFirebase};
const req=(data=body,token=operator)=>new Request('http://localhost/operator-preview',{
  method:'POST',
  headers:{'content-type':'application/json','authorization':'Bearer '+token},
  body:JSON.stringify(data),
});
const run=(opts={})=>handleCustomerFirebaseOperatorPreview({
  request:req(),db:{fakeTrustedService:true},firebaseAdmin:{fakeAdmin:true},
  nowSeconds,featureEnabled:true,...opts,
});

test('operator endpoint is disabled by default, never invoking reviewer or database',async()=>{
  let touched=0;
  const result=await handleCustomerFirebaseOperatorPreview({
    request:req(),featureEnabled:false,
    review:async()=>{touched++;throw Error('should not call');},
  });
  assert.equal(result.status,503);
  assert.equal(result.body.stage,'operator_preview_disabled');
  assert.equal(touched,0);
});

test('requires POST, JSON, bounded tokens and exact request fields',async()=>{
  const fakeReview=async()=>{throw Error('should not reach review')};
  const denied=[
    new Request('http://localhost/preview',{method:'GET'}),
    new Request('http://localhost/preview',{method:'POST',headers:{'content-type':'text/plain'},body:'x'}),
    req(body,'short'),
    req({...body,consent:true}),
    req({...body,apply:true}),
    req({...body,customer_profile_id:'not-uuid'}),
    req({...body,firebase_id_token:'short'}),
  ];
  const expected=[405,415,401,400,400,400,400];
  for(let i=0;i<denied.length;i++){
    const res=await run({request:denied[i],review:fakeReview});
    assert.equal(res.status,expected[i]);
    assert.equal(JSON.stringify(res.body).includes(rawFirebase),false);
  }
});

test('does not treat generic successful review or unverified UUID as an approval',async()=>{
  for(const d of [
    {ok:true,stage:'ready_for_explicit_limited_cohort',writesPerformed:0},
    {ok:true,stage:'ready_for_explicit_limited_cohort',sameExistingUuid:false,writesPerformed:0},
    {ok:true,stage:'ready_for_explicit_limited_cohort',sameExistingUuid:true,writesPerformed:1},
    {ok:false,reason:'customer_shared_with_it_super_user'},
  ]){
    const result=await run({review:async()=>d});
    assert.equal(result.status,403);
    assert.equal(result.body.stage,'identity_or_review_not_eligible');
  }
});

test('approved review of exact same existing UUID only grants manual test candidacy',async()=>{
  let calls=0;
  const r=await run({review:async args=>{
    calls++;
    assert.equal(args.targetCustomerUuid,customer);
    assert.equal(args.customerFirebaseIdToken,rawFirebase);
    assert.equal(args.operatorSupabaseAccessToken,operator);
    assert.equal(args.nowSeconds,nowSeconds);
    return {ok:true,stage:'ready_for_explicit_limited_cohort',
      sameExistingUuid:true,writesPerformed:0};
  }});
  assert.equal(calls,1);
  assert.deepEqual(r,{status:200,body:{ok:true,
    stage:'reviewed_existing_session_manual_test_candidate',writesPerformed:0}});
});

test('approved UID enrollment remains a pending database action; no linking here',async()=>{
  const r=await run({review:async()=>({
    ok:true,stage:'operator_approved_atomic_uid_enrollment_pending',
    sameExistingUuid:true,writesPerformed:0,
  })});
  assert.equal(r.status,200);
  assert.equal(r.body.stage,'approved_link_write_still_pending');
  assert.equal(r.body.writesPerformed,0);
});
test('missing alias/recovery never becomes an Auth write',async()=>{
  const r=await run({review:async()=>({
    ok:true,stage:'approved_enrollment_requires_auth_recovery',
    sameExistingUuid:true,writesPerformed:0,
  })});
  assert.equal(r.status,409);
  assert.equal(r.body.stage,'protected_auth_recovery_required');
});

test('operator preview catches service outage without exposing secrets',async()=>{
  const r=await run({review:async()=>{throw Error('secret Firebase token '+rawFirebase)}});
  assert.equal(r.status,503);
  assert.equal(r.body.stage,'operator_preview_unavailable');
  const exposed=JSON.stringify(r.body);
  for(const confidential of [customer,rawFirebase,operator])assert.equal(exposed.includes(confidential),false);
});

test('no service or malformed clock are fail-closed',async()=>{
  assert.equal((await run({db:null})).status,503);
  assert.equal((await run({nowSeconds:NaN})).status,503);
});
