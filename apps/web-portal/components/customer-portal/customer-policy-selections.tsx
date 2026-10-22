"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { CustomerVehicleRow } from "@/lib/customer-web-data";

type SelectionProps = {
  vehicles: CustomerVehicleRow[];
  blocked: string[];
  initial?: string;
  accountId: string;
};
type SelectionContext = {
  vehicles: CustomerVehicleRow[];
  blocked: string[];
  selected: string;
  setSelected: (value: string) => void;
  products: string[];
};
const PolicySelectionContext = createContext<SelectionContext | null>(null);
const fieldClass = "mt-1.5 block min-h-10 w-full rounded-xl border border-[#D6E0EF] bg-white px-3 py-2 text-[12px] text-[#1B3150] outline-none focus:border-[#2C70C5] focus:ring-2 focus:ring-[#DDEBFC]";

export function CustomerPolicySelectionProvider({
  vehicles, blocked, initial, children,
}: Omit<SelectionProps, "accountId"> & { children: ReactNode }) {
  const [selected, setSelected] = useState(
    initial && vehicles.some(v => v.id === initial && !blocked.includes(v.id)) ? initial : "",
  );
  const vehicle = useMemo(() => vehicles.find(v => v.id === selected), [vehicles, selected]);
  const products = vehicle?.vehicle_type === "PCP" || vehicle?.vehicle_type === "TWP"
    ? ["Package", "Third Party", "SAOD", "Bundled", "Long Term Package", "Long Term Third Party"]
    : ["Package", "Third Party", "SAOD"];
  return <PolicySelectionContext.Provider value={{ vehicles, blocked, selected, setSelected, products }}>
    {children}
  </PolicySelectionContext.Provider>;
}

function usePolicySelection() {
  const context = useContext(PolicySelectionContext);
  if (!context) throw new Error("Policy selection fields require their provider.");
  return context;
}

export function CustomerPolicyVehicleField({ accountId, showAddLink = false }: { accountId: string; showAddLink?: boolean }) {
  const { vehicles, blocked, selected, setSelected } = usePolicySelection();
  return <>
    {showAddLink ? <Link href={{ pathname: "/customer/add-vehicle", query: { account: accountId } }} className="text-xs font-bold text-[#1769DC] hover:underline">+ Add Vehicle</Link> : null}
    <label className="block text-[12px] font-bold text-[#1B3150]">Vehicle number *
      <select name="vehicle" value={selected} onChange={e => setSelected(e.target.value)} required className={fieldClass}>
        <option value="">Select vehicle</option>
        {vehicles.map(v => <option key={v.id} value={v.id} disabled={blocked.includes(v.id)}>
          {v.vehicle_no} · {[v.make, v.model].filter(Boolean).join(" ")}{blocked.includes(v.id) ? " · Active policy exists" : ""}
        </option>)}
      </select>
    </label>
    {vehicles.length > 0 && blocked.length === vehicles.length
      ? <p role="status" className="rounded-lg border border-[#F2D7DA] bg-[#FFF7F8] p-3 text-xs text-[#A43B49]">Every linked vehicle already has an active policy. You cannot add a duplicate active policy.</p>
      : null}
  </>;
}

export function CustomerPolicyProductField() {
  const { selected, products } = usePolicySelection();
  return <label className="block text-[12px] font-bold text-[#1B3150]">Policy type *
    <select key={selected} name="type" required defaultValue="" className={fieldClass}>
      <option value="">Select product</option>
      {products.map(value => <option key={value} value={value}>{value}</option>)}
    </select>
  </label>;
}

// Retain the previous combined API for other consumers.
export function CustomerPolicySelections(props: SelectionProps) {
  return <CustomerPolicySelectionProvider {...props}>
    <CustomerPolicyVehicleField accountId={props.accountId} showAddLink/>
    <CustomerPolicyProductField/>
  </CustomerPolicySelectionProvider>;
}
