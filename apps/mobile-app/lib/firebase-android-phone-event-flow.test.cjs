const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const file = path.join(__dirname,'firebase-android-phone-event-flow.ts');
const js = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const m = new Module(file+'.cjs',module);m.filename=file+'.cjs';m.paths=module.paths;m._compile(js,m.filename);
const { FirebaseAndroidPhoneEventFlow } = m.exports;
const phone = '+919876543210';
const user = { uid:'test-firebase-uid',phoneNumber:phone,getIdToken:async()=> 'signed-firebase-token'};
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness() {
 const handlers=[];
 let resendFlags=[];
 let credentialCalls=[];
 const flow = new FirebaseAndroidPhoneEventFlow({
   verifyPhoneNumber:(_p,resend) => {resendFlags.push(resend);return {on:(_event,observer,onError)=>{handlers.push({observer,onError});}};},
   signInWithPhoneCredential:async(id,code)=>{credentialCalls.push({id,code});return {user};},
 });
 return {flow,handlers,resendFlags,credentialCalls};
}
test('CODE_SENT holds verification ID and manual credential validates phone identity',async()=>{
 const h=harness(); const send=h.flow.send(phone);
 h.handlers[0].observer({state:'sent',verificationId:'id-1'});await send;
 const verified=await h.flow.verify('123456');
 assert.equal(verified.phoneNumber,phone);assert.equal(verified.idToken,'signed-firebase-token');
 assert.deepEqual(h.credentialCalls,[{id:'id-1',code:'123456'}]);
});
test('AUTO_VERIFIED successfully authenticates without requiring an SMS code',async()=>{
 const h=harness();const events=[];h.flow.subscribe(e=>events.push(e.state));
 const send=h.flow.send(phone);
 h.handlers[0].observer({state:'verified',verificationId:'id-auto',code:'234567'});
 await send;await tick();
 const verified=await h.flow.verify('');
 assert.equal(verified.uid,'test-firebase-uid');
 assert.ok(events.includes('auto_verified'));
});
test('resend uses Firebase forceResend and ignores stale verification IDs',async()=>{
 const h=harness();const first=h.flow.send(phone);
 h.handlers[0].observer({state:'sent',verificationId:'id-old'});await first;
 const second=h.flow.send(phone);
 h.handlers[0].observer({state:'sent',verificationId:'stale'});
 h.handlers[1].observer({state:'sent',verificationId:'id-new'});await second;
 await h.flow.verify('123456');
 assert.deepEqual(h.resendFlags,[false,true]);
 assert.deepEqual(h.credentialCalls,[{id:'id-new',code:'123456'}]);
});
test('native failure rejects send and does not invent SMS success',async()=>{
 const h=harness();const events=[];h.flow.subscribe(e=>events.push(e));
 const send=h.flow.send(phone);
 h.handlers[0].onError(Object.assign(new Error('Firebase rejected request'),{code:'auth/too-many-requests'}));
 await assert.rejects(send,/Firebase rejected/);
 assert.ok(events.some(e=>e.state==='error' && e.code==='auth/too-many-requests'));
});
test('wrong manual code permits retry against same verificationId',async()=>{
 const h=harness();let attempts=0;
 const flow=new FirebaseAndroidPhoneEventFlow({
   verifyPhoneNumber:()=>({on:(_e,observer)=>observer({state:'sent',verificationId:'stable'})}),
   signInWithPhoneCredential:async()=>{attempts++;if(attempts===1)throw Object.assign(new Error('bad code'),{code:'auth/invalid-verification-code'});return {user};},
 });
 await flow.send(phone);
 await assert.rejects(flow.verify('000000'),/bad code/);
 const result=await flow.verify('123456');
 assert.equal(result.uid,'test-firebase-uid');assert.equal(attempts,2);
});
