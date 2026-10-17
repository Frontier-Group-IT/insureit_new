import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessCustomerFirebaseEnrollment, assessCustomerAuthAliasMigration } from '../../../supabase/functions/_shared/customer-firebase-migration-preflight.mjs';

const id='11111111-1111-4111-8111-111111111111', uid='firebase-uid-1', now=1800000000;
const profile={id,role:'customer',is_active:true,phone:'919876543210'};
const authUser={id,phone:'919876543210',email:null,email_confirmed_at:null};
const firebase={uid,phone_number:'+919876543210',aud:'insureit-customer-auth',iss:'https://securetoken.google.com/insureit-customer-auth',firebase:{sign_in_provider:'phone'},auth_time:now-5};
const attested={project:'insureit-customer-auth',signatureAndRevocationChecked:true,consentRecorded:true,approvedCustomerUuid:id,firebaseUid:uid,verifiedPhone:'+919876543210',ambiguousPhoneOwnership:false,independentCustomerIdentityProof:true};
const link={profile_id:id,firebase_uid:uid,firebase_project_id:'insureit-customer-auth',verified_phone_at_approval:'+919876543210',is_approved:true,is_active:true};
const recovery={targetUuid:id,recoverableSnapshotVerified:true,outOfBandEncryptedStorageVerified:true,rollbackProcedureRehearsed:true,credentialRotationApproved:true,emailRecoveryAndPasswordSignInRiskAccepted:true};
const enroll = (changes={}) => assessCustomerFirebaseEnrollment({profile,authUser,firebase,links:[],nowSeconds:now,attested,...changes});
test('unsigned or unapproved UID cannot enroll',()=> {
  assert.equal(enroll({attested:{...attested,signatureAndRevocationChecked:false}}).reason,'independent_attestation_required');
  assert.equal(enroll({attested:{...attested,consentRecorded:false}}).ok,false);
  assert.equal(enroll({firebase:{...firebase,uid:'different'}}).ok,false);
  assert.equal(enroll({attested:{...attested,ambiguousPhoneOwnership:true}}).ok,false);
  assert.equal(enroll({attested:{...attested,independentCustomerIdentityProof:false}}).ok,false);
  assert.equal(enroll({firebase:{...firebase,auth_time:now-301}}).ok,false);
});
test('customer identity and immutable UUID mapping are mandatory',()=> {
  assert.equal(enroll({profile:{...profile,role:'it_super_user'}}).ok,false);
  assert.equal(enroll({authUser:{...authUser,id:'22222222-2222-4222-8222-222222222222'}}).ok,false);
  assert.equal(enroll({links:[{...link,profile_id:'22222222-2222-4222-8222-222222222222'}]}).ok,false);
  assert.equal(enroll({links:[{...link,firebase_uid:'old-uid'}]}).ok,false);
  assert.equal(enroll({links:[{...link,is_approved:false}]}).ok,false);
  assert.equal(enroll({links:[link]}).action,'already_approved');
  assert.equal(enroll().action,'manual_approval_required');
});
test('Auth alias migration demands a verified out-of-band recovery snapshot',()=> {
  const arg={profile,authUser,approvedLink:link,recovery};
  assert.equal(assessCustomerAuthAliasMigration(arg).action,'manual_single_customer_canary_only');
  assert.equal(assessCustomerAuthAliasMigration({...arg,recovery:{...recovery,rollbackProcedureRehearsed:false}}).ok,false);
  assert.equal(assessCustomerAuthAliasMigration({...arg,recovery:{...recovery,emailRecoveryAndPasswordSignInRiskAccepted:false}}).ok,false);
  assert.equal(assessCustomerAuthAliasMigration({...arg,authUser:{...authUser,email:'real@example.com'}}).ok,false);
  assert.equal(assessCustomerAuthAliasMigration({...arg,approvedLink:{...link,is_approved:false}}).ok,false);
});
