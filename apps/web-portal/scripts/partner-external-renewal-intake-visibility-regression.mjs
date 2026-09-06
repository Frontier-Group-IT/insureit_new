import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const repoRoot = path.resolve(root, "../..");
const migrationPath = path.join(repoRoot, "supabase/migrations/20260906235500_external_renewal_intake_visibility.sql");
const detailStateMigrationPath = path.join(repoRoot, "supabase/migrations/20260907001500_external_renewal_intake_detail_state.sql");
const pagePath = path.join(root, "app/partner/renewals/external/page.tsx");
const detailPagePath = path.join(root, "app/partner/renewals/external/[id]/page.tsx");
const libPath = path.join(root, "lib/partner-external-renewals.ts");

function assert(condition, message) {
  if (!condition) {
    console.error("External renewal intake visibility regression failed: " + message);
    process.exitCode = 1;
  }
}

for (const file of [migrationPath, detailStateMigrationPath, pagePath, detailPagePath, libPath]) assert(fs.existsSync(file), path.basename(file) + " is missing");

if (fs.existsSync(migrationPath)) {
  const migration = fs.readFileSync(migrationPath, "utf8");
  assert(migration.includes("p_intake_state text default 'all'"), "list RPC must expose the Policy Intake filter");
  assert(migration.includes("'in_policy_intake_count'"), "summary must expose the in-Policy-Intake count");
  assert(migration.includes("left join public.external_renewal_policy_intake_links"), "visibility must use the isolated conversion link");
  assert(migration.includes("r.submitted_by_profile_id"), "employee intake details must stay actor scoped");
  assert(migration.includes("r.submitted_by_portal_account_id"), "intermediary intake details must stay actor scoped");
  assert(!/\b(update|insert into|delete from)\s+public\.(customers|vehicles|policies)\b/i.test(migration), "visibility migration must not mutate verified business tables");
}

if (fs.existsSync(detailStateMigrationPath)) {
  const migration = fs.readFileSync(detailStateMigrationPath, "utf8");
  assert(migration.includes("'linked', true"), "detail RPC must expose generic linked state");
  assert(migration.includes("'owned', x.owned"), "detail RPC must distinguish current-actor ownership");
  assert(migration.includes("case when x.owned then x.intake_id else null end"), "cross-actor intake ID must stay hidden");
  assert(migration.includes("case when x.owned then x.intake_number else null end"), "cross-actor intake number must stay hidden");
  assert(migration.includes("case when x.owned then x.status else null end"), "cross-actor intake status must stay hidden");
  assert(!/\b(update|insert into|delete from)\s+public\.(customers|vehicles|policies)\b/i.test(migration), "detail-state migration must not mutate verified business tables");
}

if (fs.existsSync(pagePath)) {
  const page = fs.readFileSync(pagePath, "utf8");
  assert(page.includes("In Policy Intake"), "worklist must visibly label linked opportunities");
  assert(page.includes('name="intake"'), "search must preserve the intake filter");
  assert(page.includes('value === "not_started" ? "Not Started" : "In Policy Intake"'), "worklist must expose intake filter choices");
}

if (fs.existsSync(detailPagePath)) {
  const page = fs.readFileSync(detailPagePath, "utf8");
  assert(page.includes("!intakeLink?.linked"), "Start Policy Intake must require a truly unlinked opportunity");
  assert(page.includes("intakeLink?.linked && intakeLink.owned"), "owned linked intake must have a dedicated branch");
  assert(page.includes("Policy Intake has already been started for this opportunity"), "cross-actor linked intake must show a neutral already-started state");
  assert(page.includes("Its details remain with the Partner user who started it"), "cross-actor intake details must not be exposed");
}

if (fs.existsSync(libPath)) {
  const lib = fs.readFileSync(libPath, "utf8");
  assert(lib.includes('PartnerExternalRenewalIntakeFilter = "all" | "not_started" | "in_progress"'), "typed intake filter is missing");
  assert(lib.includes("p_intake_state: intake"), "list RPC must receive the intake filter");
  assert(lib.includes("linked: true"), "typed detail link state must expose linked");
  assert(lib.includes("owned: boolean"), "typed detail link state must expose ownership");
  assert(lib.includes("intake_id: string | null"), "cross-actor intake ID must be nullable");
}

if (!process.exitCode) console.log("External renewal intake visibility regression passed.");
