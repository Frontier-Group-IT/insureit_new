import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const repoRoot = path.resolve(root, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error("External renewal Policy Intake regression failed: " + message);
    process.exitCode = 1;
  }
}

const opportunityPage = read("app/partner/renewals/external/[id]/page.tsx");
const intakePage = read("app/partner/policy-intakes/new/page.tsx");
const intakeClient = read("components/partner-portal/partner-policy-intake-new-client.tsx");
const externalAdapter = read("lib/partner-external-renewals.ts");
const intakeClientAdapter = read("lib/partner-policy-intakes-client.ts");
const linkRoute = read("app/api/partner/external-renewals/[id]/policy-intake/route.ts");
const migrationPath = path.join(repoRoot, "supabase/migrations/20260906233000_external_renewal_policy_intake_link.sql");

assert(fs.existsSync(migrationPath), "conversion link migration is missing");
assert(opportunityPage.includes("Start Policy Intake"), "qualified opportunity must expose Policy Intake action");
assert(opportunityPage.includes("getPartnerExternalRenewalIntakeLink"), "opportunity page must show an existing linked intake");
assert(intakePage.includes("getPartnerExternalRenewalDetail"), "prefill must be revalidated server-side");
assert(intakePage.includes("INTAKE_READY_STATUSES"), "prefill must enforce a bounded CRM readiness state");
assert(intakeClient.includes("linkExternalRenewalPolicyIntakeWeb"), "normal intake submit must link the external opportunity after success");
assert(intakeClient.includes("submitPartnerPolicyIntakeWeb"), "conversion must preserve the normal Policy Intake submission path");
assert(intakeClientAdapter.includes("/policy-intake"), "client adapter must call the dedicated link endpoint");
assert(linkRoute.includes("linkPartnerExternalRenewalPolicyIntake"), "link endpoint must use the scoped Partner RPC adapter");
assert(externalAdapter.includes("partner_app_link_external_renewal_policy_intake"), "server adapter must use the scoped conversion RPC");

if (fs.existsSync(migrationPath)) {
  const migration = fs.readFileSync(migrationPath, "utf8");
  assert(migration.includes("external_renewal_policy_intake_links"), "conversion must use an isolated mapping table");
  assert(migration.includes("partner_app_commercial_scope"), "conversion RPC must derive Partner scope");
  assert(migration.includes("partner_app_current_identity"), "conversion RPC must verify Partner identity");
  assert(migration.includes("submitted_by_profile_id"), "employee intake ownership must be enforced");
  assert(migration.includes("submitted_by_portal_account_id"), "intermediary intake ownership must be enforced");
  assert(migration.includes("'connected','interested','quote_requested','quote_shared','follow_up'"), "conversion must require meaningful CRM progress");
  assert(!migration.includes("references public.customers"), "mapping must not reference verified customers");
  assert(!migration.includes("references public.vehicles"), "mapping must not reference verified vehicles");
  assert(!migration.includes("references public.policies"), "mapping must not reference verified policies");
  assert(!/\b(update|insert into|delete from)\s+public\.(customers|vehicles|policies)\b/i.test(migration), "conversion migration must not mutate verified business tables");
}

if (!process.exitCode) {
  console.log("External renewal Policy Intake regression passed.");
}
