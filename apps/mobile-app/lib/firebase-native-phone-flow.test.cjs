const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const file = path.join(__dirname, 'firebase-native-phone-flow.ts');
const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const m = new Module(file + '.cjs', module);
m.filename = file + '.cjs'; m.paths = module.paths; const errorFile = path.join(__dirname, 'firebase-otp-errors.ts');
const errorJs = ts.transpileModule(fs.readFileSync(errorFile, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const errors = new Module(errorFile + '.cjs', module);
errors.filename = errorFile + '.cjs'; errors.paths = module.paths; errors._compile(errorJs, errors.filename);
m.require = (name) => name === './firebase-otp-errors' ? errors.exports : require(name);
m._compile(output, m.filename);
const { FirebasePhoneOtpFlow } = m.exports;
const phone = '+919876543210';
const auth = (userPhone = phone, token = 'fake-token') => ({
  signInWithPhoneNumber: async () => ({
    confirm: async () => ({ user: { uid: 'firebase-uid', phoneNumber: userPhone, getIdToken: async () => token } }),
  }),
});
test('verified phone returns Firebase identity but never a Supabase session', async () => {
  const flow = new FirebasePhoneOtpFlow(auth());
  await flow.send(phone);
  assert.deepEqual(await flow.verify('123456'), { uid: 'firebase-uid', phoneNumber: phone, idToken: 'fake-token' });
  await assert.rejects(() => flow.verify('123456'), /Request OTP first/);
});
test('invalid phone, OTP and missing confirmation fail closed', async () => {
  const flow = new FirebasePhoneOtpFlow(auth());
  await assert.rejects(() => flow.send('1234'), /Invalid Indian/);
  await assert.rejects(() => flow.verify('123456'), /Request OTP first/);
  await flow.send(phone);
  await assert.rejects(() => flow.verify('abcd'), /Invalid OTP/);
  flow.reset();
  await assert.rejects(() => flow.verify('123456'), /Request OTP first/);
});
test('mismatched phone and missing token denied', async () => {
  const a = new FirebasePhoneOtpFlow(auth('+919876543211'));
  await a.send(phone);
  await assert.rejects(() => a.verify('123456'), /mismatched phone/);
  const b = new FirebasePhoneOtpFlow(auth(phone, ''));
  await b.send(phone);
  await assert.rejects(() => b.verify('123456'), /ID token/);
});

test('an incorrect OTP preserves its confirmation and the next correct code succeeds', async () => {
  let tries = 0;
  const flow = new FirebasePhoneOtpFlow({
    signInWithPhoneNumber: async () => ({
      confirm: async (code) => {
        tries++;
        if (code === '000000') throw { code: 'auth/invalid-verification-code', message: 'NEVER_LOG_OTP_OR_PHONE' };
        return { user: { uid: 'firebase-uid', phoneNumber: phone, getIdToken: async () => 'opaque-token' } };
      },
    }),
  });
  await flow.send(phone);
  await assert.rejects(() => flow.verify('000000'), (e) =>
    e.code === 'auth/invalid-verification-code' && e.retryableCode === true);
  assert.equal((await flow.verify('123456')).uid, 'firebase-uid');
  assert.equal(tries, 2);
});
test('expired native confirmation clears the pending challenge and requires a new SMS', async () => {
  const flow = new FirebasePhoneOtpFlow({
    signInWithPhoneNumber: async () => ({
      confirm: async () => { throw { code: 'auth/session-expired' }; },
    }),
  });
  await flow.send(phone);
  await assert.rejects(() => flow.verify('123456'), (e) => e.code === 'auth/session-expired');
  await assert.rejects(() => flow.verify('123456'), /Request OTP first/);
});


test('native Android automatically verified SMS is accepted without reusing the consumed confirmation code', async () => {
  let priorUser={uid:'stale-uid',phoneNumber:phone,getIdToken:async()=> 'stale-token'};
  let cleared=0, calls=0;
  const fresh={uid:'fresh-uid',phoneNumber:phone,getIdToken:async()=> 'signed-firebase-token'};
  const flow=new FirebasePhoneOtpFlow({
    clearPreviousFirebaseUser:async()=>{cleared++;priorUser=null;},
    signInWithPhoneNumber:async()=> {
      priorUser=fresh; // Android's SMS Retriever automatically signed in.
      return {confirm:async()=>{calls++;throw {code:'auth/session-expired'};}};
    },
    getAutoVerifiedUser:async()=>priorUser,
  });
  await flow.send(phone);
  assert.equal(cleared,1);
  const verified=await flow.verify('123456');
  assert.deepEqual(verified,{uid:'fresh-uid',phoneNumber:phone,idToken:'signed-firebase-token'});
  assert.equal(calls,0,'must not consume an already-verified Firebase OTP a second time');
});

test('native auto verification arriving during manual confirmation recovers a consumed SMS session',async()=>{
  let user=null;
  const fresh={uid:'auto-uid',phoneNumber:phone,getIdToken:async()=> 'fresh-token'};
  const flow=new FirebasePhoneOtpFlow({
    clearPreviousFirebaseUser:async()=>{user=null;},
    getAutoVerifiedUser:async()=>user,
    signInWithPhoneNumber:async()=>({
      confirm:async()=>{user=fresh;throw {code:'auth/session-expired'};},
    }),
  });
  await flow.send(phone);
  assert.equal((await flow.verify('123456')).uid,'auto-uid');
});

test('cached Firebase user is cleared and cannot bypass real verification',async()=>{
  let user={uid:'old-user',phoneNumber:phone,getIdToken:async()=> 'old-token'};
  let sends=0;
  const flow=new FirebasePhoneOtpFlow({
    clearPreviousFirebaseUser:async()=>{user=null;},
    getAutoVerifiedUser:async()=>user,
    signInWithPhoneNumber:async()=>{sends++;return {confirm:async()=>{throw {code:'auth/session-expired'};}};},
  });
  await flow.send(phone);
  await assert.rejects(()=>flow.verify('123456'),e=>e.code==='auth/session-expired');
  assert.equal(sends,1);
  await assert.rejects(()=>flow.verify('123456'),/Request OTP first/);
});
test('auto verification for another phone or unknown uid is refused',async()=>{
  const other={uid:'other-uid',phoneNumber:'+919876543211',getIdToken:async()=> 'other-token'};
  const flow=new FirebasePhoneOtpFlow({
    clearPreviousFirebaseUser:async()=>{},
    getAutoVerifiedUser:async()=>other,
    signInWithPhoneNumber:async()=>({confirm:async()=>{throw {code:'auth/session-expired'};}}),
  });
  await flow.send(phone);
  await assert.rejects(()=>flow.verify('123456'),e=>e.code==='auth/session-expired');
});
test('if stale Firebase user cannot be cleared, no new SMS challenge is started',async()=>{
  let called=false;
  const flow=new FirebasePhoneOtpFlow({
    clearPreviousFirebaseUser:async()=>{throw {code:'auth/unknown'};},
    getAutoVerifiedUser:async()=>null,
    signInWithPhoneNumber:async()=>{called=true;return {confirm:async()=>null};},
  });
  await assert.rejects(()=>flow.send(phone),e=>e.code==='auth/unknown');
  assert.equal(called,false);
});
