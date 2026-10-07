import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error("Customer Web foundation regression failed: " + message);
    process.exitCode = 1;
  }
}

const requiredFiles = [
  "lib/customer-web.ts",
  "app/customer/auth/session/route.ts",
  "app/customer/login/customer-login-form.tsx",
  "app/customer/login/page.tsx",
  "app/customer/(protected)/layout.tsx",
  "app/customer/(protected)/page.tsx",
  "app/customer/(protected)/home/page.tsx",
  "components/customer-portal/customer-navigation.tsx",
];

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), "missing Customer Web foundation file: " + file);
}

const guard = read("lib/customer-web.ts");
assert(guard.includes('profile.role !== "customer"'), "Customer Web guard must explicitly require the customer role");
assert(guard.includes('redirect("/customer/login")'), "missing Customer Web session must return to Customer Login");
assert(guard.includes('from("customer_memberships")'), "Customer Web scope must resolve active customer memberships");
assert(guard.includes('.eq("status", "active")'), "Customer Web memberships must be active");
assert(!guard.includes("@/lib/partner-web"), "Customer Web must not depend on Partner authorization");
assert(!guard.includes("supabase-admin"), "Customer Web must not use service-role/admin helpers");

const sessionRoute = read("app/customer/auth/session/route.ts");
assert(sessionRoute.includes('profile.role !== "customer"'), "Customer Web session endpoint must reject non-customer roles");
assert(sessionRoute.includes('sessionRoleCookie, "customer"'), "Customer Web session must record only the customer role");
assert(!sessionRoute.includes("isAuthorizedProfile"), "Customer Web session must not widen employee/Partner authorization");
assert(!sessionRoute.includes("SUPABASE_SERVICE_ROLE_KEY"), "Customer Web session must not use service-role credentials");

const login = read("app/customer/login/customer-login-form.tsx");
assert(login.includes("shouldCreateUser: false"), "Customer login must not silently create accounts");
assert(login.includes('profile.role !== "customer"'), "Customer login must verify customer role before creating browser session");
assert(login.includes('fetch("/customer/auth/session"'), "Customer login must use the isolated Customer Web session endpoint");
assert(!login.includes('fetch("/auth/session"'), "Customer login must not use the employee/Partner session endpoint");

const protectedLayout = read("app/customer/(protected)/layout.tsx");
assert(protectedLayout.includes("await getCustomerWebSession()"), "protected Customer layout must authenticate server-side");

const navigation = read("components/customer-portal/customer-navigation.tsx");
assert(navigation.includes('fetch("/customer/auth/session", { method: "DELETE" })'), "Customer logout must clear the isolated session endpoint");
assert(!navigation.includes('href="/partner'), "Customer navigation must not expose Partner routes");
assert(!navigation.includes('href="/reports'), "Customer navigation must not expose Operations report routes");

const partnerGuard = read("lib/partner-web.ts");
assert(partnerGuard.includes('profile.role !== "intermediary"'), "Partner authorization must remain intermediary-only");

const sharedAuthConfig = read("lib/auth-config.ts");
assert(!sharedAuthConfig.includes('allowedAdminRoles = ["customer"'), "Customer must not be added to employee admin roles");
assert(sharedAuthConfig.includes('role!==\"customer\"') || read("lib/roles.ts").includes('role!=="customer"'), "Customer must remain excluded from employee portal roles");

if (!process.exitCode) {
  console.log("Customer Web foundation regression passed.");
}
