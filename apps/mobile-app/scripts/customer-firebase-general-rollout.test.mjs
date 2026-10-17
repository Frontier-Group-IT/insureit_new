import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCustomerFirebaseReadiness, summarizeCustomerFirebaseRollout,
  GENERAL_CUSTOMER_ROLLOUT_STAGES,
} from '../../../supabase/functions/_shared/customer-firebase-general-rollout-plan.mjs';
import { checkFutureCustomerFirebaseRolloutGate } from '../../../supabase/functions/_shared/customer-firebase-general-rollout-gate.mjs';
import { CUSTOMER_FIREBASE_CANARY_UUIDS } from '../../../supabase/functions/_shared/customer-firebase-canary-gate.mjs';
import { customerAuthAlias } from '../../../supabase/functions/_shared/customer-firebase-session-alias.mjs';

const customerId = '11111111-1111-4111-8111-111111111111';
const staffId = '22222222-2222-4222-8222-222222222222';
const altId = '33333333-3333-4333-8333-333333333333';
const now = 1800000000;
const phone = '+919876543210';
const profile = Object.freeze({id:customerId,role:'customer',is_active:true,phone:'919876543210'});
const authUser = Object.freeze({id:customerId,phone:'919876543210',
  email:customerAuthAlias(customerId),email_confirmed_at:'2026-10-17T00:00:00Z',
  phone_confirmed_at:'2026-10-17T00:00:00Z'});
const link = Object.freeze({firebase_project_id:'insureit-customer-auth',
  firebase_uid:'immutable-firebase-uid',profile_id:customerId,
  verified_phone_at_approval:phone,is_approved:true,is_active:true});
const staff = Object.freeze({id:staffId,role:'it_super_user',is_active:true,phone:'919876543210'});
const related = [profile];
const evaluate = (args={}) => classifyCustomerFirebaseReadiness({
  profile,authUser,links:[link],relatedProfiles:related,nowSeconds:now,...args,
});

test('approved, confirmed, unambiguous existing Customer is ready without any writes', () => {
  assert.deepEqual(evaluate(),{stage:'ready_existing_session',flags:[]});
  assert.equal(GENERAL_CUSTOMER_ROLLOUT_STAGES.includes('ready_existing_session'),true);
});

test('other staff on the same phone forces separate identity review, even with approved UID', () => {
  const d=evaluate({relatedProfiles:[profile,staff]});
  assert.equal(d.stage,'shared_phone_review');
  assert.deepEqual(d.flags,['shared_with_non_customer']);
  assert.equal(evaluate({relatedProfiles:[profile,{...staff,role:'customer'}]}).flags[0],
    'shared_with_customer');
});

test('missing mapping demands independent ownership proof; phone possession alone never enrolls', () => {
  assert.equal(evaluate({links:[]}).stage,'independent_ownership_proof_required');
  assert.equal(evaluate({links:[],relatedProfiles:[profile,staff]}).stage,'shared_phone_review');
  assert.equal(evaluate({links:[{...link,is_approved:false}]}).stage,'firebase_link_requires_review');
  assert.equal(evaluate({links:[{...link,is_active:false}]}).stage,'firebase_link_requires_review');
});

test('immutable UID, project, canonical Customer and exact Auth identity enforced', () => {
  assert.equal(evaluate({links:[{...link,profile_id:altId}]}).stage,'firebase_uid_conflict');
  assert.equal(evaluate({links:[{...link,firebase_project_id:'other-project'}]}).stage,'firebase_uid_conflict');
  assert.equal(evaluate({links:[link,{...link,firebase_uid:'other'}]}).stage,'firebase_uid_conflict');
  assert.equal(evaluate({authUser:{...authUser,id:staffId}}).stage,'missing_or_wrong_auth_identity');
  assert.equal(evaluate({authUser:{...authUser,phone:'919000000000'}}).stage,'phone_identity_mismatch');
  assert.equal(evaluate({profile:{...profile,role:'it_super_user'}}).stage,'inactive_or_invalid_customer');
  assert.equal(evaluate({profile:{...profile,is_active:false}}).stage,'inactive_or_invalid_customer');
});

test('never replace real Auth email or rotate missing alias without recovery review', () => {
  assert.equal(evaluate({authUser:{...authUser,email:'customer@example.com'}}).stage,
    'existing_auth_email_requires_review');
  assert.equal(evaluate({authUser:{...authUser,email:null,email_confirmed_at:null}}).stage,
    'approved_link_requires_auth_recovery');
  assert.equal(evaluate({authUser:{...authUser,email_confirmed_at:null}}).stage,
    'approved_link_requires_auth_recovery');
  assert.deepEqual(evaluate({authUser:{...authUser,phone_confirmed_at:null}}),{
    stage:'ready_existing_session',flags:['auth_phone_unconfirmed'],
  });
});

