const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const mobile = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(mobile, name), 'utf8');

const dataScreens = [
  'app/customer/claim-detail.tsx',
  'app/customer/e-challan.tsx',
  'components/customer-motor-policy-detail-screen.tsx',
  'components/customer-life-health-policy-detail-screen.tsx',
  'components/customer-policy-detail-screen.tsx',
  'app/customer/group/under-review.tsx',
  'components/group/group-home-screen.tsx',
];

test('migrated Customer detail screens cannot silently use singleton Supabase sessions', () => {
  for (const file of dataScreens) {
    const source = read(file);
    assert.doesNotMatch(source, /from ['"]@\/lib\/supabase['"]/, file);
    assert.doesNotMatch(source, /\bgetCurrentSession\s*\(/, file);
    assert.doesNotMatch(source, /\bsupabase\.(?:auth|from|rpc|storage)\b/, file);
    assert.match(source, /getCustomerIdentity|requireCustomerDataClient/, file);
  }
});

test('all policy detail variants route documents through the Customer private boundary', () => {
  for (const file of dataScreens.filter((name) => name.includes('policy-detail-screen'))) {
    const source = read(file);
    assert.match(source, /getCustomerPrivateDocumentUrl\(/, file);
    assert.match(source, /uploadCustomerPrivateDocument\(/, file);
    assert.match(source, /uploaded_by: identity\.profileId/, file);
    assert.match(source, /identity\.provider === 'firebase' && policy\.source === 'sibl'/, file);
    assert.doesNotMatch(source, /\.storage\.from\(/, file);
  }
});

test('Firebase private document helper never uses a legacy auth session, allows only approved buckets and refuses deletes', () => {
  const helper = read('lib/customer-private-documents.ts');
  assert.match(helper, /getFirebaseCustomerDocumentUrl\(/);
  assert.match(helper, /uploadFirebaseCustomerDocument\(/);
  assert.match(helper, /identity\.provider === 'firebase'/);
  assert.match(helper, /if \(identity\.provider === 'firebase'\) return false;/);
  assert.doesNotMatch(helper, /auth\.setSession|service_role|SERVICE_ROLE_KEY/);
});

test('claim detail queries and claim-number mutation require canonical customer ownership', () => {
  const claim = read('app/customer/claim-detail.tsx');
  assert.match(claim, /\.in\('customer_id', allowedIds\)/);
  assert.match(claim, /\.eq\('customer_id', claim\.customer_id\)/);
  assert.match(claim, /getFirebaseCustomerDocumentUrl\(/);
});


test('authenticated service enquiries use selected Customer data client; guest endpoints are unchanged', () => {
  const service = read('lib/service-enquiries.ts');
  assert.match(service, /const customerClient = await requireCustomerDataClient\(\)/);
  assert.match(service, /\(customerClient as any\)\s*\.from\('service_enquiries'\)/);
  assert.match(service, /supabase\.functions\.invoke\('guest-service-enquiry'/);
  const challan = read('app/customer/e-challan.tsx');
  assert.match(challan, /getProfile\(identity\.profileId, identity\.data\)/);
  assert.match(challan, /getCustomerForUser\(identity\.profileId, identity\.data\)/);
});


test('shared logout explicitly clears selected native Firebase Customer session', () => {
  const auth = read('lib/auth.ts');
  const identity = read('lib/customer-identity.ts');
  assert.match(auth, /if \(await isFirebaseCustomerAuthSelected\(\)\)/);
  assert.match(auth, /await signOutFirebaseCustomer\(\);/);
  assert.ok(auth.indexOf('await signOutFirebaseCustomer()') < auth.indexOf('const currentSession = await getCurrentSession()'));
  assert.match(identity, /await signOut\(getAuth\(\)\)/);
  assert.match(identity, /AsyncStorage\.getItem\(modeKey\) === 'firebase'/);
});


test('Customer Profile reads Firebase-scoped data and blocks unverified write/delete paths', () => {
  const profile = read('app/customer/profile.tsx');
  assert.match(profile, /getProfile\(identity\.profileId, client\)/);
  assert.match(profile, /getCustomerForUser\(identity\.profileId, client\)/);
  assert.match(profile, /getOnboardingApplicationForUser\(identity\.profileId, true, client\)/);
  assert.match(profile, /getCustomerPrivateDocumentUrl\(/);
  assert.doesNotMatch(profile, /\bgetCurrentSession\s*\(/);
  assert.match(profile, /if \(identity\.provider === 'firebase'\)/);
  assert.match(profile, /Document deletion is temporarily unavailable for Firebase accounts/);
});
