import { isValidVehicleRegistrationNumber } from "../../../lib/vehicle-registration";

export type CommercialRegistrationType = "new" | "rollover" | null;
export type CommercialRegistrationFilter = "all" | NonNullable<CommercialRegistrationType>;

/** Current linked vehicle registration, not the original policy business type. */
export function classifyCommercialRegistration(vehicle: { registration_status: string | null; vehicle_no: string | null }): CommercialRegistrationType {
  const status = vehicle.registration_status?.trim().toLowerCase();
  const number = vehicle.vehicle_no?.trim() ?? "";
  if (status === "registration_pending" || /^(?:NEW|PENDING)-/i.test(number)) return "new";
  if (status === "registered" || status === "active") return "rollover";
  if ((!status || status === "na" || status === "n/a") && isValidVehicleRegistrationNumber(number)) return "rollover";
  return null;
}

export function matchesCommercialRegistration(value: CommercialRegistrationType, filter: CommercialRegistrationFilter): boolean {
  return filter === "all" || value === filter;
}
