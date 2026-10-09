const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const file = path.join(__dirname, 'firebase-native-phone-flow.ts');
const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const m = new Module(file + '.cjs', module);
m.filename = file + '.cjs'; m.paths = module.paths; m._compile(output, m.filename);
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
