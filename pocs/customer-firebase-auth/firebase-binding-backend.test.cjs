const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = __dirname;
const cache = new Map();
function load(file) {
  const full = path.join(root, file + '.ts');
  if (cache.has(full)) return cache.get(full).exports;
  const js = ts.transpileModule(fs.readFileSync(full, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const m = new Module(full, module);
  cache.set(full,m);
  m.filename=full;
  m.paths=module.paths;
  m.require = (id) => id.startsWith('./') ? load(id.slice(2)) : require(id);
  m._compile(js,full);
  return m.exports;
}
const {createFirebaseBindingBackend} = load('firebase-binding-backend');
const now=1800000000;
const idToken='opaque-valid-token-placeholder';
const verified={uid:'firebase-user-1',iss:'https://securetoken.google.com/insureit-customer-auth',aud:'insureit-customer-auth',phone_number:'+919876543210',auth_time:now-20};
const mapping={firebaseUid:verified.uid,verifiedPhoneAtApproval:verified.phone_number,profileId:'123e4567-e89b-42d3-a456-426614174000',approved:true,active:true,profileRole:'customer',profileActive:true};
test('composed backend verifies revocation and returns canonical existing profile',async()=>{
  let request;
  const backend=createFirebaseBindingBackend({verifyIdToken:async (...args)=>{request=args;return verified;}},async()=>[mapping]);
  assert.deepEqual(await backend.verify(idToken,now),{ok:true,profileId:mapping.profileId});
  assert.deepEqual(request,[idToken,true]);
});
test('composed backend denies revoked token, ambiguous link and changed phone',async()=>{
  const revoked=createFirebaseBindingBackend({verifyIdToken:async()=>{throw Error('revoked');}},async()=>[mapping]);
  assert.equal((await revoked.verify(idToken,now)).ok,false);
  const duplicate=createFirebaseBindingBackend({verifyIdToken:async()=>verified},async()=>[mapping,mapping]);
  assert.equal((await duplicate.verify(idToken,now)).ok,false);
  const changed=createFirebaseBindingBackend({verifyIdToken:async()=>({...verified,phone_number:'+919876543211'})},async()=>[mapping]);
  assert.equal((await changed.verify(idToken,now)).ok,false);
});
