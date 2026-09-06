import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const repoRoot = path.resolve(root, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error("External renewal follow-up regression failed: " + message);
    process.exitCode = 1;
  }
}

const page = read("app/partner/renewals/external/page.tsx");
const adapter = read("lib/partner-external-renewals.ts");
const migrationPath = path.join(repoRoot, "supabase/migrations/20260906223000_external_renewal_followup_worklist.sql");

assert(fs.existsSync(migrationPath), "follow-up worklist migration is missing");
assert(page.includes('mode === "follow_up"'), "external renewal page must expose follow-up mode");
assert(page.includes("Follow-ups Due"), "external renewal page must show follow-ups due metric");
assert(page.includes("next_follow_up_at"), "external renewal rows must show next follow-up state");
assert(page.includes("last_interaction_at"), "external renewal rows must show last interaction state");
assert(page.includes('"closed"'), "external renewal page must expose explicit closed filtering");

assert(adapter.includes('PartnerExternalRenewalMode = "due" | "expired" | "future" | "follow_up"'), "adapter must support follow-up mode");
assert(adapter.includes("p_status: status"), "adapter must send status filter to scoped RPC");
assert(adapter.includes("p_follow_up: followUp"), "adapter must send follow-up filter to scoped RPC");
assert(adapter.includes("next_follow_up_at"), "adapter must retain next follow-up timestamp");

if (fs.existsSync(migrationPath)) {
  const migration = fs.readFileSync(migrationPath, "utf8");
  assert(migration.includes("partner_app_commercial_scope"), "follow-up RPCs must derive authenticated Partner scope");
  assert(migration.includes("p_follow_up text default 'all'"), "list RPC must keep a bounded follow-up filter");
  assert(migration.includes("p_status text default 'all'"), "list RPC must keep a bounded status filter");
  assert(migration.includes("o.next_follow_up_at<=now()"), "follow-up due worklist must be server-filtered");
  assert(migration.includes("o.next_follow_up_at>now()"), "scheduled follow-up worklist must be server-filtered");
  assert(migration.includes("last_interaction_at timestamptz"), "list RPC must return last interaction timestamp");
  assert(migration.includes("next_follow_up_at timestamptz"), "list RPC must return next follow-up timestamp");
  assert(migration.includes("'won','lost','invalid_contact','do_not_contact','renewed_elsewhere','duplicate'"), "active summary must exclude terminal outcomes");
  assert(!migration.includes("references public.customers"), "follow-up worklist must not reference verified customers");
  assert(!migration.includes("references public.vehicles"), "follow-up worklist must not reference verified vehicles");
  assert(!migration.includes("references public.policies"), "follow-up worklist must not reference verified policies");
  assert(!/\b(update|insert into|delete from)\s+public\.(customers|vehicles|policies)\b/i.test(migration), "follow-up worklist must not mutate verified business tables");
}

if (!process.exitCode) {
  console.log("External renewal follow-up regression passed.");
}
