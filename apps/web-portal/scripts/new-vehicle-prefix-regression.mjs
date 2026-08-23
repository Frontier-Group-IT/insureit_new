import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("../../supabase/migrations/20260821194052_canonical_new_vehicle_prefix.sql", "utf8");
assert.match(migration, /new\.vehicle_no := 'NEW-' \|\| normalized_chassis/);
assert.match(migration, /new\.vehicle_no_normalized := null/);
assert.match(migration, /v_existing_target_conflicts/);
assert.match(migration, /v_duplicate_targets/);
assert.match(migration, /vehicle_no like 'PENDING-%'/);
assert.match(migration, /v_pending <> 0/);
assert.match(migration, /v_mismatch <> 0/);
assert.match(migration, /v_vehicle_reference := case when v_unregistered then ''NEW-''/);

const workflow = readFileSync("../../.github/workflows/apply-supabase-migrations.yml", "utf8");
assert.match(workflow, /20260821194052_canonical_new_vehicle_prefix\.sql/);
assert.match(workflow, /migration repair --linked --status applied 20260821194052/);
assert.match(workflow, /legacy_pending_prefix/);
assert.match(workflow, /canonical_mismatch/);

const vehicleWorkspace = readFileSync("app/vehicles/vehicle-workspace.tsx", "utf8");
const fleetSummary = readFileSync("app/customers/[id]/fleet/fleet-summary-client.tsx", "utf8");
const onboardingActions = readFileSync("app/policies/policy-onboarding-actions.ts", "utf8");
const misExport = readFileSync("lib/reports/policy-business-mis-export.ts", "utf8");
for (const source of [vehicleWorkspace, fleetSummary, onboardingActions, misExport]) {
  assert.match(source, /NEW/);
  assert.match(source, /PENDING/);
}

const policyOnboardingForm = readFileSync("components/policy-unified-form.tsx", "utf8");
assert.match(policyOnboardingForm, /bharatSeries=\/\^\\d\{2\}BH\\d\{4\}\[A-HJ-NP-Z\]\{1,2\}\$\//);
const bhRegistrationPattern = /^\d{2}BH\d{4}[A-HJ-NP-Z]{1,2}$/;
for (const value of ["24BH3275H", "24BH3275AB"]) assert.match(value, bhRegistrationPattern);
for (const value of ["24BH327H", "24BH3275I", "24BH3275O", "BH243275H"]) assert.doesNotMatch(value, bhRegistrationPattern);

console.log("Canonical NEW vehicle prefix regression: passed.");