test('missing inventories and deterministic inspection clock fail closed', () => {
  assert.equal(evaluate({relatedProfiles:null}).stage,'phone_inventory_unavailable');
  assert.equal(evaluate({links:null}).stage,'firebase_link_inventory_unavailable');
  assert.equal(evaluate({nowSeconds:undefined}).stage,'inspection_time_unavailable');
  assert.equal(evaluate({authUser:{...authUser,banned_until:'2035-01-01T00:00:00Z'}}).stage,
    'missing_or_wrong_auth_identity');
});

test('batch planner returns anonymized stage totals and risk counts, no identifiers or tokens', () => {
  const next={...profile,id:altId,phone:'919111111111'};
  const nextAuth={...authUser,id:altId,phone:'919111111111',email:null,email_confirmed_at:null};
  const records=[
    {profile,authUser,links:[link]},
    {profile:next,authUser:nextAuth,links:[]},
  ];
  const plan=summarizeCustomerFirebaseRollout(records,[profile,next,staff],now);
  assert.equal(plan.ok,true);
  assert.equal(plan.analyzed,2);
  assert.equal(plan.stages.shared_phone_review,1);
  assert.equal(plan.stages.independent_ownership_proof_required,1);
  assert.equal(plan.riskFlags.shared_with_non_customer,1);
  assert.equal(plan.writesPerformed,0);
  const serialized=JSON.stringify(plan);
  for (const secret of [customerId,altId,phone,link.firebase_uid]) {
    assert.equal(serialized.includes(secret),false);
  }
  assert.equal(summarizeCustomerFirebaseRollout(records,[profile,next]).reason,'inspection_time_required');
  assert.equal(summarizeCustomerFirebaseRollout([records[0],records[0]],[profile],now).reason,
    'duplicate_or_invalid_customer_inventory');
});

function principal(id) {
  const p={...profile,id};
  const a={...authUser,id,email:customerAuthAlias(id)};
  const l={...link,profile_id:id};
  const firebase={uid:l.firebase_uid,phone_number:phone,
    aud:'insureit-customer-auth',iss:'https://securetoken.google.com/insureit-customer-auth',
    auth_time:now-10,firebase:{sign_in_provider:'phone'}};
  return {firebase,profile:p,authUser:a,link:l,nowSeconds:now};
}
test('future general gate remains default-canary; other Customers and staff denied', () => {
  const allowed=checkFutureCustomerFirebaseRolloutGate({
    principal:principal(CUSTOMER_FIREBASE_CANARY_UUIDS[0]),
  });
  assert.equal(allowed.ok,true);
  assert.equal(allowed.cohort,'canary');
  assert.equal(checkFutureCustomerFirebaseRolloutGate({principal:principal(customerId)}).reason,
    'outside_approved_canary');
  assert.equal(checkFutureCustomerFirebaseRolloutGate({principal:principal(customerId),mode:'all'}).reason,
    'rollout_mode_disabled');
  assert.equal(checkFutureCustomerFirebaseRolloutGate({principal:{
    ...principal(customerId),profile:{...profile,role:'it_super_user'},
  },mode:'approved_cohort'}).ok,false);
});

test('future approved cohort needs exact operator audit, identity and credential recovery', () => {
  const p=principal(customerId);
  const review={source:'restricted_operator_audit',profileId:customerId,
    firebaseUid:link.firebase_uid,operatorEnrollmentApproved:true,
    authCredentialRecoveryVerified:true,cohortReleaseApproved:true,
    sharedPhoneIdentityReviewComplete:true};
  assert.equal(checkFutureCustomerFirebaseRolloutGate({principal:p,mode:'approved_cohort'}).ok,false);
  assert.equal(checkFutureCustomerFirebaseRolloutGate({principal:p,mode:'approved_cohort',
    serverCohortApproval:{...review,sharedPhoneIdentityReviewComplete:false}}).ok,false);
  assert.equal(checkFutureCustomerFirebaseRolloutGate({principal:p,mode:'approved_cohort',
    serverCohortApproval:{...review,profileId:staffId}}).ok,false);
  assert.equal(checkFutureCustomerFirebaseRolloutGate({principal:p,mode:'approved_cohort',
    serverCohortApproval:{...review,authCredentialRecoveryVerified:false}}).ok,false);
  const ok=checkFutureCustomerFirebaseRolloutGate({principal:p,mode:'approved_cohort',
    serverCohortApproval:review});
  assert.equal(ok.ok,true);
  assert.equal(ok.customerProfileId,customerId);
});
