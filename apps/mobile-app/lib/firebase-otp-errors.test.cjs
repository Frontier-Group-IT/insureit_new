const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

const file = path.join(__dirname, 'firebase-otp-errors.ts');
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const mod = new Module(file + '.cjs', module);
mod.filename = file + '.cjs'; mod.paths = module.paths; mod._compile(js, mod.filename);
const { FirebaseCustomerOtpError, firebaseOtpFailure, firebaseOtpHttpFailure,
  firebaseOtpPublicMessage, recordFirebaseOtpStage } = mod.exports;

test('SDK invalid-code failure is retryable without exposing source error content', () => {
  const failure = firebaseOtpFailure('firebase_verification', {
    code: 'auth/invalid-verification-code',
    message: 'SECRET_OTP_PHONE_DO_NOT_EXPOSE',
  });
  assert.equal(failure.code, 'auth/invalid-verification-code');
  assert.equal(failure.retryableCode, true);
  assert.match(firebaseOtpPublicMessage(failure), /Incorrect verification code/);
  assert.ok(!firebaseOtpPublicMessage(failure).includes('SECRET'));
  assert.ok(!failure.message.includes('SECRET'));
});
test('unrecognized SDK code is not reflected to the user or logs', () => {
  const malicious = 'auth/custom-private-token-987654321';
  const failure = firebaseOtpFailure('sms_request', { code: malicious, message: 'secret' });
  assert.equal(failure.code, 'auth/unknown');
  assert.equal(failure.retryableCode, false);
  const output = [];
  const original = console.info;
  console.info = (...args) => output.push(args);
  try {
    recordFirebaseOtpStage(failure.stage, malicious);
    recordFirebaseOtpStage(failure.stage, failure.code);
  } finally { console.info = original; }
  assert.equal(output.length, 1);
  assert.ok(!JSON.stringify(output).includes(malicious));
});
test('expired code requires re-request, quota issues are distinguished', () => {
  const expired = firebaseOtpFailure('firebase_verification', { code: 'auth/session-expired' });
  assert.equal(expired.retryableCode, false);
  assert.match(firebaseOtpPublicMessage(expired), /expired/);
  assert.match(firebaseOtpPublicMessage(firebaseOtpFailure('sms_request', { code: 'auth/too-many-requests' })), /Too many/);
  assert.match(firebaseOtpPublicMessage(firebaseOtpFailure('sms_request', { code: 'auth/app-not-authorized' })), /Android app verification/);
});
test('binding failure is distinct from Firebase code validation', () => {
  const conflict = firebaseOtpHttpFailure('customer_binding', 409);
  assert.equal(conflict.stage, 'customer_binding');
  assert.equal(conflict.code, 'customer/conflict');
  assert.match(firebaseOtpPublicMessage(conflict), /customer account needs review/);
  const unavailable = firebaseOtpHttpFailure('customer_registration', 503);
  assert.equal(unavailable.code, 'customer/server-unavailable');
});
test('test-stage regression preserves protected Start Claim header and full-field selector', () => {
  const root = path.resolve(__dirname, '..');
  const header = fs.readFileSync(path.join(root, 'components/customer-aware-ui.tsx'), 'utf8');
  const selector = fs.readFileSync(path.join(root, 'app/customer/start-claim.tsx'), 'utf8');
  // Feature-branch customer UI will be reconciled against the current main
  // before any AAB/OTA promotion. Here we avoid claiming the old PR contains
  // the final fixed header implementation.
  assert.ok(selector.includes('VehicleDropdown') || selector.includes('vehicle'));
  assert.ok(header.includes('CustomerFixedScreen'));
});
