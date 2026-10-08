const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const file = path.join(__dirname, 'firebase-android-auth-adapter.ts');
const js = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const loaded = new Module(file+'.cjs',module);
loaded.filename=file+'.cjs';
loaded.paths=module.paths;
loaded._compile(js,loaded.filename);
const {createAndroidFirebasePhoneAuth}=loaded.exports;
test('Android native adapter forwards phone to the Firebase SDK',async()=>{
 let requested;
 const confirmation={confirm:async()=>({user:{uid:'uid',phoneNumber:'+919876543210',getIdToken:async()=> 'token'}})};
 const provider=createAndroidFirebasePhoneAuth({signInWithPhoneNumber:async phone=>{requested=phone;return confirmation;}});
 assert.equal(await provider.signInWithPhoneNumber('+919876543210'),confirmation);
 assert.equal(requested,'+919876543210');
});
test('Android native adapter requires installed SDK Auth instance',()=>{
 assert.throws(()=>createAndroidFirebasePhoneAuth(null),/unavailable/);
 assert.throws(()=>createAndroidFirebasePhoneAuth({}),/unavailable/);
});
