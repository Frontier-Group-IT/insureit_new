"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Grid2X2, List, MapPin, Search, Tag, Truck } from "lucide-react";

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
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("default");
  const [view, setView] = useState<"grid" | "list">("grid");
  const vehicleTypes = useMemo(() => [...new Set(vehicles.map(v => v.vehicle_type).filter((v): v is string => Boolean(v)))].sort(), [vehicles]);
  const active = vehicles.filter(v => v.has_active_listing).length;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = vehicles.filter(v => {
      const text = [v.vehicle_no, v.make, v.model, v.vehicle_type].filter(Boolean).join(" ").toLowerCase();
      return (!normalized || text.includes(normalized)) && (type === "all" || v.vehicle_type === type) &&
        (status === "all" || (status === "listed" ? v.has_active_listing : !v.has_active_listing));
    });
    if (sort === "name") return [...list].sort((a, b) => [a.make, a.model].join(" ").localeCompare([b.make, b.model].join(" ")));
    if (sort === "registration") return [...list].sort((a, b) => (a.vehicle_no || "").localeCompare(b.vehicle_no || ""));
    return list;
  }, [vehicles, query, type, status, sort]);

  return (
    <section className="exchange-sell-v2 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Total Fleet Vehicles", detail: "Vehicles in your account", value: vehicles.length, icon: <Truck /> },
          { label: "Ready to Sell", detail: "Eligible for listing", value: vehicles.length - active, icon: <CheckCircle2 /> },
          { label: "Active Listings", detail: "Already listed on Exchange", value: active, icon: <Tag /> },
        ].map(item => <div key={item.label} className="flex items-center gap-4 rounded-xl border border-[#E0E8F3] bg-white p-4 shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#E7F1FD] text-[#2372C6]">{item.icon}</span>
          <div><div className="text-[23px] font-black text-[#102C55]">{item.value.toLocaleString("en-IN")}</div><div className="text-[11px] font-extrabold text-[#19375D]">{item.label}</div><div className="text-[10px] text-[#7385A0]">{item.detail}</div></div>
        </div>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[190px] flex-[3] items-center gap-2 rounded-lg border border-[#DCE5F1] bg-white px-3 py-2">
          <Search className="h-4 w-4 text-[#7186A5]" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search vehicle number, make, model or type..." aria-label="Search fleet vehicles" className="w-full bg-transparent text-[11px] outline-none" />
        </label>
        <select value={type} onChange={e => setType(e.target.value)} aria-label="Vehicle type" className="min-h-9 rounded-lg border border-[#DCE5F1] bg-white px-3 text-[11px]">
          <option value="all">All Types</option>{vehicleTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Listing status" className="min-h-9 rounded-lg border border-[#DCE5F1] bg-white px-3 text-[11px]">
          <option value="all">All Status</option><option value="ready">Ready to list</option><option value="listed">Already listed</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort vehicles" className="min-h-9 rounded-lg border border-[#DCE5F1] bg-white px-3 text-[11px]">
          <option value="default">Fleet order</option><option value="name">Name A–Z</option><option value="registration">Registration A–Z</option>
        </select>
        <div className="ml-auto flex gap-1 rounded-lg border border-[#DCE5F1] bg-white p-1">
          <button aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")} className={`rounded-md p-2 ${view === "grid" ? "bg-[#17447F] text-white" : "text-[#657B99]"}`}><Grid2X2 className="h-4 w-4" /></button>
          <button aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")} className={`rounded-md p-2 ${view === "list" ? "bg-[#17447F] text-white" : "text-[#657B99]"}`}><List className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div><h2 className="text-[17px] font-black text-[#122A50]">Your Vehicles</h2><p className="text-[11px] text-[#7485A0]">Select an eligible vehicle to start your Exchange listing.</p></div>
        <span className="shrink-0 text-[11px] font-bold text-[#2768C1]">{filtered.length} vehicles</span>
      </div>
      {filtered.length === 0 ? <div className="rounded-xl border border-[#DFE7F3] bg-white p-10 text-center text-sm text-[#6D809B]">No vehicles match your search and filters.</div> : (
        <div className={view === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" : "grid grid-cols-1 gap-3"}>
          {filtered.map(vehicle => {
            const name = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.vehicle_type || "Commercial vehicle";
            const location = [vehicle.city, vehicle.state].filter(Boolean).join(", ") || "Location on request";
            return <article key={vehicle.vehicle_id} className={`flex min-w-0 flex-col rounded-xl border border-[#DDE7F2] bg-white p-2 shadow-[0_4px_16px_rgba(25,66,119,.06)] ${view === "list" ? "sm:flex-row sm:items-center sm:gap-4" : ""}`}>
              <div className={`relative flex h-[120px] items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#EAF3FD] to-[#D3E4F5] ${view === "list" ? "sm:w-[200px] sm:shrink-0" : ""}`}>
                <Truck className="h-14 w-14 text-[#6593C2]" aria-label="Vehicle artwork placeholder" />
                <span className="absolute bottom-1 left-2 text-[8px] font-medium text-[#637F9D]">Vehicle photo unavailable</span>
                <span className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold ${vehicle.has_active_listing ? "bg-[#FFF0D9] text-[#98641E]" : "bg-[#E2F8EB] text-[#167B51]"}`}><CheckCircle2 className="h-3 w-3" />{vehicle.has_active_listing ? "Already listed" : "Ready to list"}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col px-1 pb-1 pt-2">
                <h3 title={name} className="min-h-[32px] text-[11px] font-extrabold leading-4 text-[#19325C]">{name}</h3>
                <p className="mt-1 text-[11px] font-semibold text-[#3A72B5]">{vehicle.vehicle_no || "Registration unavailable"}</p>
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-[9px] text-[#6F829D]">
                  <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{location}</span>
                  <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{vehicle.vehicle_type || "Vehicle"}</span>
                </div>
                {vehicle.has_active_listing ? <Link href={{ pathname: "/customer/exchange", query: { account: accountId, tab: "activity" } }} className="mt-3 flex min-h-9 items-center justify-center gap-2 rounded-lg bg-[#173F77] px-3 text-[11px] font-bold text-white">View My Listings <ArrowRight className="h-3.5 w-3.5" /></Link>
                  : <button type="button" disabled title="Listing creation is not yet available in the Customer web portal" className="mt-3 flex min-h-9 cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-[#173F77] px-3 text-[11px] font-bold text-white opacity-70">Start Selling <ArrowRight className="h-3.5 w-3.5" /><span className="sr-only">Listing creation is not yet available on the web portal.</span></button>}
              </div>
            </article>;
          })}
        </div>
      )}
      <p className="text-[10px] text-[#70839D]">New listing creation is not available on this web page yet. Existing listings can be reviewed under Activity. No vehicle data has been changed.</p>
    </section>
  );
}
