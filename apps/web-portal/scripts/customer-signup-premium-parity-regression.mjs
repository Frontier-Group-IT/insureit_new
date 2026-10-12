import fs from "node:fs";
import assert from "node:assert/strict";
const login=fs.readFileSync("app/customer/login/page.tsx","utf8");
const signup=fs.readFileSync("app/customer/signup/page.tsx","utf8");
const form=fs.readFileSync("app/customer/signup/customer-signup-form.tsx","utf8");
const shared=[
 "lg:grid-cols-[minmax(0,1.08fr)_minmax(470px,0.92fr)]",
 "Your Vehicles.", "Our Protection.", "A Safer Tomorrow.",
 "Vehicle Protection", "Policy Management", "Claims Support",
 "Protected access", "Secure authentication", "Privacy focused",
 "BrandLockup inverse size=\"default\"",
 "bg-[linear-gradient(145deg,rgba(218,235,250,0.62),rgba(246,250,255,0.98))]"
];
for(const fragment of shared) {
 assert.ok(login.includes(fragment), `Login baseline missing: ${fragment}`);
 assert.ok(signup.includes(fragment), `Signup visual parity missing: ${fragment}`);
}
assert.ok(signup.includes("<CustomerSignupForm />"), "Canonical signup form must be preserved");
assert.ok(signup.includes('href="/customer/login"'), "Login navigation must remain accessible");
assert.ok(!signup.includes("<CustomerLoginForm />"), "Do not render login form on signup page");
for(const fragment of ['shouldCreateUser: true','supabase.auth.verifyOtp','ensure_customer_signup_profile','get_existing_customer_accounts_for_signup','link_existing_customer_account','/api/customer/auth/session']) {
 assert.ok(form.includes(fragment), `Signup flow must remain intact: ${fragment}`);
}
console.log("Customer signup premium parity regression passed.");
