import {test} from 'node:test';
import assert from 'node:assert/strict';
import {provisionDisposableFirebaseCanaryAlias} from '../../../supabase/functions/_shared/customer-firebase-canary-provision.mjs';
const id='6c04b126-36ea-4c5a-bd28-e8649bae895f';
const authUser={id,phone:'9329861634',phone_confirmed_at:null,email:null,email_confirmed_at:null};
const profile={id,role:'customer',is_active:true,phone:'9329861634'};
const link={profile_id:id};
const args={profile,authUser,link,verifiedPhone:'+919329861634',explicitCanaryApproval:true};
test('no modification without explicit canary approval',async()=>{
 let called=0;
 const r=await provisionDisposableFirebaseCanaryAlias({...args,explicitCanaryApproval:false,db:{auth:{admin:{updateUserById:()=>{called++;}}}}});
 assert.equal(r.ok,false);assert.equal(called,0);
});
test('cannot modify staff account using shared phone',async()=>{
 const r=await provisionDisposableFirebaseCanaryAlias({...args,profile:{...profile,role:'accounts'},db:{}});
 assert.equal(r.ok,false);
});
test('rotate only matching Customer UUID and preserve phone confirmation',async()=>{
 let count=0;const alias='c-'+id+'@customer-login.insureit.invalid';
 const db={auth:{admin:{
   updateUserById:async(target,payload)=>{
     count++;assert.equal(target,id);assert.equal(payload.email,alias);
     assert.match(payload.password,/^[a-f0-9]{96}$/);
     return {data:{user:{...authUser,...payload,email_confirmed_at:'2026-10-16T00:00:00Z'}},error:null};
   },
   getUserById:async()=>({data:{user:{...authUser,email:alias,email_confirmed_at:'2026-10-16T00:00:00Z'}},error:null}),
 }}};
 const r=await provisionDisposableFirebaseCanaryAlias({...args,db});
 assert.equal(r.ok,true);assert.equal(count,1);assert.equal(r.authUser.id,id);
});
test('existing external email and wrong UUID always denied without mutation',async()=>{
 const r=await provisionDisposableFirebaseCanaryAlias({...args,authUser:{...authUser,email:'real@example.com'},db:{}});
 assert.equal(r.ok,false);
 const x=await provisionDisposableFirebaseCanaryAlias({...args,authUser:{...authUser,id:'11111111-1111-4111-8111-111111111111'},db:{}});
 assert.equal(x.ok,false);
});
