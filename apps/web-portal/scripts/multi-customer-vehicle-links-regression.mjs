import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = path.resolve(here, "..");
const repoRoot = path.resolve(portalRoot, "../..");

const migration = fs.readFileSync(path.join(repoRoot, "supabase/migrations/20260922170000_multi_customer_vehicle_links.sql"), "utf8");
assert.match(migration, /create table if not exists public\.vehicle_customer_links/);
assert.match(migration, /primary key \(vehicle_id, customer_id\)/);
assert.match(migration, /insert into public\.vehicle_customer_links[\s\S]*from public\.vehicles v/);
assert.match(migration, /create or replace function public\.can_access_linked_vehicle/);
assert.match(migration, /create policy "vehicles linked customer read"/);
assert.match(migration, /create or replace function public\.create_customer_vehicle_v2/);
assert.match(migration, /where v\.vehicle_no_normalized = normalized_vehicle_no/);
assert.match(migration, /on conflict \(vehicle_id, customer_id\) do nothing/);
assert.match(migration, /create or replace function public\.create_customer_external_policy/);
assert.match(migration, /from public\.vehicle_customer_links link[\s\S]*link\.vehicle_id = p_vehicle_id[\s\S]*link\.customer_id = p_customer_id/);
assert.doesNotMatch(migration, /drop constraint vehicles_vehicle_no_key/);
assert.doesNotMatch(migration, /drop index.*vehicle_no_normalized_uidx/i);
assert.doesNotMatch(migration, /drop index.*chassis_no_uidx/i);

const vehicleActions = fs.readFileSync(path.join(portalRoot, "app/vehicles/vehicle-master-actions.ts"), "utf8");
assert.match(vehicleActions, /from\("vehicle_customer_links"\)/);
assert.match(vehicleActions, /vehicle_id: registrationConflict\.id/);
assert.match(vehicleActions, /vehicle_linked=1/);
assert.match(vehicleActions, /findRegistrationConflict\(admin, updatePayload\.vehicle_no_normalized, id\)/, "Edit flow must keep canonical-registration collision protection");

const vehicleNewPage = fs.readFileSync(path.join(portalRoot, "app/vehicles/new/page.tsx"), "utf8");
assert.match(vehicleNewPage, /vehicle_linked\?: string/);
assert.match(vehicleNewPage, /allowPolicyContinuation=\{canCreatePolicy && params\.vehicle_linked !== "1"\}/);

const vehiclePopup = fs.readFileSync(path.join(portalRoot, "components/vehicle-created-action-popup.tsx"), "utf8");
assert.match(vehiclePopup, /allowPolicyContinuation = true/);
assert.match(vehiclePopup, /allowPolicyContinuation \? <Link/);

const mobileHelper = fs.readFileSync(path.join(repoRoot, "apps/mobile-app/lib/customer-vehicles.ts"), "utf8");
assert.match(mobileHelper, /from\('vehicle_customer_links'\)/);
assert.match(mobileHelper, /vehicle:vehicles\(\*\)/);
assert.match(mobileHelper, /byVehicleId/);

const addVehicle = fs.readFileSync(path.join(repoRoot, "apps/mobile-app/app/customer/add-vehicle.tsx"), "utf8");
assert.match(addVehicle, /isVehicleLinkedToCustomer/);
assert.match(addVehicle, /create_customer_vehicle_v2/);

for (const file of [
  "apps/mobile-app/app/customer/home.tsx",
  "apps/mobile-app/app/customer/vehicles.tsx",
  "apps/mobile-app/app/customer/vehicle-detail.tsx",
]) {
  const source = fs.readFileSync(path.join(repoRoot, file), "utf8");
  assert.match(source, /loadCustomerLinkedVehicles/, `${file} must load vehicles through customer links`);
}

const addPolicy = fs.readFileSync(path.join(repoRoot, "apps/mobile-app/app/customer/add-policy.tsx"), "utf8");
assert.match(addPolicy, /loadCustomerVehicleAssociations/, "Add Policy must preserve customer-specific vehicle associations");

const deployWorkflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/deploy-production.yml"), "utf8");
assert.match(deployWorkflow, /20260922170000_multi_customer_vehicle_links\.sql/);
assert.match(deployWorkflow, /apply-multi-customer-vehicle-links\.yml/);

console.log("Multi-customer vehicle link regression passed: canonical vehicle identity is retained while customer associations are many-to-many.");
