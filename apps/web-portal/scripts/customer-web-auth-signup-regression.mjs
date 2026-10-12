import fs from "node:fs";

const login = fs.readFileSync(new URL("../app/customer/login/customer-login-form.tsx", import.meta.url), "utf8");
const loginPage = fs.readFileSync(new URL("../app/customer/login/page.tsx", import.meta.url), "utf8");
const signup = fs.readFileSync(new URL("../app/customer/signup/customer-signup-form.tsx", import.meta.url), "utf8");
const signupPage = fs.readFileSync(new URL("../app/customer/signup/page.tsx", import.meta.url), "utf8");
const middleware = fs.readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
const helper = fs.readFileSync(new URL("../lib/customer-web-auth-client.ts", import.meta.url), "utf8");

const checks = [
  [login.includes('>+91</div>'), "Customer Web login must render +91 as a fixed prefix instead of placeholder text."],
  [login.includes('placeholder="Enter 10 digit number"'), "Customer Web login must ask only for the 10-digit national number."],
  [login.includes("shouldCreateUser: false"), "Customer Web login must remain existing-user-only."],
  [loginPage.includes('href="/customer/signup"'), "Customer Web login must expose a signup entry point."],
  [signupPage.includes("Create customer account"), "Customer Web must provide a dedicated signup page."],
  [signup.includes("shouldCreateUser: true"), "Customer Web signup must explicitly allow creation of new Customer auth users."],
  [signup.includes('app_role: "customer"'), "Customer Web signup OTP metadata must preserve the Customer role contract."],
  [signup.includes('"get_existing_customer_accounts_for_signup"'), "Customer Web signup must reuse existing-customer detection."],
  [signup.includes('"link_existing_customer_account"'), "Customer Web signup must allow safe reuse of an existing customer master."],
  [signup.includes('"ensure_customer_signup_profile"'), "Customer Web signup must use the canonical customer-master/profile setup RPC."],
  [signup.includes("establishCustomerWebSession"), "Customer Web signup must establish the secure Customer Web session before routing Home."],
  [signup.includes('href="/customer/login"'), "Customer Web signup must provide an Already registered login action."],
  [middleware.includes('pathname === "/customer/login" || pathname === "/customer/signup"'), "Middleware must treat login and signup as public Customer auth routes."],
  [helper.includes("phone10.length === 10"), "Customer Web auth must validate a 10-digit national mobile number before E.164 submission."],
  [helper.includes("`+91${phone10}`"), "Customer Web auth must add +91 only during E.164 submission."],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  console.error(failed.join("\\n"));
  process.exit(1);
}

console.log("Customer Web login/signup regression passed.");
