"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertCircle, CarFront, ChevronRight, Clock3, PieChart, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";

const manufacturerIcons: Record<string, string> = {
  honda: "honda", suzuki: "suzuki", yamaha: "yamaha", hero: "hero", bajaj: "bajaj",
  tvs: "tvs", tata: "tata", mahindra: "mahindra", hyundai: "hyundai",
  toyota: "toyota", ford: "ford", kia: "kia", bmw: "bmw", audi: "audi",
  volkswagen: "volkswagen", renault: "renault", nissan: "nissan", skoda: "skoda",
  volvo: "volvo", mercedes: "mercedesbenz", isuzu: "isuzu",
};
function ManufacturerMark({ make }: { make: string }) {
  const key = make.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const brand = manufacturerIcons[key];
  const [failed, setFailed] = useState(false);
  if (!brand || failed) return <span aria-label={make || "Unknown manufacturer"} title={make || "Unknown manufacturer"} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#EDF3FA] text-[9px] font-bold text-[#426083]">{make ? make.slice(0, 2).toUpperCase() : "—"}</span>;
  return <img src={`https://cdn.jsdelivr.net/npm/simple-icons@v15/icons/${brand}.svg`} alt={`${make} logo`} title={make} width={24} height={24} loading="lazy" onError={() => setFailed(true)} className="h-6 w-6 shrink-0 object-contain" />;
}

