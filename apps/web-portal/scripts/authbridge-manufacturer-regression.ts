import { strict as assert } from "node:assert";
// @ts-expect-error -- This regression runner executes TypeScript directly with Node --experimental-strip-types.
import { normalizeFetchedVehicleManufacturer, resolveVehicleManufacturer } from "../lib/vehicle-manufacturer-resolution.ts";

const manufacturers = [
  "Ashok Leyland",
  "Mahindra",
  "Maruti Suzuki",
  "Tata Motors",
  "Volvo Eicher Commercial Vehicles",
];

assert.equal(resolveVehicleManufacturer("Tata Motors", manufacturers)?.value, "Tata Motors");
assert.equal(resolveVehicleManufacturer("TATA MOTORS LIMITED", manufacturers)?.value, "Tata Motors");
assert.equal(resolveVehicleManufacturer("MAHINDRA & MAHINDRA LTD", manufacturers)?.value, "Mahindra");
assert.equal(resolveVehicleManufacturer("MARUTI SUZUKI INDIA PRIVATE LIMITED", manufacturers)?.value, "Maruti Suzuki");
assert.equal(resolveVehicleManufacturer("ASHOK LEYLAND LTD.", manufacturers)?.value, "Ashok Leyland");
assert.equal(resolveVehicleManufacturer("VE COMMERCIAL VEHICLES LTD", manufacturers), null);
assert.equal(resolveVehicleManufacturer("UNKNOWN VEHICLE WORKS", manufacturers), null);

assert.equal(normalizeFetchedVehicleManufacturer("Daimler"), "Bharat Benz");
assert.equal(normalizeFetchedVehicleManufacturer("DAIMLER INDIA COMMERCIAL VEHICLES PVT LTD"), "Bharat Benz");
assert.equal(normalizeFetchedVehicleManufacturer("DICV"), "Bharat Benz");
assert.equal(normalizeFetchedVehicleManufacturer("Mercedes-Benz India"), "Mercedes-Benz India");
assert.equal(normalizeFetchedVehicleManufacturer("Tata Motors"), "Tata Motors");

console.log("AuthBridge manufacturer regression: passed");
