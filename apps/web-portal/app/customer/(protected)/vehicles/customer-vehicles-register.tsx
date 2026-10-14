"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, CarFront, ShieldCheck, ShieldX, ArrowRight, ChevronLeft, ChevronRight, ArrowDownUp } from "lucide-react";

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

export type VehicleItem = { id: string; number: string; make: string; model: string; type: string; chassis: string; engine: string; policy: string | null; status: "due" | "active" | "inactive" | "expired" };
export function CustomerVehiclesRegister({ accountId, items, initialQuery = "" }: { accountId: string; items: VehicleItem[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("number");
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const insuredCount = items.filter(v => v.status === "active" || v.status === "due").length;
  const uninsuredCount = items.length - insuredCount;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter(v => (statusFilter === "all" || (statusFilter === "insured" ? v.status === "active" || v.status === "due" : statusFilter === "uninsured" ? v.status === "inactive" || v.status === "expired" : v.status === statusFilter)) && (!q || [v.number, v.make, v.model, v.chassis, v.engine, v.type, v.policy ?? ""].some(x => x.toLowerCase().includes(q))));
    return filtered.sort((a,b) => sortBy === "make" ? (a.make + a.model).localeCompare(b.make + b.model) : sortBy === "status" ? a.status.localeCompare(b.status) : a.number.localeCompare(b.number));
  }, [items, query, statusFilter, sortBy]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const detailHref = (id: string) => ({ pathname: `/customer/vehicles/${id}`, query: { account: accountId } });
  return <div className="space-y-3">
    <section className="relative isolate overflow-hidden rounded-2xl border border-[#D6E7FA] bg-[#DDEEFF] text-[#102B54] shadow-[0_6px_24px_rgba(20,58,100,.05)]">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[66%] bg-[url('/customer-insurance-quote-vehicles.svg')] bg-contain bg-right-bottom bg-no-repeat opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#EEF7FF] via-[#EEF7FF]/94 via-45% to-transparent" />
      <div className="relative flex min-h-[175px] items-center px-5 py-6 sm:px-7">
        <div className="max-w-[500px]">
          <h1 className="text-[clamp(28px,3.2vw,40px)] font-bold tracking-tight">My <span className="text-[#1769DC]">Vehicles</span></h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#4B6C94]">Manage your insured and uninsured vehicles in one place.</p>
        </div>
      </div>
    </section>
    <section aria-label="Vehicle overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        {title:"Total vehicles",value:items.length,description:"In your register",icon:CarFront,tint:"bg-[#EAF3FF] text-[#1769DC]",filter:"all"},
        {title:"Insured",value:insuredCount,description:"With active cover",icon:ShieldCheck,tint:"bg-[#E5F7EE] text-[#087A57]",filter:"insured"},
        {title:"Uninsured",value:uninsuredCount,description:"Need protection",icon:ShieldX,tint:"bg-[#FFF0F1] text-[#C2414D]",filter:"uninsured"},
        {title:"Coverage",value:items.length ? `${Math.round((insuredCount/items.length)*100)}%` : "0%",description:"Vehicles protected",icon:ShieldCheck,tint:"bg-[#EAF3FF] text-[#1769DC]",filter:"insured"},
      ].map(({title,value,description,icon:Icon,tint,filter})=><button type="button" key={title} onClick={()=>{setStatusFilter(filter);setPage(1);}} className={`flex items-center gap-3 rounded-2xl border bg-white p-4 text-left transition hover:border-[#AFCDF7] ${statusFilter===filter?"border-[#9EC3F7]":"border-[#E1EAF5]"}`}>
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tint}`}><Icon className="h-6 w-6"/></span>
        <span className="min-w-0 flex-1"><strong className="block text-[12px] font-medium text-[#60799B]">{title}</strong><span className="block text-[28px] font-bold leading-tight text-[#102449]">{value}</span><small className="block text-[12px] text-[#7890AD]">{description}</small></span>
        <span className="grid h-7 w-7 place-items-center rounded-full border border-[#E1EAF5] text-[#176CE7]"><ChevronRight className="h-4 w-4"/></span>
      </button>)}
    </section>
    <section className="rounded-2xl border border-[#DFE9F5] bg-white p-3 shadow-sm sm:p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 text-[17px] font-bold text-[#102B54]"><CarFront className="h-6 w-6 text-[#176CE7]"/>Vehicle Register</h2>
        <label className="flex w-full items-center gap-2 rounded-lg border border-[#DCE7F5] bg-[#FAFCFF] px-3 py-2 focus-within:border-[#4E95E9] sm:ml-auto sm:w-[320px] lg:w-[370px]">
          <Search className="h-4 w-4 shrink-0 text-[#7D95B7]"/><span className="sr-only">Search vehicles</span>
          <input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Search by vehicle number, make, model or chassis..." className="w-full min-w-0 bg-transparent text-[13px] outline-none"/>
        </label>
        <select aria-label="Vehicle status filter" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1);}} className="rounded-lg border border-[#DCE7F5] bg-white px-3 py-2 text-[13px] text-[#263F67]"><option value="all">All Status</option><option value="insured">Insured</option><option value="uninsured">Uninsured</option><option value="due">Due</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="expired">Expired</option></select>
        <label className="flex items-center gap-1 rounded-lg border border-[#DCE7F5] px-2 text-[#41618D]"><ArrowDownUp className="h-3.5 w-3.5"/><select aria-label="Sort vehicles by" value={sortBy} onChange={e=>{setSortBy(e.target.value);setPage(1);}} className="bg-white py-2 text-[13px] outline-none"><option value="number">Sort by number</option><option value="make">Sort by make</option><option value="status">Sort by status</option></select></label>
      </header>
      <div className="space-y-2">
        {visibleRows.length===0?<div className="rounded-xl border border-[#E2EAF5] p-8 text-center text-sm text-[#637B9B]">No matching vehicles. Try another search or filter.</div>:visibleRows.map(v=>{
          const insured=v.status==="active"||v.status==="due";
          return <div key={v.id} className="flex flex-col gap-3 rounded-xl border border-[#E2EAF5] bg-white p-3 transition hover:border-[#B7D0F5] hover:bg-[#FCFDFF] lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-3 lg:w-[31%]">
              <div className="grid h-[62px] w-[70px] shrink-0 place-items-center rounded-xl bg-[#EEF5FF] text-[#2B77D6]"><CarFront className="h-8 w-8"/></div>
              <div className="min-w-0 flex-1"><span className="block text-[11px] font-semibold uppercase text-[#8196B3]">Vehicle no.</span><Link href={detailHref(v.id)} className="block truncate text-[14px] font-bold text-[#15376B] hover:text-[#176CE7]">{v.number}</Link><span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${insured?"bg-[#E4FAEF] text-[#079968]":"bg-[#FFF0F1] text-[#E53454]"}`}>{insured?<ShieldCheck className="h-3 w-3"/>:<ShieldX className="h-3 w-3"/>}{insured?"Insured":"Not insured"}</span></div>
            </div>
            <div className="flex min-w-0 items-center gap-2 lg:w-[19%] lg:border-l lg:border-[#E7EEF8] lg:pl-3"><ManufacturerMark make={v.make}/><div className="min-w-0"><span className="block text-[11px] uppercase text-[#8196B3]">Make / model</span><strong className="block text-[13px] text-[#142C56]">{v.make||"—"}</strong><span className="block break-words text-[12px] text-[#607CA4]">{v.model||"—"}</span></div></div>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 text-[12px] sm:grid-cols-4 lg:border-l lg:border-[#E7EEF8] lg:pl-3">
              {[["Type",v.type],["Chassis no.",v.chassis],["Engine no.",v.engine],["Active policy",v.policy]].map(([label,value])=><div key={label} className="min-w-0"><span className="block text-[11px] uppercase text-[#8196B3]">{label}</span><span className="block break-all font-semibold text-[#264572]">{value||"—"}</span></div>)}
            </div>
            <Link href={detailHref(v.id)} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#EAF3FF] px-3 py-2 text-[12px] font-semibold text-[#1769DC] hover:bg-[#DCEBFF]">View details <ArrowRight className="h-3.5 w-3.5"/></Link>
          </div>;
        })}
      </div>
      <footer className="mt-3 flex items-center justify-between gap-2"><p className="text-[10px] text-[#7790B0]">Showing {rows.length===0?0:(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize,rows.length)} of {rows.length} vehicles</p><div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={currentPage===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="grid h-7 w-7 place-items-center rounded-full border border-[#DCE7F5] text-[#176CE7] disabled:opacity-35"><ChevronLeft className="h-4 w-4"/></button><span className="grid h-7 min-w-7 place-items-center rounded-full bg-[#176CE7] px-1 text-[11px] font-bold text-white">{currentPage} / {pageCount}</span><button type="button" aria-label="Next page" disabled={currentPage===pageCount} onClick={()=>setPage(p=>Math.min(pageCount,p+1))} className="grid h-7 w-7 place-items-center rounded-full border border-[#DCE7F5] text-[#176CE7] disabled:opacity-35"><ChevronRight className="h-4 w-4"/></button></div></footer>
    </section>
  </div>;
}
