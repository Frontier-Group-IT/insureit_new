"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CustomerVehicleRow } from "@/lib/customer-web-data";

type SelectionProps = { vehicles: CustomerVehicleRow[]; blocked: string[]; initial?: string; accountId: string };
type SelectionContext = {
  vehicles: CustomerVehicleRow[];
  blocked: string[];
  selected: string;
  setSelected: (value: string) => void;
  products: string[];
  vehicleType: string;
};
const PolicySelectionContext = createContext<SelectionContext | null>(null);

export function CustomerPolicySelectionProvider({
  vehicles, blocked, initial, children,
}: Omit<SelectionProps, "accountId"> & { children: ReactNode }) {
  const [selected, setSelected] = useState(
    initial && vehicles.some(v => v.id === initial && !blocked.includes(v.id)) ? initial : "",
  );
  const vehicle = useMemo(() => vehicles.find(v => v.id === selected), [vehicles, selected]);
  const vehicleType = vehicle?.vehicle_type ?? "";
  const products = (vehicleType === "PCP" || vehicleType === "TWP")
    ? ["Package", "Third Party", "SAOD", "Bundled", "Long Term Package", "Long Term Third Party"]
    : ["Package", "Third Party", "SAOD"];

  return <PolicySelectionContext.Provider value={{ vehicles, blocked, selected, setSelected, products, vehicleType }}>
    {children}
  </PolicySelectionContext.Provider>;
}

function usePolicySelection() {
  const value = useContext(PolicySelectionContext);
  if (!value) throw new Error("Policy selection fields require their provider.");
  return value;
}

export function CustomerPolicyVehicleField() {
  const { vehicles, blocked, selected, setSelected } = usePolicySelection();
  return <>
    <label className="text-sm font-bold sm:col-span-2">Vehicle number *
      <select name="vehicle" value={selected} onChange={e => setSelected(e.target.value)} required className="mt-2 block w-full rounded-xl border p-3 text-sm">
        <option value="">Select a vehicle</option>
        {vehicles.map(v => <option key={v.id} value={v.id} disabled={blocked.includes(v.id)}>{v.vehicle_no} · {[v.make,v.model].filter(Boolean).join(" ")}{blocked.includes(v.id) ? " · Active policy exists" : ""}</option>)}
      </select>
    </label>
    {vehicles.length > 0 && blocked.length === vehicles.length ? <p role="status" className="sm:col-span-2 rounded-lg border border-[#F2D7DA] bg-[#FFF7F8] p-3 text-xs text-[#A43B49]">Every linked vehicle already has an active policy. You cannot add a duplicate active policy.</p> : null}
  </>;
}

export function CustomerPolicyProductField() {
  const { vehicleType, products } = usePolicySelection();
  return <label className="text-[12px] font-bold text-[#1B3150]">Policy Type *
    <select key={vehicleType} required name="type" defaultValue="" className="mt-1.5 block w-full min-h-10 rounded-xl border border-[#D6E0EF] bg-[#FBFDFF] px-3 py-2 text-[12px] text-[#1B3150] outline-none transition focus:border-[#2C70C5] focus:ring-2 focus:ring-[#DDEBFC]">
      <option value="">Select product</option>{products.map(v => <option key={v} value={v}>{v}</option>)}
    </select>
  </label>;
}

// Keep the original combined interface for any other callers.
export function CustomerPolicySelections(props: SelectionProps) {
  return <CustomerPolicySelectionProvider {...props}>
    <CustomerPolicyVehicleField/>
    <CustomerPolicyProductField/>
  </CustomerPolicySelectionProvider>;
}
