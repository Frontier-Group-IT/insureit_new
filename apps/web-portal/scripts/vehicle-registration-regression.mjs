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

const vehicleForm = fs.readFileSync(path.join(portalRoot, "components/forms.tsx"), "utf8");
assert.match(vehicleForm, /VehicleRegistrationFields/);
assert.match(vehicleForm, /registration_status === "registration_pending"/);

const transitionMigration = fs.readFileSync(
  path.join(repoRoot, "supabase/migrations/202608272240_vehicle_registration_state_transition.sql"),
  "utf8",
);
assert.match(transitionMigration, /if new\.registration_status = 'registration_pending'/);
assert.match(transitionMigration, /new\.vehicle_no_normalized := null/);
assert.match(transitionMigration, /new\.vehicle_no_normalized := normalized_registration/);

const gateway = fs.readFileSync(path.join(repoRoot, "infrastructure/icall-gateway/server.js"), "utf8");
assert.match(gateway, /const bharatSeries = \/\^\\d\{2\}BH/);

console.log("Vehicle registration regression passed, including BH-series and Vehicle Master registration transitions.");
