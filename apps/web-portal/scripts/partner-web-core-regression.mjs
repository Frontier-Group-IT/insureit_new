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
  "app/partner/renewals/external/page.tsx",
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
  "lib/partner-external-renewals.ts",
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

const renewalsPage = read("app/partner/renewals/page.tsx");
assert(renewalsPage.includes("listPartnerWebRenewals"), "renewals page must use backend-filtered renewal pagination");
assert(!renewalsPage.includes("listPartnerWebPolicies"), "renewals page must not paginate generic policies then filter renewal windows locally");
assert(!renewalsPage.includes("visibleRows"), "renewal window filtering must not happen after pagination");
assert(renewalsPage.includes('href="/partner/renewals/external"'), "renewals page must expose the isolated external opportunity workspace");

const partnerWeb = read("lib/partner-web.ts");
assert(partnerWeb.includes('supabase.rpc("partner_app_list_renewals"'), "Partner renewal adapter must use scoped renewal RPC");

const externalRenewalPage = read("app/partner/renewals/external/page.tsx");
assert(externalRenewalPage.includes("listPartnerExternalRenewals"), "external renewal page must use the isolated external renewal adapter");
assert(!externalRenewalPage.includes("listPartnerWebPolicies"), "external renewal page must not use verified INSUREIT policy rows");
assert(!externalRenewalPage.includes("listPartnerWebCustomers"), "external renewal page must not use verified INSUREIT customer rows");

const externalRenewalAdapter = read("lib/partner-external-renewals.ts");
assert(externalRenewalAdapter.includes('supabase.rpc("partner_app_external_renewal_summary"'), "external renewal summary must use its scoped RPC");
assert(externalRenewalAdapter.includes('supabase.rpc("partner_app_list_external_renewals"'), "external renewal list must use its scoped RPC");

const intakeListClient = read("components/partner-portal/partner-policy-intake-list-client.tsx");
assert(intakeListClient.includes("PAGE_SIZE = 25"), "Policy Intake register must use bounded server pagination");
assert(intakeListClient.includes("offset: (page - 1) * PAGE_SIZE"), "Policy Intake register must send page offset to the server");
assert(!intakeListClient.includes("visibleRows"), "Policy Intake register filters must not be computed from one downloaded slice");

const intakeNewClient = read("components/partner-portal/partner-policy-intake-new-client.tsx");
assert(intakeNewClient.includes("getPartnerPolicyIntakeSourcesWeb"), "New Policy Intake must fetch only authorized lead sources");
assert(!intakeNewClient.includes("getPartnerPolicyIntakesWeb"), "New Policy Intake must not download intake history to get lead sources");

const intakeDetailClient = read("components/partner-portal/partner-policy-intake-detail-client.tsx");
assert(intakeDetailClient.includes("getPartnerPolicyIntakeWeb"), "Policy Intake detail must fetch only the requested intake");
assert(!intakeDetailClient.includes("getPartnerPolicyIntakesWeb"), "Policy Intake detail must not load the full intake list");
assert(!intakeDetailClient.includes(".find((item) => item.id === intakeId)"), "Policy Intake detail must not find its record client-side from the full list");

const intakeApi = read("app/api/partner/policy-intakes/route.ts");
assert(intakeApi.includes('searchParams.get("id")'), "Policy Intake API must accept a scoped detail id");
assert(intakeApi.includes('searchParams.get("filter")'), "Policy Intake API must accept server-side pipeline filters");
assert(intakeApi.includes('.range(offset, offset + limit - 1)'), "Policy Intake API must paginate before returning list rows");
assert(intakeApi.includes('view === "sources"'), "Policy Intake API must expose a sources-only view");

assert(intakeApi.includes('.eq("submitted_by_portal_account_id", identity.portal_account_id)'), "Policy Intake detail must retain Partner ownership filtering");
assert(intakeApi.includes('.eq("submitted_by_profile_id", identity.profile_id)'), "Policy Intake detail must retain employee submitter filtering");

