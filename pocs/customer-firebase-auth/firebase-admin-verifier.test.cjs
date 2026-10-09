const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const file = path.join(__dirname, 'firebase-admin-verifier.ts');
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const mod = new Module(file+'.cjs', module);
mod.filename=file+'.cjs';
mod.paths=module.paths;
mod._compile(js,mod.filename);
const { makeRevocationCheckingFirebaseVerifier } = mod.exports;
const jwt = 'an-opaque-firebase-id-token-placeholder';
const verified = {
  uid:'firebase-uid', aud:'insureit-customer-auth',
  iss:'https://securetoken.google.com/insureit-customer-auth',
  phone_number:'+919876543210', auth_time:1800000000,
};
test('backend verifier always requests Firebase token revocation check',async()=>{
  let args;
  const verify = makeRevocationCheckingFirebaseVerifier({
    verifyIdToken:async (...input)=>{args=input;return verified;},
  });
  assert.deepEqual(await verify(jwt),verified);
  assert.deepEqual(args,[jwt,true]);
});
test('rejects missing or oversized opaque tokens before using SDK',async()=>{
  let called=false;
  const verify=makeRevocationCheckingFirebaseVerifier({verifyIdToken:async()=>{called=true;return verified;}});
  await assert.rejects(()=>verify('short'),/Invalid Firebase/);
  await assert.rejects(()=>verify('x'.repeat(16385)),/Invalid Firebase/);
  assert.equal(called,false);
});
test('propagates Firebase Admin revocation rejection',async()=>{
  const verify=makeRevocationCheckingFirebaseVerifier({
    verifyIdToken:async()=>{throw Error('revoked');},
  });
  await assert.rejects(()=>verify(jwt),/revoked/);
});
test('rejects absent UID in SDK-verified result',async()=>{
  const verify=makeRevocationCheckingFirebaseVerifier({
    verifyIdToken:async()=>({...verified,uid:''}),
  });
  await assert.rejects(()=>verify(jwt),/lacks a UID/);
});
