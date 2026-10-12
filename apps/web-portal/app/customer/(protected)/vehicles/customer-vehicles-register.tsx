"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Search, SlidersHorizontal } from "lucide-react";

const manufacturerIcons: Record<string, string> = {
  honda: "honda", suzuki: "suzuki", yamaha: "yamaha", hero: "hero", bajaj: "bajaj",
  tata: "tata", mahindra: "mahindra", hyundai: "hyundai",
  toyota: "toyota", ford: "ford", kia: "kia", bmw: "bmw", audi: "audi",
  volkswagen: "volkswagen", renault: "renault", nissan: "nissan", skoda: "skoda",
  volvo: "volvo", mercedes: "mercedesbenz", isuzu: "isuzu",
};
export function ManufacturerMark({ make }: { make: string }) {
  const key = make.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const brand = manufacturerIcons[key];
  const [failed, setFailed] = useState(false);
  // The Simple Icons v15 CDN does not provide a reliable TVS asset.
  // Use a clear local TVS wordmark rather than silently falling back to initials.
  if (key === "tvs" || key === "tvsmotorcompany") return <span role="img" aria-label="TVS Motor" title="TVS Motor" className="inline-flex h-6 w-9 shrink-0 items-center justify-center rounded bg-white text-[13px] font-black italic tracking-[-.08em] text-[#D92131]">TVS</span>;
  if (!brand || failed) return <span aria-label={make || "Unknown manufacturer"} title={make || "Unknown manufacturer"} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#EDF3FA] text-[9px] font-bold text-[#426083]">{make ? make.slice(0, 2).toUpperCase() : "—"}</span>;
  return <img src={`https://cdn.jsdelivr.net/npm/simple-icons@v15/icons/${brand}.svg`} alt={`${make} logo`} title={make} width={24} height={24} loading="lazy" onError={() => setFailed(true)} className={`h-6 w-6 shrink-0 object-contain ${key === "suzuki" ? "brightness-0 saturate-100 [filter:invert(17%)_sepia(99%)_saturate(2195%)_hue-rotate(199deg)_brightness(91%)_contrast(96%)]" : ""}`} />;
}

export type VehicleItem = { id: string; number: string; make: string; model: string; type: string; chassis: string; engine: string; policy: string | null };
export function CustomerVehiclesRegister({ accountId, items, initialQuery = "" }: { accountId: string; items: VehicleItem[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [coverage, setCoverage] = useState("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(v => (coverage === "all" || (coverage === "covered" ? Boolean(v.policy) : !v.policy)) && (!q || [v.number, v.make, v.model, v.chassis, v.engine, v.type, v.policy ?? ""].some(x => x.toLowerCase().includes(q))));
  }, [items, query, coverage]);
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
    <section className="rounded-2xl border border-[#D8E1EC] bg-white p-3 shadow-[0_8px_25px_rgba(20,40,75,.04)] sm:p-4">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="shrink-0 text-[19px] font-black text-[#10213D]">Vehicle Register</h2>
        <label className="flex min-w-[190px] max-w-[370px] flex-1 items-center gap-2 rounded-lg border border-[#D8E1EC] bg-white px-3 py-2.5 focus-within:border-[#4E95E9]">
          <Search className="h-4 w-4 shrink-0 text-[#73829A]" /><span className="sr-only">Search vehicles</span>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search vehicles..." className="w-full min-w-0 border-0 bg-transparent p-0 text-[11px] outline-none" />
        </label>
        <label className="ml-auto flex items-center gap-1.5 rounded-lg border border-[#D8E1EC] px-2.5 text-[11px] text-[#415775]"><SlidersHorizontal className="h-3.5 w-3.5"/><span className="sr-only">Vehicle status filter</span><select aria-label="Vehicle status filter" value={coverage} onChange={e=>setCoverage(e.target.value)} className="max-w-[150px] bg-transparent py-2 outline-none"><option value="all">All Status</option><option value="covered">Covered</option><option value="uncovered">No active policy</option></select></label>
      </header>
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