export type VehicleItem = { id: string; number: string; make: string; model: string; type: string; chassis: string; engine: string; policy: string | null };
export function CustomerVehiclesRegister({ accountId, items, initialQuery = "" }: { accountId: string; items: VehicleItem[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [coverage, setCoverage] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const coveredCount = items.filter(v => Boolean(v.policy)).length;
  const uncoveredCount = items.length - coveredCount;
  const coveredPercent = items.length ? Math.round(coveredCount * 100 / items.length) : 0;
  const vehicleTypes = Array.from(new Set(items.map(v => v.type).filter(Boolean))).sort();
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(v => (coverage === "all" || (coverage === "covered" ? Boolean(v.policy) : !v.policy)) && (typeFilter === "all" || v.type === typeFilter) && (!q || [v.number, v.make, v.model, v.chassis, v.engine, v.type, v.policy ?? ""].some(x => x.toLowerCase().includes(q))));
  }, [items, query, coverage, typeFilter]);
  const metrics = [
    { label: "Total vehicles", value: String(items.length), Icon: CarFront, color: "text-[#1266D9]", background: "bg-[#EEF5FF]" },
    { label: "With active policy", value: String(coveredCount), Icon: ShieldCheck, color: "text-[#00975A]", background: "bg-[#EFFAF5]" },
    { label: "Renewal due", value: "—", Icon: Clock3, color: "text-[#D88012]", background: "bg-[#FFF7EB]" },
    { label: "Fleet covered", value: `${coveredPercent}%`, Icon: PieChart, color: "text-[#1266D9]", background: "bg-[#EEF5FF]" },
    { label: "Without active policy", value: String(uncoveredCount), Icon: AlertCircle, color: "text-[#D52C3A]", background: "bg-[#FFF1F2]" },
  ];
  return <div className="space-y-3">
    <section className="relative isolate overflow-hidden rounded-2xl bg-[#061B3B] text-white">
      <div className="absolute inset-y-0 right-0 w-[65%] bg-[url('/customer-insurance-quote-vehicles.svg')] bg-cover bg-center opacity-85" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#06162F] via-[#08254C]/95 via-45% to-transparent" />
      <div className="relative flex min-h-[165px] items-center px-5 py-5 sm:min-h-[200px] sm:px-8">
        <div className="max-w-[55%]">
          <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#81BFFF]">Your fleet</p>
          <h1 className="mt-2 text-[clamp(23px,3vw,38px)] font-black leading-tight">Your <span className="text-[#369BFF]">Vehicles</span></h1>
          <p className="mt-2 max-w-[330px] text-[11px] leading-5 text-[#E0EEFF]">Manage your fleet, review policy coverage and find the right protection for every journey.</p>
        </div>
      </div>
    </section>
    <section aria-label="Fleet summary" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
      {metrics.map(({ label, value, Icon, color, background }) => <div key={label} className={`flex min-h-[84px] items-center gap-3 rounded-xl border border-[#DFE7F1] p-3 ${background}`}>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/75 ${color}`}><Icon className="h-5 w-5"/></span>
        <span className="min-w-0"><strong className="block text-[21px] font-black text-[#10213D]">{value}</strong><span className="block text-[10px] font-semibold text-[#5B6F8B]">{label}</span></span>
      </div>)}
    </section>
    <section className="rounded-2xl border border-[#D8E1EC] bg-white p-3 shadow-[0_8px_25px_rgba(20,40,75,.04)] sm:p-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[19px] font-black text-[#10213D]">Vehicles</h2>
        <Link href={{ pathname: "/customer/insurance-quote", query: { account: accountId } }} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B3671] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#1755A1]">Get insurance quote <ChevronRight className="h-3.5 w-3.5"/></Link>
      </header>
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="flex min-w-[190px] flex-1 items-center gap-2 rounded-lg border border-[#D8E1EC] bg-white px-3 py-2.5 focus-within:border-[#4E95E9]">
          <Search className="h-4 w-4 text-[#73829A]" /><span className="sr-only">Search vehicles</span>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search registration, chassis, make or model..." className="w-full min-w-0 border-0 bg-transparent p-0 text-[11px] outline-none" />
        </label>
        <label className="flex items-center gap-1.5 rounded-lg border border-[#D8E1EC] px-2.5 text-[11px] text-[#415775]"><SlidersHorizontal className="h-3.5 w-3.5"/><span className="sr-only">Coverage filter</span><select aria-label="Coverage filter" value={coverage} onChange={e=>setCoverage(e.target.value)} className="max-w-[145px] bg-transparent py-2 outline-none"><option value="all">All coverage</option><option value="covered">Covered</option><option value="uncovered">No active policy</option></select></label>
        <label className="rounded-lg border border-[#D8E1EC] px-2.5 text-[11px] text-[#415775]"><span className="sr-only">Vehicle type filter</span><select aria-label="Vehicle type filter" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="max-w-[135px] bg-transparent py-2 outline-none"><option value="all">All types</option>{vehicleTypes.map(type=><option key={type} value={type}>{type}</option>)}</select></label>
      </div>
    {rows.length === 0 ? <div className="rounded-xl border bg-white p-8 text-center text-sm">No matching vehicles. Try another search or filter.</div> :
    <div className="overflow-x-auto rounded-xl border border-[#D8E1EC] bg-white">
      <table className="w-full min-w-[840px] border-collapse text-left text-[11px]">
        <thead className="bg-[#F1F5FA] text-[10px] font-extrabold uppercase text-[#687991]"><tr>{["Vehicle no.", "Make / model", "Type", "Chassis no.", "Engine no.", "Active policy", "Cover status", "Details"].map(h => <th key={h} className="border-b px-3 py-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-[#E7EDF5]">{rows.map(v => <tr key={v.id} className="hover:bg-[#F6F9FE]">
          <td className="px-3 py-2.5 font-extrabold text-[#133C73]"><Link href={{ pathname: `/customer/vehicles/${v.id}`, query: { account: accountId } }} className="hover:underline">{v.number}</Link></td>
          <td className="px-3 py-2.5 font-semibold"><span className="flex items-center gap-2"><ManufacturerMark make={v.make}/><span>{v.model || v.make || "—"}</span></span></td>
          <td className="px-3 py-2.5">{v.type || "—"}</td><td className="px-3 py-2.5">{v.chassis || "—"}</td><td className="px-3 py-2.5">{v.engine || "—"}</td>
          <td className="px-3 py-2.5 font-bold">{v.policy || "—"}</td>
          <td className="px-3 py-2.5"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${v.policy ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}>{v.policy ? "Covered" : "No active policy"}</span></td><td className="px-3 py-2.5"><Link aria-label={`View ${v.number} details`} href={{ pathname: `/customer/vehicles/${v.id}`, query: { account: accountId } }} className="inline-flex rounded-md p-1.5 text-[#1B5794] hover:bg-[#EDF5FF]"><ChevronRight className="h-4 w-4"/></Link></td>
        </tr>)}</tbody>
      </table>
    </div>}
    <p className="mt-3 text-[10px] font-medium text-[#6A7B93]">Showing {rows.length} of {items.length} vehicles</p>
    </section>
  </div>;
}
