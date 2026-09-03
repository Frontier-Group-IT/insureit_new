import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error("Partner web core regression failed: " + message);
    process.exitCode = 1;
  }
}

function walk(relativeDir) {
  const full = path.join(root, relativeDir);
  if (!fs.existsSync(full)) return [];
  const out = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) out.push(...walk(rel));
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const requiredRoutes = [
  "app/partner/page.tsx",
  "app/partner/business/page.tsx",
  "app/partner/customers/page.tsx",
  "app/partner/customers/[id]/page.tsx",
  "app/partner/policies/page.tsx",
  "app/partner/policies/[id]/page.tsx",
  "app/partner/renewals/page.tsx",
  "app/partner/claims/page.tsx",
  "app/partner/claims/[id]/page.tsx",
  "app/partner/policy-intakes/page.tsx",
  "app/partner/policy-intakes/new/page.tsx",
  "app/partner/policy-intakes/[id]/page.tsx",
  "app/partner/payout/page.tsx",
  "app/partner/network/page.tsx",
  "app/partner/search/page.tsx",
  "app/partner/activity/page.tsx",
  "app/partner/account/page.tsx",
  "app/partner/account/registration/page.tsx",
  "app/partner/profile/page.tsx",
  "app/partner/support/page.tsx",
];

for (const route of requiredRoutes) {
  assert(fs.existsSync(path.join(root, route)), "missing required Partner route: " + route);
}

const guardedSurface = [
  ...walk("app/partner"),
  ...walk("components/partner-portal"),
  "lib/partner-web.ts",
].filter((file, index, files) => files.indexOf(file) === index);

for (const file of guardedSurface) {
  const source = read(file);
  assert(!source.includes("@/lib/supabase-admin"), file + " imports supabase-admin");
  assert(!source.includes("createSupabaseAdminClient"), file + " uses createSupabaseAdminClient");
}

const catchAll = read("app/partner/[...section]/page.tsx");
assert(catchAll.includes("await getPartnerWebSession()"), "unknown Partner routes must authenticate first");
assert(catchAll.includes("notFound()"), "unknown Partner routes must fail closed with notFound");
assert(!catchAll.includes("Construction"), "catch-all must not render a coming-soon placeholder");

const activity = read("app/partner/activity/page.tsx");
assert(!activity.includes('"/partner/learn"'), "activity must not link to an unimplemented Partner Learn route");

const login = read("components/login-form.tsx");
assert(login.includes('profile.role === "intermediary"'), "login must explicitly route intermediary identities");
assert(login.includes('"/partner"'), "intermediary login must target /partner");

const legacyPortal = read("app/intermediary-portal/page.tsx");
assert(legacyPortal.includes('redirect("/partner/account/registration")'), "legacy intermediary portal must redirect to Partner registration");
assert(!legacyPortal.includes("createSupabaseAdminClient"), "legacy compatibility route must not retain admin reads");

const registrationPage = read("app/partner/account/registration/page.tsx");
assert(registrationPage.includes("getPartnerWebRegistrationOverview"), "registration page must use scoped Partner registration adapter");
assert(registrationPage.includes("PartnerIcallLauncher"), "registration page must use the Partner iCall launcher");

const icallAction = read("app/partner/account/registration/icall-actions.ts");
assert(icallAction.includes('supabase.rpc("partner_app_training_sso_context")'), "iCall launch must use scoped Partner SSO RPC");
assert(!icallAction.includes("supabase-admin"), "iCall launch must not use service-role/admin reads");

const migrationPath = path.resolve(root, "../../supabase/migrations/20260903123000_partner_app_registration_training.sql");
assert(fs.existsSync(migrationPath), "Partner registration/training migration is missing");
if (fs.existsSync(migrationPath)) {
  const migration = fs.readFileSync(migrationPath, "utf8");
  assert(migration.includes("partner_app_registration_overview"), "registration overview RPC migration missing");
  assert(migration.includes("partner_app_training_sso_context"), "training SSO RPC migration missing");
  assert(migration.includes("auth.uid()"), "registration/training RPCs must bind to authenticated identity");
  assert(migration.includes("grant execute on function public.partner_app_registration_overview() to authenticated"), "registration overview authenticated grant missing");
  assert(migration.includes("grant execute on function public.partner_app_training_sso_context() to authenticated"), "training SSO authenticated grant missing");
}

for (const navFile of [
  "components/partner-portal/partner-navigation.tsx",
  "components/partner-portal/partner-mobile-navigation.tsx",
]) {
  const source = read(navFile);
  for (const match of source.matchAll(/href:\s*"([^"]+)"/g)) {
    assert(match[1].startsWith("/partner"), navFile + " exposes non-Partner navigation target: " + match[1]);
  }
}

if (!process.exitCode) {
  console.log("Partner web core regression passed.");
}
