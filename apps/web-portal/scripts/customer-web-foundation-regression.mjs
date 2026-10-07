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
  "components/customer-portal/customer-phase1.tsx",
  "lib/customer-web-data.ts",
  "app/customer/(protected)/vehicles/page.tsx",
  "app/customer/(protected)/vehicles/[id]/page.tsx",
  "app/customer/(protected)/policies/page.tsx",
  "app/customer/(protected)/policies/[id]/page.tsx",
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
assert(sessionRoute.includes("supabase.auth.getUser(accessToken)"), "Customer Web session must verify the access token server-side through Supabase Auth");
assert(sessionRoute.includes('from("profiles")'), "Customer Web session must verify the authenticated customer profile server-side");
assert(!sessionRoute.includes("getAuthenticatedProfile"), "Customer Web Cloudflare session path must not depend on the shared getClaims-based auth helper");
assert(!sessionRoute.includes("@/lib/partner-web"), "Customer Web session must remain independent from Partner authorization");
assert(!sessionRoute.includes("isAuthorizedProfile"), "Customer Web session must not widen employee/Partner authorization");
assert(!sessionRoute.includes("SUPABASE_SERVICE_ROLE_KEY"), "Customer Web session must not use service-role credentials");

const login = read("app/customer/login/customer-login-form.tsx");
assert(login.includes("shouldCreateUser: false"), "Customer login must not silently create accounts");
assert(login.includes('profile.role !== "customer"'), "Customer login must verify customer role before creating browser session");
assert(login.includes('fetch("/customer/auth/session"'), "Customer login must use the isolated Customer Web session endpoint");
assert(!login.includes('fetch("/auth/session"'), "Customer login must not use the employee/Partner session endpoint");
assert(login.includes("customerSessionErrorMessage"), "Customer login must surface safe Customer-only session diagnostics");

const protectedLayout = read("app/customer/(protected)/layout.tsx");
assert(protectedLayout.includes("await getCustomerWebSession()"), "protected Customer layout must authenticate server-side");

const phaseOneData = read("lib/customer-web-data.ts");
assert(phaseOneData.includes("await getCustomerWebSession()"), "Customer Phase 1 data scope must derive from authenticated Customer Web session");
assert(phaseOneData.includes('.eq("customer_id", customerId)'), "Customer Phase 1 queries must remain customer-id scoped");
assert(phaseOneData.includes('from("external_policies")'), "Customer Policies must include external policy parity");
assert(phaseOneData.includes("currentCustomerPolicies"), "Customer Policies must retain current-policy deduplication");
assert(!phaseOneData.includes("createSupabaseAdminClient"), "Customer Phase 1 must not use admin/service-role data access");
assert(!phaseOneData.includes("@/lib/partner-web"), "Customer Phase 1 must not depend on Partner authorization");

const vehiclePage = read("app/customer/(protected)/vehicles/page.tsx");
const vehicleDetailPage = read("app/customer/(protected)/vehicles/[id]/page.tsx");
const policyPage = read("app/customer/(protected)/policies/page.tsx");
const policyDetailPage = read("app/customer/(protected)/policies/[id]/page.tsx");
assert(vehiclePage.includes("resolveCustomerWebScope"), "Customer Vehicles must resolve authorized Customer account scope");
assert(vehicleDetailPage.includes("loadCustomerVehicleDetail(account.id, id)"), "Vehicle Detail must validate the requested vehicle inside Customer scope");
assert(policyPage.includes("resolveCustomerWebScope"), "Customer Policies must resolve authorized Customer account scope");
assert(policyDetailPage.includes("loadCustomerPolicyDetail(account.id, id"), "Policy Detail must validate the requested policy inside Customer scope");

const navigation = read("components/customer-portal/customer-navigation.tsx");
assert(navigation.includes('fetch("/customer/auth/session", { method: "DELETE" })'), "Customer logout must clear the isolated session endpoint");
assert(!navigation.includes('href="/partner'), "Customer navigation must not expose Partner routes");
assert(!navigation.includes('href="/reports'), "Customer navigation must not expose Operations report routes");
assert(navigation.includes('href="/customer/vehicles"'), "Customer navigation must expose Phase 1 Vehicles");
assert(navigation.includes('href="/customer/policies"'), "Customer navigation must expose Phase 1 Policies");

const portalRoutes = read("lib/portal-routes.ts");
const middleware = read("middleware.ts");
assert(portalRoutes.includes('"/customer"'), "Customer Web must participate in protected route session coverage");
assert(middleware.includes('type SessionStatus = "authorized" | "customer" | "forbidden" | "invalid"'), "Customer sessions must remain distinct from employee/Partner authorization");
assert(middleware.includes('profile?.is_active && profile.role === "customer"'), "middleware must recognize only active customer profiles");
assert(middleware.includes('if (check.status !== "customer")'), "Customer routes must reject non-customer sessions");
assert(middleware.includes('if (check.status === "customer") return redirect(request, "/access-denied"'), "Customer sessions must remain denied from existing protected employee/Partner routes");
assert(middleware.includes('"/customer/:path*"'), "Customer Web must remain inside middleware session-refresh coverage");
assert(middleware.includes('pathname === "/customer/auth/session"'), "Customer session bootstrap must have an exact-path middleware bypass");
assert(
  middleware.indexOf('pathname === "/customer/auth/session"') < middleware.indexOf("if (isCustomerPortalPath(pathname))"),
  "Customer session bootstrap bypass must run before protected Customer route enforcement",
);

const partnerGuard = read("lib/partner-web.ts");
assert(partnerGuard.includes('profile.role !== "intermediary"'), "Partner authorization must remain intermediary-only");

const sharedAuthConfig = read("lib/auth-config.ts");
assert(!sharedAuthConfig.includes('allowedAdminRoles = ["customer"'), "Customer must not be added to employee admin roles");
assert(sharedAuthConfig.includes('role!==\"customer\"') || read("lib/roles.ts").includes('role!=="customer"'), "Customer must remain excluded from employee portal roles");

if (!process.exitCode) {
  console.log("Customer Web foundation regression passed.");
}