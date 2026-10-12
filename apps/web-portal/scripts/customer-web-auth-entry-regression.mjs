import fs from "node:fs";

const login = fs.readFileSync(new URL("../app/customer/login/customer-login-form.tsx", import.meta.url), "utf8");
const loginPage = fs.readFileSync(new URL("../app/customer/login/page.tsx", import.meta.url), "utf8");
const phone = fs.readFileSync(new URL("../app/customer/login/customer-phone-field.tsx", import.meta.url), "utf8");
const signup = fs.readFileSync(new URL("../app/customer/signup/customer-signup-form.tsx", import.meta.url), "utf8");
const signupPage = fs.readFileSync(new URL("../app/customer/signup/page.tsx", import.meta.url), "utf8");
const middleware = fs.readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");

const customerEntryGuard = middleware.match(/if \(pathname === "\/customer\/login" \|\| pathname === "\/customer\/signup"\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
const protectedCustomerGuard = middleware.match(/if \(isCustomerPortalPath\(pathname\)\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";

const checks = [
  [Boolean(customerEntryGuard), "Customer Signup must share the explicitly public Customer Login middleware entry boundary."],
  [customerEntryGuard.includes('check.status === "customer"') && customerEntryGuard.includes('"/customer/home"'), "Existing customer sessions must redirect to Customer Home."],
  [customerEntryGuard.includes('check.status === "authorized" || check.status === "forbidden"') && customerEntryGuard.includes('"/access-denied"'), "Non-customer authenticated roles must remain denied on Customer auth-entry routes."],
  [customerEntryGuard.includes('clearSessionCookies(continueRequest(request))'), "Unauthenticated signup must be allowed without stale customer session cookies."],
  [protectedCustomerGuard.includes('check.status === "invalid"') && protectedCustomerGuard.includes('"/customer/login"') && protectedCustomerGuard.includes('check.status !== "customer"'), "All other Customer workspace routes must stay protected."],
  [phone.includes(">\n        +91\n      </div>"), "Customer Web mobile field must render +91 as a fixed visible prefix."],
  [phone.includes('placeholder = "Enter 10 digit number"'), "Customer Web mobile field must use a local-number placeholder without +91."],
  [!login.includes('placeholder="+91'), "Customer Login must not keep +91 inside the placeholder."],
  [login.includes('shouldCreateUser: false'), "Customer Login must remain existing-user-only."],
  [loginPage.includes('href="/customer/signup"'), "Customer Login must expose a new-customer signup entry point."],
  [signup.includes('shouldCreateUser: true'), "Customer Signup must explicitly allow new auth-user creation."],
  [signup.includes('app_role: "customer"'), "Customer Signup OTP metadata must preserve the customer role."],
  [signup.includes('"get_existing_customer_accounts_for_signup"'), "Customer Signup must check existing customer masters for the verified mobile."],
  [signup.includes('"link_existing_customer_account"'), "Customer Signup must reuse an existing customer master when selected."],
  [signup.includes('"ensure_customer_signup_profile"'), "Customer Signup must use the established idempotent customer master/profile RPC."],
  [signup.includes('window.location.replace("/customer/home")'), "Successful Customer Web signup must land on Customer Home."],
  [signupPage.includes('href="/customer/login"'), "Customer Signup must provide an Already registered login path."],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  console.error(failed.join("\n"));
  process.exit(1);
}

console.log("Customer Web auth entry regression passed.");
