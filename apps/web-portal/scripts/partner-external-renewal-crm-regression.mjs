import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const repoRoot = path.resolve(root, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}
function assert(condition, message) {
  if (!condition) {
    console.error("Partner external renewal CRM regression failed: " + message);
    process.exitCode = 1;
  }
}

const detailPath = "app/partner/renewals/external/[id]/page.tsx";
const routePath = "app/api/partner/external-renewals/[id]/interactions/route.ts";
assert(fs.existsSync(path.join(root, detailPath)), "missing external renewal opportunity detail page");
assert(fs.existsSync(path.join(root, routePath)), "missing external renewal interaction POST route");

const detail = read(detailPath);
const route = read(routePath);
const list = read("app/partner/renewals/external/page.tsx");
const adapter = read("lib/partner-external-renewals.ts");

assert(detail.includes("getPartnerExternalRenewalDetail"), "detail page must use the isolated detail adapter");
assert(detail.includes("/api/partner/external-renewals/"), "detail page must post interactions through the protected Partner route");
assert(list.includes('href={"/partner/renewals/external/"'), "worklist rows must open the isolated CRM detail page");
assert(route.includes("recordPartnerExternalRenewalInteraction"), "interaction route must use the isolated record adapter");
assert(route.includes("NextResponse.redirect"), "interaction route must return to the scoped opportunity detail");
assert(adapter.includes('supabase.rpc("partner_app_external_renewal_detail"'), "detail adapter must use the scoped detail RPC");
assert(adapter.includes('supabase.rpc("partner_app_record_external_renewal_interaction"'), "write adapter must use the scoped record RPC");

for (const [file, source] of [[detailPath, detail], [routePath, route], ["lib/partner-external-renewals.ts", adapter]]) {
  assert(!source.includes("supabase-admin"), file + " must not use service-role/admin access");
  assert(!source.includes("createSupabaseAdminClient"), file + " must not create an admin client");
}

const migrationPath = path.join(repoRoot, "supabase/migrations/20260906210000_external_renewal_interaction_tracking.sql");
assert(fs.existsSync(migrationPath), "interaction migration is missing");
if (fs.existsSync(migrationPath)) {
  const migration = fs.readFileSync(migrationPath, "utf8");
  assert(migration.includes("external_renewal_interactions"), "interaction table is missing");
  assert(migration.includes("partner_app_external_renewal_detail"), "detail RPC is missing");
  assert(migration.includes("partner_app_record_external_renewal_interaction"), "record RPC is missing");
  assert(migration.includes("auth.uid()"), "interaction writes must bind to the authenticated user");
  assert(migration.includes("partner_app_commercial_scope"), "interaction reads/writes must derive Partner scope from authenticated commercial scope");
  assert(migration.includes("revoke all on public.external_renewal_interactions from public, anon, authenticated"), "authenticated users must not directly access the interaction table");
  assert(!migration.includes("update public.customers"), "interaction migration must not update verified customers");
  assert(!migration.includes("update public.vehicles"), "interaction migration must not update verified vehicles");
  assert(!migration.includes("update public.policies"), "interaction migration must not update verified policies");
  assert(!migration.includes("insert into public.customers"), "interaction migration must not insert verified customers");
  assert(!migration.includes("insert into public.vehicles"), "interaction migration must not insert verified vehicles");
  assert(!migration.includes("insert into public.policies"), "interaction migration must not insert verified policies");
  assert(!migration.includes("references public.customers"), "interaction migration must not reference verified customers");
  assert(!migration.includes("references public.vehicles"), "interaction migration must not reference verified vehicles");
  assert(!migration.includes("references public.policies"), "interaction migration must not reference verified policies");
}

if (!process.exitCode) console.log("Partner external renewal CRM regression passed.");
