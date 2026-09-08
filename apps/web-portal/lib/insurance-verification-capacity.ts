export type InsuranceCapacitySource =
  | "engine_capacity_cc"
  | "gvw_kg"
  | "seating_capacity"
  | "vehicle_category"
  | "unavailable";

export type InsuranceVerificationVehicle = {
  vehicle_class_code: string | null;
  vehicle_class_description: string | null;
  vehicle_type: string | null;
  fuel_type: string | null;
  engine_capacity_cc: number | string | null;
  seating_capacity: number | string | null;
  gvw_kg: number | string | null;
  vehicle_category: string | null;
};

export type InsuranceVerificationCapacity = {
  vehicleClassCode: string;
  vehicleClassDescription: string;
  label: string;
  unit: string;
  value: string;
  sourceField: InsuranceCapacitySource;
};

function cleanValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function descriptor(
  vehicleClassCode: string,
  vehicleClassDescription: string,
  label: string,
  unit: string,
  value: unknown,
  sourceField: InsuranceCapacitySource,
): InsuranceVerificationCapacity {
  return {
    vehicleClassCode,
    vehicleClassDescription,
    label,
    unit,
    value: cleanValue(value),
    sourceField,
  };
}

export function resolveInsuranceVerificationCapacity(vehicle: InsuranceVerificationVehicle): InsuranceVerificationCapacity {
  const vehicleClassCode = cleanValue(vehicle.vehicle_class_code ?? vehicle.vehicle_type).toUpperCase();
  const vehicleClassDescription = cleanValue(vehicle.vehicle_class_description) || vehicleClassCode;
  const fuelType = cleanValue(vehicle.fuel_type).toLowerCase();

  if (fuelType.includes("electric")) {
    return descriptor(vehicleClassCode, vehicleClassDescription, "Capacity (kW)", "kW", vehicle.engine_capacity_cc, "engine_capacity_cc");
  }

  if (vehicleClassCode === "PCP" || vehicleClassCode === "TWP") {
    return descriptor(vehicleClassCode, vehicleClassDescription, "Capacity (CC)", "CC", vehicle.engine_capacity_cc, "engine_capacity_cc");
  }

  if (vehicleClassCode === "GCV") {
    return descriptor(vehicleClassCode, vehicleClassDescription, "GVW (Kg)", "Kg", vehicle.gvw_kg, "gvw_kg");
  }

  if (vehicleClassCode === "PCV") {
    return descriptor(vehicleClassCode, vehicleClassDescription, "Seating Capacity", "Seats", vehicle.seating_capacity, "seating_capacity");
  }

  if (vehicleClassCode === "CPM") {
    return descriptor(vehicleClassCode, vehicleClassDescription, "Equipment Capacity", "", vehicle.gvw_kg, "gvw_kg");
  }

  if (vehicleClassCode === "MISD") {
    if (cleanValue(vehicle.vehicle_category)) {
      return descriptor(vehicleClassCode, vehicleClassDescription, "Capacity (Category / CC)", "", vehicle.vehicle_category, "vehicle_category");
    }
    if (cleanValue(vehicle.engine_capacity_cc)) {
      return descriptor(vehicleClassCode, vehicleClassDescription, "Capacity (Category / CC)", "CC", vehicle.engine_capacity_cc, "engine_capacity_cc");
    }
    return descriptor(vehicleClassCode, vehicleClassDescription, "Capacity (Category / CC)", "Kg", vehicle.gvw_kg, "gvw_kg");
  }

  if (cleanValue(vehicle.engine_capacity_cc)) {
    return descriptor(vehicleClassCode, vehicleClassDescription, "Vehicle Capacity", "CC", vehicle.engine_capacity_cc, "engine_capacity_cc");
  }
  if (cleanValue(vehicle.gvw_kg)) {
    return descriptor(vehicleClassCode, vehicleClassDescription, "Vehicle Capacity", "Kg", vehicle.gvw_kg, "gvw_kg");
  }
  if (cleanValue(vehicle.seating_capacity)) {
    return descriptor(vehicleClassCode, vehicleClassDescription, "Vehicle Capacity", "Seats", vehicle.seating_capacity, "seating_capacity");
  }
  if (cleanValue(vehicle.vehicle_category)) {
    return descriptor(vehicleClassCode, vehicleClassDescription, "Vehicle Capacity", "", vehicle.vehicle_category, "vehicle_category");
  }

  return descriptor(vehicleClassCode, vehicleClassDescription, "Vehicle Capacity", "", "", "unavailable");
}
