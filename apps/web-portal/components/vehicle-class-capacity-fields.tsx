"use client";

import { useState } from "react";

const inputClass = "h-11 w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#64748B]";
const labelClass = "mb-1.5 block text-[10.5px] font-semibold text-[#344054]";
const fuelOptions = ["Petrol", "Diesel", "CNG", "Electric", "Hybrid", "Bi-Fuel", "Other"];
const vehicleClassMap: Record<string, { description: string; capacityLabel: string }> = {
  PCP: { description: "Private Car", capacityLabel: "CC" },
  TWP: { description: "Two Wheeler", capacityLabel: "CC" },
  GCV: { description: "Goods Carrying Vehicle", capacityLabel: "GVW" },
  PCV: { description: "Passenger Carrying Vehicle", capacityLabel: "Seating Capacity" },
  MISD: { description: "Miscellaneous Vehicle", capacityLabel: "Category / CC" },
  CPM: { description: "Contractor Plant & Machinery", capacityLabel: "Equipment Capacity" },
};

type Props = {
  defaultClass?: string | null;
  defaultChassis?: string | null;
  defaultEngine?: string | null;
  defaultFuel?: string | null;
  defaultCapacity?: string | null;
};

export function VehicleSpecificationFields({ defaultClass = "", defaultChassis = "", defaultEngine = "", defaultFuel = "", defaultCapacity = "" }: Props) {
  const [vehicleClass, setVehicleClass] = useState(defaultClass ?? "");
  const [capacity, setCapacity] = useState(defaultCapacity ?? "");
  const vehicleMeta = vehicleClassMap[vehicleClass];
  const fuels = defaultFuel && !fuelOptions.includes(defaultFuel) ? [defaultFuel, ...fuelOptions] : fuelOptions;

  function changeVehicleClass(value: string) {
    setVehicleClass(value);
    setCapacity("");
  }

  return <>
    <div className="min-w-0">
      <label className={labelClass} htmlFor="vehicle_type">Class *{vehicleMeta ? <span className="ml-1 text-[9px] font-medium text-[#315B6B]">{vehicleMeta.description}</span> : null}</label>
      <select id="vehicle_type" name="vehicle_type" className={inputClass} required value={vehicleClass} onChange={(event) => changeVehicleClass(event.target.value)}>
        <option value="">Select class</option>
        {Object.keys(vehicleClassMap).map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
    <div className="min-w-0">
      <label className={labelClass} htmlFor="chassis_no">Chassis number</label>
      <input id="chassis_no" name="chassis_no" className={`${inputClass} uppercase`} defaultValue={defaultChassis ?? ""} placeholder="Chassis number" />
    </div>
    <div className="min-w-0">
      <label className={labelClass} htmlFor="engine_no">Engine number</label>
      <input id="engine_no" name="engine_no" className={`${inputClass} uppercase`} defaultValue={defaultEngine ?? ""} placeholder="Engine number" />
    </div>
    <div className="min-w-0">
      <label className={labelClass} htmlFor="fuel_type">Fuel Type</label>
      <select id="fuel_type" name="fuel_type" className={inputClass} defaultValue={defaultFuel ?? ""}>
        <option value="">Select fuel</option>
        {fuels.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
    <div className="min-w-0">
      <label className={labelClass} htmlFor="gvw_kg">{vehicleMeta ? `Capacity (${vehicleMeta.capacityLabel})` : "Capacity"}</label>
      <input id="gvw_kg" name="gvw_kg" type="number" min="0" step="0.01" className={inputClass} value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder={vehicleMeta ? `Enter ${vehicleMeta.capacityLabel.toLowerCase()}` : "Select class first"} disabled={!vehicleClass} />
    </div>
  </>;
}
