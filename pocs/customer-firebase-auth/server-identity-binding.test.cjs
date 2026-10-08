const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const file = path.join(__dirname,'server-identity-binding.ts');
const js = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const mod = new Module(file+'.cjs',module);
mod.filename=file+'.cjs';mod.paths=module.paths;mod._compile(js,mod.filename);
const {authorizeFirebaseCustomer}=mod.exports;
const now=1800000000, userId='123e4567-e89b-42d3-a456-426614174000';
const identity={uid:'firebase-1',aud:'insureit-customer-auth',iss:'https://securetoken.google.com/insureit-customer-auth',phone_number:'+919876543210',auth_time:now-20};
const link={firebaseUid:identity.uid,profileId:userId,verifiedPhoneAtApproval:identity.phone_number,approved:true,active:true,profileRole:'customer',profileActive:true};
const check=(id=identity,links=[link],verify=async()=>id)=>authorizeFirebaseCustomer('token',verify,async()=>links,now);
test('one reviewed active identity binds to original profile',async()=>assert.deepEqual(await check(),{ok:true,profileId:userId}));
test('invalid/revoked signature denied',async()=>assert.equal((await check(identity,[link],async()=>{throw Error('revoked')})).ok,false));
test('wrong provider, missing phone, stale login denied',async()=>{
 for(const changed of [{aud:'other'},{iss:'other'},{phone_number:null},{auth_time:now-301},{auth_time:now+1}])
  assert.equal((await check({...identity,...changed})).ok,false);
});
test('missing, duplicate, unapproved, inactive and mismatched identity denied',async()=>{
 for(const links of [[],[link,link],[{...link,approved:false}],[{...link,active:false}],[{...link,profileActive:false}],[{...link,profileRole:'agent'}],[{...link,firebaseUid:'attacker'}],[{...link,profileId:'firebase-1'}]])
  assert.equal((await check(identity,links)).ok,false);
});
test('changed verified phone cannot reuse an old approved identity binding',async()=>{
 assert.equal((await check({...identity,phone_number:'+919876543211'})).ok,false);
 assert.equal((await check(identity,[{...link,verifiedPhoneAtApproval:'+919876543211'}])).ok,false);
});
test('link store unavailability fails closed',async()=>{
 const result=await authorizeFirebaseCustomer('token',async()=>identity,async()=>{throw Error('db offline')},now);
 assert.equal(result.ok,false);
});
