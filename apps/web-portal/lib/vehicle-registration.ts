const STANDARD_VEHICLE_REGISTRATION = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/;
const BHARAT_SERIES_REGISTRATION = /^\d{2}BH\d{4}[A-HJ-NP-Z]{1,2}$/;

export function normalizeVehicleRegistrationNumber(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidVehicleRegistrationNumber(value: string) {
  const normalized = normalizeVehicleRegistrationNumber(value);
  return STANDARD_VEHICLE_REGISTRATION.test(normalized) || BHARAT_SERIES_REGISTRATION.test(normalized);
}

type VehicleRegistrationDisplaySource = {
  vehicle_no?: string | null;
  registration_status?: string | null;
  chassis_no?: string | null;
};

export function displayVehicleRegistrationNumber(vehicle: VehicleRegistrationDisplaySource) {
  const vehicleNo = (vehicle.vehicle_no ?? "").trim();
  const isUnregistered =
    vehicle.registration_status === "registration_pending" ||
    /^(?:NEW|PENDING)-/i.test(vehicleNo);

  if (!isUnregistered) return vehicleNo || "—";

  const chassisSource =
    (vehicle.chassis_no ?? "").trim() ||
    vehicleNo.replace(/^(?:NEW|PENDING)-/i, "");
  const normalizedChassis = chassisSource.toUpperCase().replace(/[^A-Z0-9]/g, "");

  return normalizedChassis ? `New-${normalizedChassis}` : "—";
}
