const STANDARD_VEHICLE_REGISTRATION = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/;
const BHARAT_SERIES_REGISTRATION = /^\d{2}BH\d{4}[A-HJ-NP-Z]{1,2}$/;

export function normalizeVehicleRegistrationNumber(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidVehicleRegistrationNumber(value: string) {
  const normalized = normalizeVehicleRegistrationNumber(value);
  return STANDARD_VEHICLE_REGISTRATION.test(normalized) || BHARAT_SERIES_REGISTRATION.test(normalized);
}
