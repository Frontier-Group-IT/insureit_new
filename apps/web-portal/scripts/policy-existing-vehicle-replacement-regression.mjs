import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root=path.resolve(process.cwd());
const read=(relative)=>fs.readFileSync(path.join(root,relative),"utf8");

const form=read("components/policy-unified-form.tsx");
assert(form.includes("Use Existing Vehicle"));
assert(form.includes("loadExistingVehicleForPolicyOnboarding"));
assert(form.includes("selectedExistingVehicleId"));
assert(form.includes("Active Policy Already Linked"));
assert(form.includes("Previous Policy Found"));
assert(form.includes("Replace Existing Policy"));
assert(form.includes("Confirm Replacement"));
assert(form.includes("Edit Existing Policy"));

const actions=read("app/policies/policy-onboarding-actions.ts");
assert(actions.includes("applyCanonicalExistingVehicle"));
assert(actions.includes("replace_active_motor_policy_v1"));
assert(actions.includes("Only a Manager or Administrator can replace an active policy."));
assert(actions.includes("ignoreManagedPolicyId"));

const conflicts=read("app/policies/policy-onboarding-conflicts.ts");
assert(conflicts.includes('type: "active_policy_notice"'));
assert(conflicts.includes('type: "expired_policy_history"'));
assert(conflicts.includes("canReplace: overlapping.source === \"managed\""));

const migration=read("../../supabase/migrations/20260901154500_policy_existing_vehicle_replacement.sql");
assert(migration.includes("policy_replacement_audit"));
assert(migration.includes("superseded_effective_date"));
assert(migration.includes("superseded_by_policy_id"));
assert(migration.includes("onboard_motor_policy_commercial_status_v2"));
assert(migration.includes("for update"));
assert(migration.includes("grant execute on function public.replace_active_motor_policy_v1"));

console.log("Policy existing-vehicle/replacement regression checks passed.");
