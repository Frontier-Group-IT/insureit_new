import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = path.resolve(here, "..");
const appRoot = path.join(portalRoot, "app");
const portalRoutesPath = path.join(portalRoot, "lib", "portal-routes.ts");
const middlewarePath = path.join(portalRoot, "middleware.ts");
const masterDataServerPath = path.join(portalRoot, "lib", "master-data-server.ts");
const effectivePermissionsPath = path.join(portalRoot, "lib", "effective-permissions.ts");
const commercialAccessPath = path.join(portalRoot, "lib", "policy-commercial-access.ts");
const mobileBottomNavigationPath = path.join(portalRoot, "components", "claim-manager", "mobile-bottom-navigation.tsx");

const portalRoutesSource = fs.readFileSync(portalRoutesPath, "utf8");
const middlewareSource = fs.readFileSync(middlewarePath, "utf8");
const masterDataServerSource = fs.readFileSync(masterDataServerPath, "utf8");
const effectivePermissionsSource = fs.readFileSync(effectivePermissionsPath, "utf8");
const commercialAccessSource = fs.readFileSync(commercialAccessPath, "utf8");
const mobileBottomNavigationSource = fs.readFileSync(mobileBottomNavigationPath, "utf8");

function quotedValuesBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Missing end marker after: ${startMarker}`);
  return [...source.slice(start, end).matchAll(/"([^"\n]+)"/g)].map((match) => match[1]);
}

function containsPageFile(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === "page.tsx") return true;
    if (entry.isDirectory() && containsPageFile(fullPath)) return true;
  }
  return false;
}

const protectedRoots = new Set(
  quotedValuesBetween(portalRoutesSource, "export const protectedPortalRoots = [", "] as const")
    .filter((value) => value.startsWith("/")),
);
const accountsRoleRoots = new Set(
  quotedValuesBetween(portalRoutesSource, "export const accountsRolePortalRoots = [", "] as const")
    .filter((value) => value.startsWith("/")),
);
const matcherEntries = quotedValuesBetween(middlewareSource, "matcher: [", "],\n};");
const matcherRoots = new Set(
  matcherEntries
    .filter((value) => value.endsWith("/:path*"))
    .map((value) => value.slice(0, -"/:path*".length)),
);

// Authentication entry/callback pages and intentionally public legal/demo pages must stay reachable without a portal session.
const intentionallyPublicPageRoots = new Set([
  "access-denied",
  "account-deletion",
  "auth",
  "forgot-password",
  "invite",
  "login",
  "privacy-policy",
  "redesign-demo",
  "reset-password",
]);

const appPageRoots = fs.readdirSync(appRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .filter((entry) => containsPageFile(path.join(appRoot, entry.name)))
  .map((entry) => entry.name)
  .sort();

const internalPageRoots = appPageRoots
  .filter((root) => !intentionallyPublicPageRoots.has(root))
  .map((root) => `/${root}`);

const failures = [];

for (const root of internalPageRoots) {
  if (!protectedRoots.has(root)) failures.push(`${root} has an app page but is missing from protectedPortalRoots`);
  if (!matcherRoots.has(root)) failures.push(`${root} has an app page but is missing from middleware matcher session-refresh coverage`);
}

for (const root of protectedRoots) {
  if (!matcherRoots.has(root)) failures.push(`${root} is protected but is missing from middleware matcher`);
}

for (const root of matcherRoots) {
  if (!protectedRoots.has(root)) failures.push(`${root} is in middleware matcher but is not declared as a protected portal root`);
}

if (!matcherEntries.includes("/") || !matcherEntries.includes("/login")) {
  failures.push("middleware must continue covering / and /login for session bootstrap/refresh behavior");
}

if (middlewareSource.includes("accessToken && cachedRole")) {
  failures.push("middleware must not authorize from a cached role cookie without revalidating the current profile");
}
if (!middlewareSource.includes("? await checkSession(accessToken)")) {
  failures.push("middleware must revalidate the access token against the current active profile before routing");
}

if (!middlewareSource.includes('const canonicalPortalHost = "portal.insureit.in"')) {
  failures.push("middleware must declare portal.insureit.in as the canonical production portal host");
}
if (!middlewareSource.includes('process.env.VERCEL_ENV === "production"') || !middlewareSource.includes('hostname.endsWith(".vercel.app")')) {
  failures.push("middleware must normalize production Vercel aliases without affecting preview deployments");
}
if (!middlewareSource.includes("canonicalPortalRedirect(request)")) {
  failures.push("middleware must canonicalize production Vercel aliases before session authorization");
}
if (!matcherEntries.includes("/access-denied")) {
  failures.push("middleware must cover /access-denied so stale production Vercel alias links normalize back to the canonical portal");
}

if (!masterDataServerSource.includes('if (!profile) redirect("/login")')) {
  failures.push("server capability guards must distinguish a missing session from an access-denied permission result");
}

const requiredAccountsRoots = [
  "/accounts",
  "/reconciliation",
  "/policies/commercial-review",
  "/reports/accounts",
  "/reports/export/accounts",
];
for (const root of requiredAccountsRoots) {
  if (!accountsRoleRoots.has(root)) failures.push(`Accounts role must retain accounting workspace route ${root}`);
}
if (accountsRoleRoots.has("/dashboard") || accountsRoleRoots.has("/reports") || accountsRoleRoots.has("/policies")) {
  failures.push("Accounts role route allowlist must not broaden to Dashboard, all Reports, or all Policies");
}
if (!middlewareSource.includes('check.role === "accounts" && !isAccountsRolePortalPath(pathname)')) {
  failures.push("middleware must redirect Accounts users away from non-accounting protected routes");
}
if (!middlewareSource.includes('check.status === "authorized" && check.role === "accounts"')) {
  failures.push("Accounts sessions must bootstrap to /accounts instead of the general portal home");
}
if (!effectivePermissionsSource.includes('if (profile.role === "accounts") return { view_accounts: "view" };')) {
  failures.push("Accounts navigation permission map must expose only view_accounts");
}
if (!effectivePermissionsSource.includes('new Set<Capability>(["view_accounts", "view_reports"])')) {
  failures.push("Accounts server capability scope must remain limited to Accounts and Accounts Reports reads");
}
if (!commercialAccessSource.includes('profile?.role === "accounts"')) {
  failures.push("Accounts role must be admitted by the commercial-accounting server gate");
}
if (!mobileBottomNavigationSource.includes('if(role==="accounts")return null;')) {
  failures.push("Accounts mobile login must not render the general-purpose bottom navigation");
}

if (failures.length) {
  console.error("Portal session coverage regression failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Portal session coverage regression passed for ${internalPageRoots.length} authenticated top-level page roots.`);
console.log(`Protected roots and middleware matcher are in parity (${protectedRoots.size} roots).`);
console.log(`Accounts role is constrained to ${accountsRoleRoots.size} accounting route roots with Accounts-only navigation.`);
