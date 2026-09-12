import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isValidVehicleRegistrationNumber,
  normalizeVehicleRegistrationNumber,
} from "../lib/vehicle-registration.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = path.resolve(here, "..");
const repoRoot = path.resolve(portalRoot, "../..");

const valid = [
  "MP20AB1234",
  "MP20DD0002",
  "24BH3275H",
  "24BH3275HK",
  " 24 bh-3275 h ",
];
for (const value of valid) {
  assert.equal(isValidVehicleRegistrationNumber(value), true, `${value} should be accepted`);
}

assert.equal(normalizeVehicleRegistrationNumber(" 24 bh-3275 h "), "24BH3275H");

const invalid = [
  "24BH327H",
  "24BH3275I",
  "24BH3275O",
  "BH24BH3275H",
  "MP20AB",
  "20AB1234",
];
for (const value of invalid) {
  assert.equal(isValidVehicleRegistrationNumber(value), false, `${value} should be rejected`);
}

const unifiedForm = fs.readFileSync(path.join(portalRoot, "components/policy-unified-form.tsx"), "utf8");
assert.match(unifiedForm, /from "@\/lib\/vehicle-registration"/);
assert.doesNotMatch(unifiedForm, /function isValidRegisteredVehicleNumber/);
assert.doesNotMatch(unifiedForm, /function normalizeRegistrationInput/);

const authbridgeApi = fs.readFileSync(path.join(portalRoot, "lib/authbridge-rc-api.ts"), "utf8");
assert.match(authbridgeApi, /from "@\/lib\/vehicle-registration"/);
assert.doesNotMatch(authbridgeApi, /function isValidVehicleRegistrationNumber/);

const onboardingActions = fs.readFileSync(path.join(portalRoot, "app/policies/policy-onboarding-actions.ts"), "utf8");
assert.match(onboardingActions, /isValidVehicleRegistrationNumber\(rawRegistration\)/);
assert.doesNotMatch(onboardingActions, /starting with 2 letters and ending with 2 digits/);

const vehicleMasterActions = fs.readFileSync(path.join(portalRoot, "app/vehicles/vehicle-master-actions.ts"), "utf8");
assert.match(vehicleMasterActions, /registration_mode/);
assert.match(vehicleMasterActions, /registration_status: registrationStatus/);
assert.match(vehicleMasterActions, /vehicle_no_normalized: vehicleNoNormalized/);
assert.match(vehicleMasterActions, /registrationStatus = "registration_pending"/);
assert.match(vehicleMasterActions, /registrationStatus = "ACTIVE"/);
assert.match(vehicleMasterActions, /findRegistrationConflict/);
assert.match(vehicleMasterActions, /requireCapability\("view_vehicles", "edit"\)/);
assert.match(vehicleMasterActions, /getAccessibleCustomerIds\(profile\.id, profile\.role, "view_vehicles"\)/);
assert.match(vehicleMasterActions, /currentVehicleRequest = currentVehicleRequest\.in\("customer_id", accessibleCustomerIds\)/);
assert.match(vehicleMasterActions, /!accessibleCustomerIds\.includes\(payload\.customer_id\)/);

const vehicleForm = fs.readFileSync(path.join(portalRoot, "components/forms.tsx"), "utf8");
assert.match(vehicleForm, /VehicleRegistrationFields/);
assert.match(vehicleForm, /registration_status === "registration_pending"/);

const vehicleEditPage = fs.readFileSync(path.join(portalRoot, "app/vehicles/[id]/edit/page.tsx"), "utf8");
assert.match(vehicleEditPage, /requireCapability\("view_vehicles"\)/);
assert.doesNotMatch(vehicleEditPage, /requireCapability\("view_vehicles", "edit"\)/);
assert.match(vehicleEditPage, /hasEffectiveCapability\(profile, "view_vehicles", "edit"\)/);
assert.match(vehicleEditPage, /getAccessibleCustomerIds\(profile\.id, profile\.role, "view_vehicles"\)/);
assert.match(vehicleEditPage, /vehicleRequest = vehicleRequest\.in\("customer_id", accessibleCustomerIds\)/);
assert.match(vehicleEditPage, /<fieldset disabled=\{!canEdit\}/);
assert.match(vehicleEditPage, /View only — you can review this vehicle, but you do not have permission to edit it\./);

const roles = fs.readFileSync(path.join(portalRoot, "lib/roles.ts"), "utf8");
const rmRole = roles.match(/relationship_manager:\[([^\]]+)\]/)?.[1] ?? "";
assert.match(rmRole, /"view_vehicles"/, "RM must retain Vehicle View access");
assert.match(rmRole, /"view_reports"/, "RM must receive Reports access");
assert.doesNotMatch(rmRole, /"create_vehicles"/, "RM must not receive Add Vehicle permission");

const transitionMigration = fs.readFileSync(
  path.join(repoRoot, "supabase/migrations/202608272240_vehicle_registration_state_transition.sql"),
  "utf8",
);
assert.match(transitionMigration, /if new\.registration_status = 'registration_pending'/);
assert.match(transitionMigration, /new\.vehicle_no_normalized := null/);
assert.match(transitionMigration, /new\.vehicle_no_normalized := normalized_registration/);

const gateway = fs.readFileSync(path.join(repoRoot, "infrastructure/icall-gateway/server.js"), "utf8");
assert.match(gateway, /const bharatSeries = \/\^\\d\{2\}BH/);

console.log("Vehicle registration regression passed, including BH-series, scoped Vehicle Master access, RM read-only vehicle details and RM Reports access.");
