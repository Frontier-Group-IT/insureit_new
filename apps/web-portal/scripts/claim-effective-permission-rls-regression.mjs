import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");

const migrationPath = path.join(repoRoot, "supabase/migrations/20260908123000_align_claim_workflow_rls_with_effective_manage_claims.sql");
const migration = await readFile(migrationPath, "utf8");
const stageActions = await readFile(path.join(repoRoot, "apps/web-portal/app/claims/stage-actions.ts"), "utf8");
const verificationActions = await readFile(path.join(repoRoot, "apps/web-portal/app/claims/[id]/verification-actions.ts"), "utf8");
const roles = await readFile(path.join(repoRoot, "apps/web-portal/lib/roles.ts"), "utf8");

assert.match(migration, /create or replace function public\.can_manage_claim\(target_claim_id uuid\)/);
assert.match(migration, /public\.can_manage_claims_organization\(\)/);
assert.match(migration, /public\.can_update_claim_status\(\)/);
assert.match(migration, /public\.can_access_claim\(auth\.uid\(\), target_claim_id\)/);
assert.match(migration, /revoke all on function public\.can_manage_claim\(uuid\) from public/);
assert.match(migration, /grant execute on function public\.can_manage_claim\(uuid\) to authenticated/);

for (const table of [
  "claim_stage_details",
  "claim_status_history",
  "claim_documents",
  "claim_document_verifications",
  "claim_tasks",
  "claim_financials",
  "claim_milestones",
]) {
  assert.match(migration, new RegExp(`on public\\.${table}`), `${table} must be covered by effective claim authorization`);
}

for (const fragment of [
  '"claim stage details effective manage claims insert"',
  '"claim stage details effective manage claims select"',
  '"claim stage details effective manage claims update"',
  '"claim history effective manage claims insert"',
  '"claim history effective manage claims select"',
  '"claim documents effective manage claims insert"',
  '"claim documents effective manage claims select"',
  '"claim documents effective manage claims update"',
  '"claim document verifications effective manage claims insert"',
  '"claim document verifications effective manage claims select"',
  '"claim document verifications effective manage claims update"',
  '"claim tasks effective manage claims insert"',
  '"claim tasks effective manage claims select"',
  '"claim tasks effective manage claims update"',
  '"claim financials effective manage claims insert"',
  '"claim financials effective manage claims select"',
  '"claim financials effective manage claims update"',
  '"claim milestones effective manage claims select"',
]) {
  assert.ok(migration.includes(fragment), `missing policy ${fragment}`);
}

assert.match(migration, /created_by is null or created_by = auth\.uid\(\)/);
assert.match(migration, /changed_by is null or changed_by = auth\.uid\(\)/);
assert.match(migration, /uploaded_by is null or uploaded_by = auth\.uid\(\)/);
assert.match(migration, /verified_by is null or verified_by = auth\.uid\(\)/);

assert.match(stageActions, /hasEffectiveCapability\(profile, "manage_claims", "edit"\)/);
assert.match(stageActions, /from\("claim_stage_details"\)\.insert/);
assert.match(stageActions, /from\("claim_status_history"\)\.insert/);
assert.match(verificationActions, /hasEffectiveCapability\(profile, "manage_claims", "edit"\)/);
assert.match(verificationActions, /from\("claim_documents"\)\.update/);
assert.match(verificationActions, /from\("claim_stage_details"\)\.insert/);

const salesHeadBlock = roles.match(/sales_head:\[(.*?)\],\n  zonal_head:/s)?.[1] ?? "";
assert.doesNotMatch(salesHeadBlock, /"manage_claims"/, "sales_head must not gain manage_claims by role default");

console.log("Claim effective manage_claims RLS regression passed.");
