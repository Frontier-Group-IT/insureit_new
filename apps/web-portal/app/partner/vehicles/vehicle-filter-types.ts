export type VehicleStatusFilter = "all" | "registered" | "rc_pending" | "uninsured";

export type VehicleTypeFilter = "all" | "cpm" | "gcv" | "misd" | "pcp" | "pcv" | "twp";

export const VEHICLE_TYPE_OPTIONS: Array<{ value: VehicleTypeFilter; label: string }> = [
  { value: "all", label: "All vehicle types" },
  { value: "cpm", label: "CPM" },
  { value: "gcv", label: "GCV" },
  { value: "misd", label: "MISD" },
  { value: "pcp", label: "PCP" },
  { value: "pcv", label: "PCV" },
  { value: "twp", label: "TWP" },
];

export function parseVehicleStatusFilter(value: string | undefined): VehicleStatusFilter {
  return value === "registered" || value === "rc_pending" || value === "uninsured" ? value : "all";
}

export function parseVehicleTypeFilter(value: string | undefined): VehicleTypeFilter {
  return value === "cpm" || value === "gcv" || value === "misd" || value === "pcp" || value === "pcv" || value === "twp" ? value : "all";
}
