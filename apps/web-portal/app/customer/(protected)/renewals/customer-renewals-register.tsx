"use client";
import "../customer-register-motion.css";
import Link from "next/link";
import motion from "./renewals-motion.module.css";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, FileText, Search, ShieldCheck, CarFront, ArrowRight, Clock3 } from "lucide-react";

export type RenewalRegisterItem = {
  id: string; title: string; key: string; vehicleId: string; vehicleNo: string;
  reference: string; expiry: string; daysUntil: number; status: string;
};
export type RenewalCategory = { key: string; title: string; count: number };

function CategoryIcon({ title }: { title: string }) {
  if (/insurance/i.test(title)) return <ShieldCheck className="h-4 w-4"/>;
  if (/fitness/i.test(title)) return <CarFront className="h-4 w-4"/>;
  return <FileText className="h-4 w-4"/>;
}

export function CustomerRenewalsRegister({accountId,items,categories}:{
  accountId:string;items:RenewalRegisterItem[];categories:RenewalCategory[];
}) {
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("all");
  const [sort,setSort]=useState<"nearest"|"latest">("nearest");
  const [activeCategory,setActiveCategory]=useState<string | null>(null);
  const groups=useMemo(()=>{
    const filtered=items.filter(item=>{
      const matches=[item.vehicleNo,item.title,item.reference,item.expiry,item.status].some(v=>v.toLowerCase().includes(query.trim().toLowerCase()));
      return matches && (status==="all" || (status==="expired"?item.daysUntil<0:status==="due"?item.daysUntil>=0&&item.daysUntil<=45:item.daysUntil>45));
    });
    const known=new Set(categories.map(cat=>cat.key));
    const groupList=[...categories,...(filtered.some(item=>!known.has(item.key))?[{key:"__other__",title:"Other renewals",count:0}]:[])];
    return {filtered,groupList:groupList.map(cat=>({
      ...cat,records:filtered.filter(item=>cat.key==="__other__"?!known.has(item.key):item.key===cat.key)
        .sort((a,b)=>sort==="nearest"?a.daysUntil-b.daysUntil:b.daysUntil-a.daysUntil)
    }))};
  },[items,categories,query,status,sort]);
  const selectedGroup = groups.groupList.find(cat=>cat.key===activeCategory);
  return <div className={`customer-register-motion space-y-4 text-[#293461] ${motion.pageEnter}`}>
    <section className="customer-register-hero relative isolate min-h-[175px] overflow-hidden rounded-xl border border-[#E1E8F9] bg-[#EDF4FF]">
      <div aria-hidden="true" className={`pointer-events-none absolute -inset-2 bg-[url('/assets/renewal.jpeg')] bg-cover bg-center ${motion.heroParallax}`}/>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#F0F5FF]/95 via-[#F0F5FF]/75 via-40% to-transparent"/>
      <div className="relative z-10 flex min-h-[175px] items-center px-5 py-5 sm:px-7">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/75 text-[#5948F0]"><CalendarDays className="h-6 w-6"/></span>
          <div><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#7364D3]">Renewals</p>
            <h1 className="mt-1 text-[24px] font-extrabold leading-tight tracking-tight text-[#212D67]">Your Policy Renewals</h1>
            <p className="mt-2 text-[11px] font-medium leading-5 text-[#657698]">Stay protected and keep your vehicles covered.<br/>Renew on time, drive with confidence.</p>
          </div>
        </div>
      </div>
    </section>
    <div className={`customer-register-panel grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px_180px] ${motion.controls}`}>
      <label className="customer-register-control flex h-10 min-w-0 items-center gap-2 rounded-lg border border-[#E0E7F4] bg-white px-3 text-[#8090B0]"><Search className="h-4 w-4 shrink-0"/><input aria-label="Search renewals" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by reference number, vehicle number or policy..." className="min-w-0 flex-1 border-0 bg-transparent text-[11px] text-[#253760] outline-none placeholder:text-[#9BA9C0]"/></label>
      <select aria-label="Filter by status" value={status} onChange={e=>setStatus(e.target.value)} className={`customer-register-control h-10 rounded-lg border border-[#E0E7F4] bg-white px-3 text-[11px] font-semibold text-[#53648C] ${motion.filterControl}`}>
        <option value="all">All Status</option><option value="due">Due</option><option value="expired">Expired</option><option value="upcoming">Upcoming</option>
      </select>
      <label className="customer-register-control flex h-10 items-center gap-2 rounded-lg border border-[#E0E7F4] bg-white px-3 text-[11px] text-[#8B98AE]">Sort by
        <select aria-label="Sort renewals" value={sort} onChange={e=>setSort(e.target.value as "nearest"|"latest")} className={`min-w-0 flex-1 border-0 bg-transparent font-bold text-[#4F5E87] outline-none ${motion.filterControl}`}><option value="nearest">Nearest Expiry</option><option value="latest">Latest Expiry</option></select>
      </label>
    </div>
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-2" role="group" aria-label="Renewal categories">
        {groups.groupList.slice(0, 6).map(cat => {
          const selected = activeCategory === cat.key;
          return <button key={cat.key} type="button" aria-pressed={selected} aria-expanded={selected} onClick={() => setActiveCategory(selected ? null : cat.key)}
            className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-1.5 py-3 text-center transition hover:bg-[#F7F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6050E5] ${selected ? "border-[#6050E5] bg-[#F1F0FF] shadow-sm" : "border-[#E2E9F5] bg-white"}`}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#ECEEFF] text-[#6050E5]"><CategoryIcon title={cat.title}/></span>
            <strong className="w-full truncate text-[10px] font-semibold text-[#28346A]" title={cat.title}>{cat.title}</strong>
            <span className="text-[10px] text-[#7265D9]">{cat.records.length} Renewal{cat.records.length === 1 ? "" : "s"}</span>
          </button>;
        })}
      </div>
      {selectedGroup ? (() => {
        const cat = selectedGroup;
        return <section className={`customer-register-card overflow-hidden rounded-xl border border-[#E2E9F5] bg-white shadow-[0_3px_12px_rgba(43,65,120,.035)] ${motion.section}`}>
          <div className="flex items-center justify-between border-b border-[#ECF0F8] px-4 py-3">
            <h2 className="text-[13px] font-bold text-[#28346A]">{cat.title} Records</h2>
            <button type="button" onClick={() => setActiveCategory(null)} aria-label="Close renewal records" className="rounded-md px-2 py-1 text-[11px] text-[#53648C] hover:bg-[#F3F5FC]">Close</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed border-collapse">
              <thead className="bg-[#F8FAFE] text-left text-[10px] font-semibold text-[#93A1BB]"><tr>
                <th className="w-[30%] px-5 py-2.5">Policy / Ref. No.</th><th className="w-[31%] px-4 py-2.5">Vehicle No. / Policy Type</th><th className="w-[24%] px-4 py-2.5">Expiry Date</th><th className="w-[10%] px-3 py-2.5">Status</th><th className="w-[5%] px-2 py-2.5"/>
              </tr></thead>
              <tbody className="divide-y divide-[#E8EDF6]">
                {cat.records.map((item,index)=>{
                  const expired=item.daysUntil<0;const due=item.daysUntil<=45&&!expired;
                  const href=item.key==="insurance_policy"&&item.reference?{pathname:"/customer/policies",query:{account:accountId,q:item.reference}}:{pathname:`/customer/vehicles/${item.vehicleId}`,query:{account:accountId}};
                  return <tr key={item.id} style={{animationDelay:`${Math.min(index,8)*45}ms`}} className={`customer-register-row text-[11px] ${motion.renewalRow}`}>
                    <td className="px-4 py-3"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EFF0FF] text-[#6255E9]"><FileText className="h-4 w-4"/></span><div className="min-w-0"><Link href={href} className="block truncate font-bold text-[#3B568D] hover:underline">{item.vehicleNo}</Link><p className="truncate text-[9.5px] text-[#8C99B2]">{item.title}{item.reference?` · Ref: ${item.reference}`:""}</p></div></div></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><CarFront className="h-4 w-4 shrink-0 text-[#5979AF]"/><div><b className="text-[10.5px] text-[#3C578A]">{item.vehicleNo}</b><p className="text-[9.5px] text-[#8B99B2]">Policy Type: {cat.title}</p></div></div></td>
                    <td className="px-4 py-3"><div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#6159ED]"/><div><b className="text-[10.5px] text-[#455B85]">{item.expiry}</b><p className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${!expired?motion.upcomingBadge:""} ${expired?"bg-[#FFF0F2] text-[#D34358]":due?"bg-[#FFF5E3] text-[#C98E29]":"bg-[#EAF9F0] text-[#239B68]"}`}><Clock3 className="h-3 w-3"/>{expired?"Expired":due?`Due in ${item.daysUntil} days`:`In ${item.daysUntil} days`}</p></div></div></td>
                    <td className="px-3 py-3 text-[10px] text-[#8190A9]">{item.status||"—"}</td>
                    <td className="px-2 py-3"><Link href={href} aria-label={`View renewal for ${item.vehicleNo}`} className={`customer-register-action inline-flex p-1 text-[#5B6D9A] ${motion.rowArrow}`}><ArrowRight className="h-4 w-4"/></Link></td>
                  </tr>;
                })}
                {!cat.records.length?<tr><td colSpan={5} className="p-4 text-center text-[11px] text-[#8492AC]">No renewals in this category.</td></tr>:null}
              </tbody>
            </table>
          </div>
        </section>;
      })() : null}
      {!groups.filtered.length?<p className="rounded-xl border border-[#E2E9F5] bg-white px-4 py-8 text-center text-[12px] text-[#7889A6]">No renewal records match your search or filters.</p>:null}
    </div>
  </div>;
}
