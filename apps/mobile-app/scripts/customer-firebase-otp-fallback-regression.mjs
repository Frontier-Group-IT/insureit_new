import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function src(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}
const login = src('../app/login.tsx');
const signup = src('../app/signup.tsx');
const config = JSON.parse(src('../eas.json'));

test('production Android build cannot enable experimental Firebase OTP login', () => {
  assert.equal(config.build.production.env.EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_SESSION_BRIDGE_ENABLED, 'false');
  assert.equal(config.build['firebase-internal-test'].env.EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_SESSION_BRIDGE_ENABLED, 'true');
});

for (const [screen, source] of [['login',login],['signup',signup]]) {
  test(screen + ' provides an explicit safe fallback to the existing SMS provider', () => {
    assert.match(source, /firebaseOtpOnly \? \(/);
    assert.match(source, /Use existing SMS verification instead/);
    assert.match(source, /resetCustomerFirebaseOtp\(\)/);
    assert.match(source, new RegExp("router\\.replace\\('/"+screen+"\\?legacyOtp=1'"));
    assert.match(source, /params\.legacyOtp !== '1'/);
    assert.match(source, /sendCustomerFirebasePhoneOtp\(/);
    assert.match(source, /verifyCustomerFirebasePhoneOtp\(/);
    assert.match(source, /sendPhone(?:Signup)?Otp\(/);
    assert.match(source, /verifyPhoneOtp\(/);
  });
}
