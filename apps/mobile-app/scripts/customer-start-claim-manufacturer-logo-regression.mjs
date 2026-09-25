import fs from 'node:fs';

const startClaim = fs.readFileSync(new URL('../app/customer/start-claim.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(startClaim.includes("getVehicleBrandLogoSource"), 'Start Claim must use the shared vehicle manufacturer logo resolver.');
assert(startClaim.includes("const selectedVehicleBrandLogo = selectedVehicle ? getVehicleBrandLogoSource(selectedVehicle.make) : null"), 'Selected vehicle must resolve its manufacturer logo once.');
assert(startClaim.includes("source={selectedVehicleBrandLogo ?? vehicleNumberIcon}"), 'Selected vehicle must show manufacturer logo with the existing vehicle icon as fallback.');
assert(startClaim.includes("selectVehicleLogoShell"), 'Manufacturer logo must render inside the vehicle selector left-side logo shell.');
assert(startClaim.includes("selectVehicleBrandArtwork"), 'Manufacturer artwork sizing must remain independently controlled.');

console.log('Customer Start Claim manufacturer logo regression checks passed.');
