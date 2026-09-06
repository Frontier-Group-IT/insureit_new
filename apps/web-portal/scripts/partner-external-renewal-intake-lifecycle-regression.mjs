import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const repoRoot = path.resolve(root, "../..");
const migrationPath = path.join(repoRoot, "supabase/migrations/20260906234500_external_renewal_intake_lifecycle.sql");

function assert(condition, message) {
  if (!condition) {
    console.error("External renewal intake lifecycle regression failed: " + message);
    process.exitCode = 1;
  }
}

assert(fs.existsSync(migrationPath), "lifecycle migration is missing");
if (fs.existsSync(migrationPath)) {
  const migration = fs.readFileSync(migrationPath, "utf8");
  assert(migration.includes("after update of final_policy_id on public.policy_intake_requests"), "sync must run only when final policy changes");
  assert(migration.includes("new.final_policy_id is not null"), "sync must require a real finalized policy");
  assert(migration.includes("external_renewal_policy_intake_links"), "sync must require the isolated opportunity/intake link");
  assert(migration.includes("opportunity_status = 'won'"), "finalized linked intake must close opportunity as won");
  assert(migration.includes("next_follow_up_at = null"), "won opportunity must clear obsolete follow-up scheduling");
  assert(migration.includes("o.opportunity_status <> 'duplicate'"), "duplicate opportunity must not be promoted to won");
  assert(!/\b(update|insert into|delete from)\s+public\.(customers|vehicles|policies)\b/i.test(migration), "lifecycle sync must not mutate verified business tables");
  assert(!migration.includes("references public.customers"), "lifecycle sync must not reference verified customers");
  assert(!migration.includes("references public.vehicles"), "lifecycle sync must not reference verified vehicles");
}

if (!process.exitCode) console.log("External renewal intake lifecycle regression passed.");
