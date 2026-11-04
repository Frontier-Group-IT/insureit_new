import fs from "node:fs";
import assert from "node:assert/strict";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const config = read("../lib/auth-config.ts");
const client = read("../lib/auth.ts");
const middleware = read("../middleware.ts");
const authServer = read("../lib/auth-server.ts");
const customerGuard = read("../lib/customer-web.ts");
const customerSession = read("../app/api/customer/auth/session/route.ts");
const customerSessionAlias = read("../app/customer/auth/session/route.ts");
const teamSession = read("../app/auth/session/route.ts");
const customerLogin = read("../app/customer/login/customer-login-form.tsx");
const customerSignup = read("../app/customer/signup/customer-signup-form.tsx");
const customerLogout = read("../components/customer-portal/customer-header-actions.tsx");

for (const [key, expected] of [
  ["accessTokenCookie", "insureit-access-token"],
  ["refreshTokenCookie", "insureit-refresh-token"],
  ["sessionRoleCookie", "insureit-session-role"],
  ["customerAccessTokenCookie", "insureit-customer-access-token"],
  ["customerRefreshTokenCookie", "insureit-customer-refresh-token"],
  ["customerSessionRoleCookie", "insureit-customer-session-role"],
]) assert.ok(config.includes(`export const ${key} = "${expected}"`), `Missing explicit cookie name: ${key}`);

assert.match(client, /isCustomerRoute \? \{ storageKey: "insureit-customer-web-auth" \} : \{\}/,
  "Customer client must use distinct localStorage, preserving staff legacy default storage");
assert.match(client, /\.\.\.customerStorage/, "Browser Supabase auth must receive route-scoped storage");
assert.match(middleware, /const scope: SessionScope = isCustomerPortalPath\(pathname\) \? "customer" : "team"/,
  "Session must be selected by route, not cached role or fallback across accounts");
assert.match(middleware, /let accessToken = request\.cookies\.get\(names\.access\)\?\.value/,
  "Middleware must read the chosen workspace access token");
assert.match(middleware, /const refreshToken = request\.cookies\.get\(names\.refresh\)\?\.value/,
  "Middleware must refresh from the chosen workspace only");
assert.match(middleware, /if \(check\.status === "customer"\) return redirect\(request, denialPath\("customer_workspace"\)/,
  "Customer roles must still be denied from team-only routes");
assert.match(middleware, /if \(check\.status !== "customer"\)/,
  "Customer routes must continue requiring a verified Customer role");
assert.match(middleware, /clearSessionCookies\(continueRequest\(request\), scope\)/,
  "Sign-in entries must not delete the other workspace cookies");
assert.match(customerSession, /response\.cookies\.set\(customerAccessTokenCookie, body\.access_token/,
  "Customer OTP login must set customer-only cookies");
assert.match(customerSession, /response\.cookies\.set\(customerRefreshTokenCookie, body\.refresh_token/,
  "Customer login must set Customer refresh cookie");
assert.match(customerSession, /response\.cookies\.set\(customerSessionRoleCookie, "customer"/,
  "Customer role cookie stays scoped");
assert.doesNotMatch(customerSession, /response\.cookies\.set\(accessTokenCookie,/,
  "Customer session route may not write staff access cookies");
assert.match(customerSession, /profile\.role !== "customer"/, "Customer endpoint must verify role");
assert.match(customerSession, /supabase\.auth\.getUser\(accessToken\)/, "Customer JWT must be checked server-side");
assert.match(customerSessionAlias, /customerAccessTokenCookie/, "Both customer session route aliases must be isolated");
assert.match(teamSession, /response\.cookies\.set\(accessTokenCookie, body\.access_token/,
  "Team session endpoint must retain legacy cookie");
assert.doesNotMatch(teamSession, /response\.cookies\.set\(customerAccessTokenCookie,/,
  "Team login must not write Customer cookies");
assert.match(authServer, /getCustomerServerAccessToken = cache/, "Customer server token helper must exist");
assert.match(authServer, /cookieStore\.get\(customerAccessTokenCookie\)/,
  "Customer server token must come from its own cookie");
assert.match(authServer, /createCustomerServerSupabaseClient/, "Customer RLS client must exist");
assert.match(customerGuard, /await getCustomerServerAccessToken\(\)/, "Customer guard must use isolated Customer cookie");
assert.match(customerLogin, /fetch\("\/api\/customer\/auth\/session"/, "Customer OTP login must use its own endpoint");
assert.match(customerSignup, /fetch\("\/api\/customer\/auth\/session"/, "Customer Signup must use its own endpoint");
assert.match(customerLogout, /fetch\("\/api\/customer\/auth\/session", \{ method: "DELETE" \}\)/,
  "Customer logout must clear only the Customer session");
const customerRoutes = [
  "../lib/customer-web-data.ts",
  "../lib/customer-web-phase2-data.ts",
  "../lib/customer-web-phase3-data.ts",
  "../lib/customer-web-phase4-data.ts",
  "../app/api/customer/documents/route.ts",
  "../app/customer/(protected)/add-policy/page.tsx",
  "../app/customer/(protected)/add-vehicle/page.tsx",
  "../app/customer/(protected)/claims/page.tsx",
  "../app/customer/(protected)/claims/[id]/stage/[stage]/actions.ts",
  "../app/customer/(protected)/spot-intimation/page.tsx",
  "../app/customer/(protected)/start-claim/actions.ts",
  "../app/customer/kyc/start/route.ts",
  "../app/customer/kyc/submit/route.ts",
  "../app/customer/kyc/locations/route.ts",
  "../app/customer/kyc/documents/route.ts",
  "../app/customer/profile/update/route.ts",
  "../app/customer/services/enquiry/route.ts",
];
for(const p of customerRoutes){
 const source = read(p);
 assert.ok(source.includes("createCustomerServerSupabaseClient"), `Missing Customer-specific RLS client in ${p}`);
 assert.ok(!source.includes("createServerSupabaseClient"), `Customer action still reads staff cookie in ${p}`);
}
const rcLookup = read("../app/api/customer/rc-lookup/route.ts");
assert.ok(rcLookup.includes("getCustomerServerAccessToken"), "Customer RC lookup must not fall back to staff cookie");
console.log("Customer/Operations independent session and RLS-token regression passed.");
