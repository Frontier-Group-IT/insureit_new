import { test } from 'node:test';
import assert from 'node:assert/strict';
import {checkCustomerFirebaseCanary} from '../../../supabase/functions/_shared/customer-firebase-canary-gate.mjs';
const id='6c04b126-36ea-4c5a-bd28-e8649bae895f';
const input={profile:{id,role:'customer',is_active:true},authUser:{id},link:{profile_id:id},phone:'+919329861634'};
test('exact approved Customer UUID permits canary',()=>assert.equal(checkCustomerFirebaseCanary(input).ok,true));
test('same phone on staff UUID is denied',()=>assert.equal(checkCustomerFirebaseCanary({...input,profile:{id:'dddddddd-aaaa-4aaa-8aaa-aaaaaaaaaaaa',role:'it_super_user',is_active:true},authUser:{id:'dddddddd-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}}).ok,false));
test('unapproved Customer and inconsistent auth UUID are denied',()=>{
 assert.equal(checkCustomerFirebaseCanary({...input,profile:{...input.profile,id:'11111111-1111-4111-8111-111111111111'}}).ok,false);
 assert.equal(checkCustomerFirebaseCanary({...input,authUser:{id:'11111111-1111-4111-8111-111111111111'}}).ok,false);
});
