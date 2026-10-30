"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MapPin, Search, Tag, Truck } from "lucide-react";
import { CustomerAnimatedSearchInput } from "./customer-animated-search-input";

type SellVehicle = {
  vehicle_id: string;
  vehicle_no: string | null;
  make: string | null;
  model: string | null;
  vehicle_type: string | null;
  city: string | null;
  state: string | null;
  has_active_listing: boolean;
};

export function CustomerExchangeSellWorkspace({ vehicles, accountId }: { vehicles: SellVehicle[]; accountId: string }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const vehicleTypes = useMemo(() => [...new Set(vehicles.map(v => v.vehicle_type).filter((v): v is string => Boolean(v)))].sort(), [vehicles]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return vehicles.filter(v => {
      const text = [v.vehicle_no, v.make, v.model, v.vehicle_type].filter(Boolean).join(" ").toLowerCase();
      return (!normalized || text.includes(normalized)) && (type === "all" || v.vehicle_type === type);
    });
  }, [vehicles, query, type]);

  return (
    <section className="exchange-sell-v2 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="exchange-sell-search flex min-w-[190px] flex-[3] items-center gap-2 rounded-lg bg-white px-3 py-2">
          <Search className="h-4 w-4 text-[#7186A5]" />
          <CustomerAnimatedSearchInput value={query} onChange={e => setQuery(e.target.value)} hints={["Search vehicle number…", "Search make or model…", "Search vehicle type…"]} aria-label="Search fleet vehicles" className="text-[11px] text-[#183A66]"/>
        </label>
        <select value={type} onChange={e => setType(e.target.value)} aria-label="Vehicle type" className="ml-auto min-h-9 rounded-lg border border-[#DCE5F1] bg-white px-3 text-[11px]">
          <option value="all">All Types</option>{vehicleTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? <div className="rounded-xl border border-[#DFE7F3] bg-white p-10 text-center text-sm text-[#6D809B]">No vehicles match your search and filters.</div> : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map(vehicle => {
            const name = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.vehicle_type || "Commercial vehicle";
            const location = [vehicle.city, vehicle.state].filter(Boolean).join(", ") || "Location on request";
            return <article key={vehicle.vehicle_id} className="flex min-w-0 flex-col rounded-xl border border-[#DDE7F2] bg-white p-2 shadow-[0_4px_16px_rgba(25,66,119,.06)]">
              <div className="relative flex h-[88px] items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#EAF3FD] to-[#D3E4F5]">
                <Truck className="h-10 w-10 text-[#6593C2]" aria-label="Vehicle artwork placeholder" />
                <span className="absolute bottom-1 left-2 text-[8px] font-medium text-[#637F9D]">Vehicle photo unavailable</span>
                <span className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold ${vehicle.has_active_listing ? "bg-[#FFF0D9] text-[#98641E]" : "bg-[#E2F8EB] text-[#167B51]"}`}><CheckCircle2 className="h-3 w-3" />{vehicle.has_active_listing ? "Already listed" : "Ready to list"}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col px-1 pb-1 pt-2">
                <h3 title={name} className="min-h-[16px] truncate text-[11px] font-extrabold leading-4 text-[#19325C]">{name}</h3>
                <p className="mt-1 text-[11px] font-semibold text-[#3A72B5]">{vehicle.vehicle_no || "Registration unavailable"}</p>
                <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[9px] text-[#6F829D]">
                  <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{location}</span>
                  <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{vehicle.vehicle_type || "Vehicle"}</span>
                </div>
                {vehicle.has_active_listing ? <Link href={{ pathname: "/customer/exchange", query: { account: accountId, tab: "activity" } }} className="mt-2 flex min-h-8 items-center justify-center gap-2 rounded-lg bg-[#173F77] px-3 text-[11px] font-bold text-white">View My Listings <ArrowRight className="h-3.5 w-3.5" /></Link>
                  : <button type="button" disabled title="Listing creation is not yet available in the Customer web portal" className="mt-2 flex min-h-8 cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-[#173F77] px-3 text-[11px] font-bold text-white opacity-70">Start Selling <ArrowRight className="h-3.5 w-3.5" /><span className="sr-only">Listing creation is not yet available on the web portal.</span></button>}
              </div>
            </article>;
          })}
        </div>
      )}
    </section>
  );
}
