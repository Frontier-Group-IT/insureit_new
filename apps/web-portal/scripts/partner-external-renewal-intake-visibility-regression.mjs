import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const repoRoot = path.resolve(root, "../..");
const migrationPath = path.join(repoRoot, "supabase/migrations/20260906235500_external_renewal_intake_visibility.sql");
const pagePath = path.join(root, "app/partner/renewals/external/page.tsx");
const libPath = path.join(root, "lib/partner-external-renewals.ts");

function assert(condition, message) {
  if (!condition) {
    console.error("External renewal intake visibility regression failed: " + message);
    process.exitCode = 1;
  }
}

for (const file of [migrationPath, pagePath, libPath]) assert(fs.existsSync(file), path.basename(file) + " is missing");

if (fs.existsSync(migrationPath)) {
  const migration = fs.readFileSync(migrationPath, "utf8");
  assert(migration.includes("p_intake_state text default 'all'"), "list RPC must expose the Policy Intake filter");
  assert(migration.includes("'in_policy_intake_count'"), "summary must expose the in-Policy-Intake count");
  assert(migration.includes("left join public.external_renewal_policy_intake_links"), "visibility must use the isolated conversion link");
  assert(migration.includes("r.submitted_by_profile_id"), "employee intake details must stay actor scoped");
  assert(migration.includes("r.submitted_by_portal_account_id"), "intermediary intake details must stay actor scoped");
  assert(!/\b(update|insert into|delete from)\s+public\.(customers|vehicles|policies)\b/i.test(migration), "visibility migration must not mutate verified business tables");
}

if (fs.existsSync(pagePath)) {
  const page = fs.readFileSync(pagePath, "utf8");
  assert(page.includes("In Policy Intake"), "worklist must visibly label linked opportunities");
  assert(page.includes('name="intake"'), "search must preserve the intake filter");
  assert(page.includes('value === "not_started" ? "Not Started" : "In Policy Intake"'), "worklist must expose intake filter choices");
}

if (fs.existsSync(libPath)) {
  const lib = fs.readFileSync(libPath, "utf8");
  assert(lib.includes('PartnerExternalRenewalIntakeFilter = "all" | "not_started" | "in_progress"'), "typed intake filter is missing");
  assert(lib.includes("p_intake_state: intake"), "list RPC must receive the intake filter");
}

if (!process.exitCode) console.log("External renewal intake visibility regression passed.");
