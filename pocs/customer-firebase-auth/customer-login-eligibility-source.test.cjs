const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mobile = (p) => fs.readFileSync(path.join(__dirname, '../../apps/mobile-app', p), 'utf8');
const edge = fs.readFileSync(path.join(__dirname, '../../supabase/functions/customer-firebase-registration-check/index.ts'), 'utf8');
const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261012150000_customer_firebase_registration_preflight.sql'), 'utf8');

test('Firebase customer screens reuse existing InsureIT branded auth experience and OTP dots', () => {
  const s = mobile('components/firebase-customer-otp-form.tsx');
  assert.match(s, /<AuthExperience showLegal=/);
  assert.match(s, /<AuthGlassPanel>/);
  assert.match(s, /<OtpDotsInput/);
  assert.match(s, /<SecureActionButton/);
  assert.match(s, /SignupPromptCard/);
  assert.match(s, /LoginPromptCard/);
  assert.doesNotMatch(s, /styles\.container/);
});
test('login must check customer registration BEFORE attempting Firebase SMS', () => {
  const s = mobile('components/firebase-customer-otp-form.tsx');
  assert.ok(s.indexOf('checkFirebaseCustomerRegistration') < s.indexOf("await sendFirebaseCustomerOtp('+91' + mobile)"));
  assert.match(s, /result\.status === 'not_registered'/);
  assert.match(s, /Please sign up first/);
  assert.match(s, /result\.status === 'account_requires_review'/);
  assert.match(s, /mode === 'signup' && result\.status === 'registered'/);
  assert.match(s, /mode === 'login' && result\.status !== 'registered'/);
  assert.match(s, /mode === 'signup' && result\.status !== 'not_registered'/);
});
test('mobile never gets private data or service-role API keys for the registration check', () => {
  const s = mobile('lib/firebase-customer-auth.ts');
  assert.match(s, /functions\/v1\/customer-firebase-registration-check/);
  assert.doesNotMatch(s, /SUPABASE_SERVICE_ROLE_KEY|admin\.listUsers/);
  assert.match(s, /registration_check_unavailable/);
});
test('preflight database classification includes old customer master and auth.users', () => {
  assert.match(sql, /from public\.customers c/);
  assert.match(sql, /from public\.profiles p/);
  assert.match(sql, /from auth\.users u/);
  assert.match(sql, /account_requires_review/);
  assert.match(sql, /grant execute on function public\.customer_firebase_registration_preflight\(text,text,text\) to service_role/);
  assert.match(sql, /revoke all on function public\.customer_firebase_registration_preflight\(text,text,text\) from public, anon, authenticated/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /v_ip_attempts > 30/);
  assert.match(sql, /v_phone_attempts > 10/);
});
test('preflight Edge server uses server HMAC and server-only RPC with no profile disclosure', () => {
  assert.match(edge, /crypto\.subtle\.sign\("HMAC"/);
  assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edge, /customer_firebase_registration_preflight/);
  assert.doesNotMatch(edge, /\.from\("profiles"\)/);
  assert.match(edge, /rate_limited/);
  assert.doesNotMatch(edge, /console\.log\(.*phone/);
});

test('incomplete customer signup stays out of normal login OTP and is allowed on signup', () => {
  const form = mobile('components/firebase-customer-otp-form.tsx');
  const auth = mobile('lib/firebase-customer-auth.ts');
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261012183000_firebase_unconfirmed_customer_enrollment.sql'), 'utf8');
  assert.match(form, /mode === 'login' && result.status === 'signup_incomplete'/);
  assert.match(form, /mode === 'signup' && result.status !== 'not_registered' && result.status !== 'signup_incomplete'/);
  assert.match(auth, /signup_incomplete/);
  assert.match(edge, /signup_incomplete/);
  assert.match(sql, /u.phone_confirmed_at is null/);
  assert.match(sql, /return 'signup_incomplete'/);
  assert.doesNotMatch(sql, /update public\.profiles|delete from public\.profiles/i);
});

test('OTP resend is throttled locally and an expired session requests a fresh code', () => {
  const ui = mobile('components/firebase-customer-otp-form.tsx');
  assert.match(ui, /Date\.now\(\) \+ 45000/);
  assert.match(ui, /disabled=\{busy \|\| retrySeconds > 0\}/);
  assert.match(ui, /setResendAvailableAt\(0\)/);
  assert.match(ui, /Firebase started phone verification/);
});

test('resend never activates the Verify OTP loading indicator and displays native SDK error reference safely', () => {
  const ui = mobile('components/firebase-customer-otp-form.tsx');
  assert.match(ui, /setBusyAction\('send'\)/);
  assert.match(ui, /setBusyAction\('verify'\)/);
  assert.match(ui, /loading=\{busyAction === \(sent \? 'verify' : 'send'\)\}/);
  assert.match(ui, /disabled=\{busy \|\| \(sent \?/);
  assert.match(ui, /safeFirebaseErrorCode\(nextError\)/);
  assert.match(ui, /safeFirebaseErrorCode/);
  assert.doesNotMatch(ui, /Firebase accepted the OTP request/);
});
