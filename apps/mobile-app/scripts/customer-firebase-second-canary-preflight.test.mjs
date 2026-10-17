import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySecondCustomerCanary,summarizeSecondCustomerCanaryPreflight,
} from '../../../supabase/functions/_shared/customer-firebase-second-canary-preflight.mjs';
import {customerAuthAlias} from '../../../supabase/functions/_shared/customer-firebase-session-alias.mjs';

const A='11111111-1111-4111-8111-111111111111';
const STAFF='22222222-2222-4222-8222-222222222222';
const OTHER='33333333-3333-4333-8333-333333333333';
const phone='919876543210',nowSeconds=1800000000;
const profile={id:A,role:'customer',is_active:true,phone};
const authUser={id:A,phone,is_anonymous:false,
  email:customerAuthAlias(A),email_confirmed_at:'2026-10-17T00:00:00Z',
  phone_confirmed_at:'2026-10-17T00:00:00Z'};
const link={firebase_project_id:'insureit-customer-auth',firebase_uid:'synthetic-a',
  profile_id:A,verified_phone_at_approval:'+919876543210',
  is_approved:true,is_active:true};
const base={profile,authUser,links:[link],relatedProfiles:[profile],
  relatedAuthUsers:[authUser],allFirebaseLinks:[link],nowSeconds};
const check=overrides=>classifySecondCustomerCanary({...base,...overrides});

test('preflight successful on nonshared synthetic Customer, but NEVER authorizes login',()=>{
  const result=check();
  assert.equal(result.stage,'preflight_passed_manual_owner_consent_and_live_test_required');
  assert.equal(result.permitsEnrollment,false);
  assert.equal(result.permitsDataAccess,false);
  assert.equal(result.writesPerformed,0);
});

test('existing staff Auth principal with same phone denies preflight even if profile list misses it',()=>{
  const staffAuth={id:STAFF,phone,role:'it_super_user'};
  const result=check({relatedAuthUsers:[authUser,staffAuth]});
  assert.equal(result.stage,'shared_auth_phone_review_required');
  assert.deepEqual(result.flags,['shared_with_other_auth_principal']);
  const withProfile=check({relatedProfiles:[profile,{id:STAFF,phone,role:'it_super_user'}],
    relatedAuthUsers:[authUser,staffAuth]});
  assert.equal(withProfile.stage,'shared_auth_phone_review_required');
  assert.equal(withProfile.flags.includes('shared_with_non_customer'),true);
});

test('candidate with unknown Auth or UID link inventories fails closed',()=>{
  assert.equal(check({relatedAuthUsers:undefined}).stage,'auth_phone_inventory_unavailable');
  assert.equal(check({allFirebaseLinks:undefined}).stage,'cross_customer_uid_inventory_unavailable');
  assert.equal(check({relatedProfiles:undefined}).stage,'phone_inventory_unavailable');
});

test('existing Firebase UID linked to another profile can never qualify as second canary',()=>{
  const conflicted={...link,profile_id:OTHER};
  const result=check({allFirebaseLinks:[link,conflicted]});
  assert.equal(result.stage,'firebase_uid_conflict');
  assert.equal(result.permitsEnrollment,false);
});

test('approved link but missing Auth alias needs credential recovery; unlinked Customer needs proof',()=>{
  const withoutEmail={...authUser,email:null,email_confirmed_at:null};
  assert.equal(check({authUser:withoutEmail}).stage,'approved_link_requires_auth_recovery');
  assert.equal(check({links:[],allFirebaseLinks:[]}).stage,'independent_ownership_proof_required');
});

test('staff profiles and mismatched UUIDs are never allowed',()=>{
  assert.equal(check({profile:{...profile,role:'it_super_user'}}).stage,
    'inactive_or_invalid_customer');
  assert.equal(check({authUser:{...authUser,id:OTHER}}).stage,
    'missing_or_wrong_auth_identity');
});

test('summary discloses only aggregate stage counts; never Customer identifiers',()=>{
  const summary=summarizeSecondCustomerCanaryPreflight([
    {...base},
    {...base,profile:{id:OTHER,role:'customer',is_active:true,phone:'919111111111'},
      authUser:{id:OTHER,phone:'919111111111',email:null,email_confirmed_at:null},
      relatedProfiles:[],relatedAuthUsers:[],links:[],allFirebaseLinks:[]},
  ]);
  assert.equal(summary.ok,true);
  assert.equal(summary.analyzed,2);
  assert.equal(summary.canaryEnrollmentsPerformed,0);
  assert.equal(summary.authWritesPerformed,0);
  assert.equal(summary.stages.independent_ownership_proof_required,1);
  const output=JSON.stringify(summary);
  for(const sensitive of [A,OTHER,phone,link.firebase_uid]) {
    assert.equal(output.includes(sensitive),false);
  }
  assert.equal(summarizeSecondCustomerCanaryPreflight([{...base},{...base}]).ok,false);
});
