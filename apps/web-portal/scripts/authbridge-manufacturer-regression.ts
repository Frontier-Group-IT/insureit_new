import { strict as assert } from "node:assert";
import { resolveVehicleManufacturer } from "../lib/vehicle-manufacturer-resolution";

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

console.log("AuthBridge manufacturer regression: passed");
