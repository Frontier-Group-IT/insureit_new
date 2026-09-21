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

const homePage = read("app/partner/page.tsx");
assert(homePage.includes('data-partner-home-reference-hero="true"'), "Partner Home must retain the approved reference header treatment");
assert(homePage.includes('bg-white'), "Partner Home header must retain the approved white background");
assert(!homePage.includes('data-partner-home-truck-art="true"'), "Partner Home header must not reintroduce truck artwork");
assert(!homePage.includes('/assets/Custom-Icons/optimized-128/fleet-vehicle.png'), "Partner Home header must not reintroduce the fleet vehicle asset");
assert(homePage.includes('data-partner-home-reference-cta="true"'), "Partner Home header must retain the reference-aligned CTA");
assert(homePage.includes('bg-[#163968]'), "Partner Home CTA must retain the approved New Intake-style navy treatment");
assert(homePage.includes('href="/partner/business"'), "Partner Home header CTA must continue to open My Business");
assert(homePage.includes("Welcome, {name}"), "Partner Home header must keep the dynamic Partner display name");
assert(homePage.includes("View My Business"), "Partner Home header must keep the My Business CTA label");
assert(!homePage.includes("Partner Overview"), "Partner Home header must keep the approved compact layout without the Partner Overview eyebrow");

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

const partnerNavigation = read("components/partner-portal/partner-navigation.tsx");
const partnerMobileNavigation = read("components/partner-portal/partner-mobile-navigation.tsx");
assert(partnerNavigation.includes('href="/partner/renewals/external"'), "Partner navigation must expose the isolated external opportunity workspace");
assert(partnerNavigation.includes("Internal Renewal"), "Partner navigation must expose Internal Renewal");
assert(partnerNavigation.includes("External Renewal"), "Partner navigation must expose External Renewal");
assert(partnerMobileNavigation.includes('href="/partner/renewals/external"'), "Partner mobile navigation must expose the isolated external opportunity workspace");
assert(partnerMobileNavigation.includes("Internal Renewal"), "Partner mobile navigation must expose Internal Renewal");
assert(partnerMobileNavigation.includes("External Renewal"), "Partner mobile navigation must expose External Renewal");

const partnerWeb = read("lib/partner-web.ts");
assert(partnerWeb.includes('supabase.rpc("partner_app_list_renewals"'), "Partner renewal adapter must use scoped renewal RPC");
assert(partnerWeb.includes("policy_service_source: string | null"), "Partner claim rows must expose the canonical claim source");

const insurerLogoResolver = read("lib/insurer-logo.ts");
const partnerPolicyPage = read("app/partner/policies/page.tsx");
const partnerFleetSummary = read("app/partner/customers/[id]/partner-customer-fleet-summary.tsx");
assert(insurerLogoResolver.includes('/assets/insurers/national-insurance.png'), "shared insurer resolver must expose National Insurance PNG");
assert(insurerLogoResolver.includes('nationalinsurancecompanylimited: "nationalinsurance"'), "National Insurance legal name alias must resolve");
assert(insurerLogoResolver.includes('/assets/insurers/united-india-insurance.png'), "shared insurer resolver must use the new United India PNG asset");
assert(partnerPolicyPage.includes("getInsurerLogo(row.insurer_name)"), "Partner Policy Register must use the shared insurer resolver");
const policyLogoIndex = partnerPolicyPage.indexOf("getInsurerLogo(row.insurer_name)");
const policyProductIndex = partnerPolicyPage.indexOf("{product.main}");
const insurerNameIndex = partnerPolicyPage.indexOf('{row.insurer_name || "Insurer not recorded"}');
assert(policyLogoIndex >= 0 && policyProductIndex >= 0 && policyLogoIndex < policyProductIndex, "Partner Policy Register insurer logo must render before Policy / Product text");
assert(insurerNameIndex > policyProductIndex, "Partner Policy Register Insurer column must remain text-only after the Policy / Product logo");
assert(partnerFleetSummary.includes("getInsurerLogo(policy.insurer_name)"), "Partner Fleet Summary must use the shared insurer resolver");

const partnerClaimsPage = read("app/partner/claims/page.tsx");
assert(partnerClaimsPage.includes('row.policy_service_source === "external" ? "external" : "internal"'), "Partner claims must classify only explicit external sources as external");
assert(!partnerClaimsPage.includes('row.policy_service_source === "internal" ? "internal" : "external"'), "Partner claims must not default missing claim source to external");

const partnerClaimSourceMigrationPath = path.resolve(root, "../../supabase/migrations/20260919103000_partner_claim_source_classification.sql");
assert(fs.existsSync(partnerClaimSourceMigrationPath), "Partner claim source classification migration is missing");
if (fs.existsSync(partnerClaimSourceMigrationPath)) {
  const migration = fs.readFileSync(partnerClaimSourceMigrationPath, "utf8");
  assert(migration.includes("cl.policy_service_source::text as policy_service_source"), "Partner claims RPC must return claims.policy_service_source");
  assert(migration.includes("f.policy_service_source"), "Partner claims RPC result must project policy_service_source");
}

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
assert(intakeApi.includes('function isLegacyPartnerIdentity(identity: PartnerIdentity)'), "Policy Intake must distinguish legacy Partner identities");
assert(intakeApi.includes('return isLegacyPartnerIdentity(identity) ? identity.portal_account_id'), "Policy Intake must retain legacy Partner portal-account ownership filtering");
assert(intakeApi.includes('if (identity.actor_kind === "employee") return identity.profile_id;'), "Policy Intake must retain employee profile ownership filtering");
assert(intakeApi.includes('if (isExplicitPortalIdentity(identity)) return identity.profile_id || identity.auth_user_id;'), "Policy Intake must attribute Group/Branch submissions to their authenticated profile");
assert(intakeApi.includes('submitted_by_profile_id: profileId'), "Policy Intake explicit identities must persist profile ownership");
assert(intakeApi.includes('submitted_by_portal_account_id: legacyPortalAccountId(identity)'), "Policy Intake legacy Partners must persist portal-account ownership");

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

const workflowAccess = read("lib/claim-workflow-access.ts");
assert(workflowAccess.includes("partner_app_insert_claim_stage_detail"), "Partner workflow mutations must use the scoped stage-detail RPC");
assert(workflowAccess.includes("if (access.isPartner)"), "Partner workflow stage writes must stay isolated from employee writes");

const partnerWorkflowMigrationPath = path.resolve(root, "../../supabase/migrations/20260919112000_partner_claim_workflow_actor.sql");
assert(fs.existsSync(partnerWorkflowMigrationPath), "Partner claim workflow actor migration is missing");
if (fs.existsSync(partnerWorkflowMigrationPath)) {
  const migration = fs.readFileSync(partnerWorkflowMigrationPath, "utf8");
  assert(migration.includes("partner_app_insert_claim_stage_detail"), "Partner claim workflow insert RPC is missing");
  assert(migration.includes("partner_app_claim_in_scope"), "Partner claim workflow writes must remain claim-scope checked");
  assert(migration.includes("new.created_by is distinct from auth.uid()"), "Claim workflow actor identity check must remain enforced");
}

if (!process.exitCode) {
  console.log("Partner web core regression passed.");
}
