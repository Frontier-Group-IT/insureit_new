const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const mobile=(name)=>fs.readFileSync(path.join(__dirname,'../../apps/mobile-app',name),'utf8');

test('Firebase is opt-in only; existing Supabase OTP remains the default provider',()=>{
 const config=mobile('lib/customer-identity.ts');
 const provider=mobile('lib/customer-otp-provider.ts');
 assert.match(config,/EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_ENABLED === 'true'/);
 assert.match(config,/Platform\.OS === 'android'/);
 assert.match(provider,/return legacySupabaseOtpProvider;/);
 assert.match(provider,/shouldCreateUser: false/);
 assert.match(provider,/shouldCreateUser: true/);
});

test('Firebase login and signup retain explicit legacy OTP fallback',()=>{
 const login=mobile('app/login.tsx');
 const signup=mobile('app/signup.tsx');
 const form=mobile('components/firebase-customer-otp-form.tsx');
 assert.match(login,/if \(firebaseMode\) return <FirebaseCustomerOtpForm mode="login" \/>/);
 assert.match(signup,/if \(firebaseMode\) return <FirebaseCustomerOtpForm mode="signup" \/>/);
 assert.match(login,/!addingAccount && params\.legacyOtp !== '1'/);
 assert.match(signup,/params\.legacyOtp !== '1'/);
 assert.match(form,/legacyOtp: '1'/);
 assert.match(form,/selectCustomerAuthProvider\('firebase'\)/);
 assert.ok(form.indexOf('const verified = mode') < form.indexOf("await selectCustomerAuthProvider('firebase')"));
});

test('Firebase session restoration never substitutes or fabricates a Supabase session',()=>{
 const identity=mobile('lib/customer-identity.ts');
 const login=mobile('app/login.tsx');
 assert.match(identity,/return verifiedFirebaseCustomer\(\)/);
 assert.match(identity,/provider: 'firebase'/);
 assert.match(identity,/provider: 'supabase'/);
 assert.doesNotMatch(identity,/supabase\.auth\.setSession\(/);
 assert.match(login,/identity\?\.provider === 'firebase'/);
});

test('Customer account switcher does not install remembered legacy sessions into a Firebase identity',()=>{
 const switcher=mobile('components/customer-account-switcher.tsx');
 assert.match(switcher,/identity\?\.provider === 'firebase'/);
 assert.match(switcher,/if \(firebaseMode\) return null/);
});

test('Firebase login does not bypass backend approved binding and profile resolver',()=>{
 const auth=mobile('lib/firebase-customer-auth.ts');
 const form=mobile('components/firebase-customer-otp-form.tsx');
 assert.match(auth,/functions\/v1\/customer-firebase-bind/);
 assert.match(auth,/getIdToken\(true\)/);
 assert.match(auth,/rpc\('customer_firebase_profile_id'\)/);
 assert.match(form,/confirmFirebaseCustomerOtp/);
 assert.match(form,/confirmFirebaseCustomerSignup/);
});

test('successful legacy OTP resets persisted provider to Supabase before routing',()=>{
 const login=mobile('app/login.tsx');
 const signup=mobile('app/signup.tsx');
 assert.match(login,/if \(data\.user\) await selectCustomerAuthProvider\('supabase'\)/);
 assert.match(signup,/if \(data\.user\) await selectCustomerAuthProvider\('supabase'\)/);
});
