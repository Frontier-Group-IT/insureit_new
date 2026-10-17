import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const client = readFileSync(new URL('../lib/customer-firebase-session-exchange.ts', import.meta.url), 'utf8');
const edge = readFileSync(new URL('../../../supabase/functions/customer-firebase-session-bridge/index.ts', import.meta.url), 'utf8');
const login = readFileSync(new URL('../app/login.tsx', import.meta.url), 'utf8');
const signup = readFileSync(new URL('../app/signup.tsx', import.meta.url), 'utf8');
const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;

test('new OTP-to-Supabase client is disabled unless Android + explicit feature flag', () => {
  assert.match(client, /Platform\.OS === 'android'/);
  assert.match(client, /EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_SESSION_BRIDGE_ENABLED === 'true'/);
  assert.match(client, /if \(!firebaseOtpSessionGateEnabled\(\)\)/);
  assert.doesNotMatch(login, /exchangeVerifiedFirebaseOtpForSupabaseSession/);
  assert.doesNotMatch(signup, /exchangeVerifiedFirebaseOtpForSupabaseSession/);
});

test('one-use token exchange must establish a genuine existing Supabase Auth session', () => {
  assert.match(client, /supabase\.auth\.verifyOtp\(\{/);
  assert.match(client, /token_hash: candidate\.token_hash/);
  assert.match(client, /type: 'magiclink'/);
  assert.match(client, /session\.user\.id !== candidate\.profile_id/);
  assert.match(client, /supabase\.auth\.getUser\(\)/);
  assert.match(client, /verified\.user\.id !== candidate\.profile_id/);
  assert.match(client, /\.select\('id,role,is_active'\)/);
  assert.match(client, /profile\.role !== 'customer'/);
  assert.doesNotMatch(client, /supabase\.auth\.setSession\(\{\s*access_token:\s*firebaseIdToken/);
});

test('Android and Edge use the same bounded one-use hash validation', () => {
  const backend = readFileSync(new URL('../../../supabase/functions/_shared/customer-firebase-session-challenge.mjs', import.meta.url), 'utf8');
  const clientPattern = client.match(/const hashRe = \/(.+)\/i;/)?.[1];
  const edgePattern = backend.match(/const hexHash = \/(.+)\/i;/)?.[1];
  assert.equal(clientPattern, '^[a-f0-9]{32,128}$');
  assert.equal(edgePattern, clientPattern);
  const validator = new RegExp(clientPattern, 'i');
  for (const size of [32, 40, 64, 96, 128]) assert.equal(validator.test('a'.repeat(size)), true);
  for (const candidate of ['', 'a'.repeat(31), 'a'.repeat(129), 'z'.repeat(40)]) assert.equal(validator.test(candidate), false);
  assert.match(client, /if \(!validChallenge\(candidate\)\)/);
  assert.match(client, /session\.user\.id !== candidate\.profile_id/);
});

test('account switching restores prior Supabase Customer identity on failed exchange', () => {
  assert.match(client, /const previousSession = snapshotResult\.data\.session/);
  assert.match(client, /restoreCustomerSessionSnapshot\(previousSession\)/);
  assert.match(client, /scope: 'local'/);
  assert.match(client, /if \(mayHaveInstalledSession\)/);
});

test('Edge restricts provisioning to verified and immutable two-Customer canary', () => {
  assert.match(edge, /checkCustomerFirebaseCanary/);
  assert.match(edge, /provisionDisposableFirebaseCanaryAlias/);
  assert.match(edge, /verifyIdToken\(bearer\[1\], true\)/);
  assert.match(edge, /checkCustomerSessionEligibility/);
  assert.match(edge, /issueExistingCustomerSessionChallenge/);
  assert.match(edge, /session_identity_not_provisioned/);
  assert.match(edge, /"cache-control": "no-store, private"/);
  assert.doesNotMatch(edge, /auth\.admin\.updateUserById\s*\(/);
});

test('production 0.3.0 and native dependency boundary remain untouched', () => {
  assert.equal(config.version, '0.3.2');
  assert.equal(config.android.versionCode, 11);
  assert.doesNotMatch(login, /@react-native-firebase/);
  assert.doesNotMatch(signup, /@react-native-firebase/);
  assert.match(login, /sendPhoneOtp\(fullPhone\)/);
  assert.match(signup, /sendPhoneSignupOtp\(/);
});
