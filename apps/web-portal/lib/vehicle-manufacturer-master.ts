export const VEHICLE_MANUFACTURER_SEGMENTS = [
  ["PASSENGER_VEHICLE", "Passenger vehicle"],
  ["COMMERCIAL_VEHICLE", "Commercial vehicle"],
  ["TWO_WHEELER", "Two wheeler"],
  ["THREE_WHEELER", "Three wheeler"],
  ["ELECTRIC_VEHICLE", "Electric vehicle"],
  ["TRACTOR_AGRICULTURAL", "Tractor / agricultural"],
  ["CONSTRUCTION_EQUIPMENT", "Construction equipment"],
  ["EARTHMOVING_MINING", "Earthmoving / mining"],
  ["MATERIAL_HANDLING", "Material handling"],
  ["SPECIAL_PURPOSE", "Special purpose"],
] as const;

export type VehicleManufacturerSegment = (typeof VEHICLE_MANUFACTURER_SEGMENTS)[number][0];

export const VEHICLE_MANUFACTURER_MARKET_STATUSES = [
  ["current", "Current"],
  ["legacy", "Legacy / discontinued"],
  ["ceased", "Ceased"],
  ["pending_review", "Pending review"],
] as const;

export const VEHICLE_MANUFACTURER_LOGO_STATUSES = [
  ["verified", "Verified"],
  ["needs_review", "Needs review"],
  ["missing", "Missing"],
] as const;

export const VERIFIED_VEHICLE_BRAND_LOGOS = [
  ["", "No verified local logo"],
  ["/assets/vehicle-brands/ashok-leyland.svg", "Ashok Leyland"],
  ["/assets/vehicle-brands/honda.svg", "Honda"],
  ["/assets/vehicle-brands/hyundai.svg", "Hyundai"],
  ["/assets/vehicle-brands/kia.svg", "Kia"],
  ["/assets/vehicle-brands/mahindra.svg", "Mahindra"],
  ["/assets/vehicle-brands/maruti-suzuki.svg", "Maruti Suzuki"],
  ["/assets/vehicle-brands/tata.svg", "Tata"],
  ["/assets/vehicle-brands/toyota.svg", "Toyota"],
] as const;

export function vehicleManufacturerSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function splitManufacturerTokens(value: string | null | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(/[\n,|]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}