const registrationPage = read("app/partner/account/registration/page.tsx");
assert(registrationPage.includes("getPartnerWebRegistrationOverview"), "registration page must use scoped Partner registration adapter");
assert(registrationPage.includes("PartnerIcallLauncher"), "registration page must use the Partner iCall launcher");

const icallAction = read("app/partner/account/registration/icall-actions.ts");
assert(icallAction.includes('supabase.rpc("partner_app_training_sso_context")'), "iCall launch must use scoped Partner SSO RPC");
assert(!icallAction.includes("supabase-admin"), "iCall launch must not use service-role/admin reads");

const renewalMigrationPath = path.resolve(root, "../../supabase/migrations/20260903150000_partner_web_renewal_window_pagination.sql");
assert(fs.existsSync(renewalMigrationPath), "Partner renewal pagination migration is missing");
if (fs.existsSync(renewalMigrationPath)) {
  const renewalMigration = fs.readFileSync(renewalMigrationPath, "utf8");
  assert(renewalMigration.includes("partner_app_list_renewals"), "Partner renewal list RPC migration missing");
  assert(renewalMigration.includes("partner_app_commercial_scope"), "Partner renewal RPC must derive authorization from commercial scope");
  assert(renewalMigration.includes("count(*) over() as total_count"), "Partner renewal RPC must count after renewal-window filtering");
}

const externalRenewalMigrationPath = path.resolve(root, "../../supabase/migrations/20260905223000_external_renewal_opportunities.sql");
assert(fs.existsSync(externalRenewalMigrationPath), "external renewal opportunity migration is missing");
if (fs.existsSync(externalRenewalMigrationPath)) {
  const externalMigration = fs.readFileSync(externalRenewalMigrationPath, "utf8");
  assert(externalMigration.includes("external_renewal_import_batches"), "external renewal import batch table is missing");
  assert(externalMigration.includes("external_renewal_opportunities"), "external renewal opportunity table is missing");
  assert(externalMigration.includes("policy_start_date date generated always as (invoice_date) stored"), "external renewal start date must derive from invoice date");
  assert(externalMigration.includes("invoice_date + interval '1 year'"), "external renewal end date must derive by one calendar year");
  assert(externalMigration.includes("foreign key (batch_id, partner_id)"), "external renewal batch/Partner ownership must be database-enforced");
  assert(externalMigration.includes("partner_app_commercial_scope"), "external renewal reads must derive Partner scope from authenticated commercial scope");
  assert(!externalMigration.includes("references public.customers"), "external renewal opportunities must not reference verified customers");
  assert(!externalMigration.includes("references public.vehicles"), "external renewal opportunities must not reference verified vehicles");
  assert(!externalMigration.includes("references public.policies"), "external renewal opportunities must not reference verified policies");
  assert(externalMigration.includes("revoke all on public.external_renewal_opportunities from public, anon, authenticated"), "external renewal tables must not expose direct authenticated reads");
}

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

const visualSurface = [
  ...walk("app/partner"),
  ...walk("components/partner-portal"),
].filter((file, index, files) => files.indexOf(file) === index);

const forbiddenVisualPatterns = [
  ["rounded-[26px]", "old oversized Partner card radius"],
  ["shadow-[0_16px_45px", "old heavy Partner card shadow"],
];
const forbiddenUserFacingCopy = [
  ["Partner-authorized commercial scope", "internal authorization wording"],
  ["authorized Partner scope", "internal authorization wording"],
  ["backend-authorized", "internal backend wording"],
  ["same backend summary contract", "internal backend contract wording"],
  ["same scoped policy portfolio", "internal scope wording"],
  ["Commercial Attribution", "internal attribution wording"],
];

for (const file of visualSurface) {
  const source = read(file);
  for (const [pattern, description] of forbiddenVisualPatterns) {
    assert(!source.includes(pattern), file + " reintroduced " + description + ": " + pattern);
  }
  for (const [pattern, description] of forbiddenUserFacingCopy) {
    assert(!source.includes(pattern), file + " reintroduced " + description + ": " + pattern);
  }
}

if (!process.exitCode) {
  console.log("Partner web core regression passed.");
}
