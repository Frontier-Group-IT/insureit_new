"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarClock, FileText, Search, ShieldCheck, CarFront, Clock3, AlertTriangle, ArrowRight, CalendarDays } from "lucide-react";

export type RenewalRegisterItem = {
  id: string; title: string; key: string; vehicleId: string; vehicleNo: string;
  reference: string; expiry: string; daysUntil: number; status: string;
};
export type RenewalCategory = { key: string; title: string; count: number };

function CategoryIcon({ title }: { title: string }) {
  if (/insurance/i.test(title)) return <ShieldCheck className="h-4 w-4" aria-hidden="true" />;
  if (/fitness/i.test(title)) return <CarFront className="h-4 w-4" aria-hidden="true" />;
  if (/tax|permit|puc/i.test(title)) return <FileText className="h-4 w-4" aria-hidden="true" />;
  return <CalendarClock className="h-4 w-4" aria-hidden="true" />;
}

export function CustomerRenewalsRegister({ accountId, items, categories }: {
  accountId: string; items: RenewalRegisterItem[]; categories: RenewalCategory[];
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter(item => !term || [item.title, item.vehicleNo, item.reference, item.status, item.expiry]
      .some(value => value.toLowerCase().includes(term)));
  }, [items, query]);

  const expired = visible.filter(item => item.daysUntil < 0);
  const due7 = visible.filter(item => item.daysUntil >= 0 && item.daysUntil <= 7);
  const due30 = visible.filter(item => item.daysUntil > 7 && item.daysUntil <= 30);
  const later = visible.filter(item => item.daysUntil > 30);
  const dueSoonTotal = items.filter(item => item.daysUntil >= 0 && item.daysUntil <= 7).length;
  const expiredTotal = items.filter(item => item.daysUntil < 0).length;
  const laterTotal = items.filter(item => item.daysUntil > 7).length;

  const groups = [
    {title:"Expired",description:"Immediate attention recommended",records:expired,tone:"expired" as const},
    {title:"Due within 7 days",description:"Prioritize these renewals",records:due7,tone:"urgent" as const},
    {title:"Due within 30 days",description:"Plan these renewals next",records:due30,tone:"due" as const},
    {title:"Later",description:"Upcoming after 30 days",records:later,tone:"later" as const},
  ].filter(group => group.records.length > 0);

  return <div className="space-y-4">
    <section className="relative isolate overflow-hidden rounded-2xl border border-[#D6E7FA] bg-[#DDEEFF] text-[#102B54] shadow-[0_6px_24px_rgba(20,58,100,.05)]">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[62%] bg-[url('/customer-insurance-quote-vehicles.svg')] bg-contain bg-right-bottom bg-no-repeat opacity-55" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#EEF7FF] via-[#EEF7FF]/96 via-47% to-transparent" />
      <div className="relative flex min-h-[170px] items-center px-5 py-6 sm:px-7">
        <div className="max-w-[540px]">
          <h1 className="text-[clamp(28px,3.2vw,40px)] font-bold tracking-tight">Renewals</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#4B6C94]">Policies and documents that need your attention.</p>
        </div>
      </div>
    </section>

    <section aria-label="Renewal overview" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[
        {label:"Due soon",value:dueSoonTotal,detail:"Within 7 days",icon:Clock3,tint:"bg-[#FFF7E8] text-[#B66A16]"},
        {label:"Expired",value:expiredTotal,detail:"Past expiry date",icon:AlertTriangle,tint:"bg-[#FFF0F1] text-[#C2414D]"},
        {label:"Later",value:laterTotal,detail:"More than 7 days away",icon:CalendarDays,tint:"bg-[#EAF3FF] text-[#1769DC]"},
      ].map(({label,value,detail,icon:Icon,tint})=><div key={label} className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#E1EAF5] bg-white p-4">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tint}`}><Icon className="h-5 w-5"/></span>
        <span className="min-w-0"><span className="block text-[12px] font-medium text-[#60799B]">{label}</span><strong className="block text-[28px] font-bold leading-tight tabular-nums text-[#102B54]">{value}</strong><small className="block text-[12px] text-[#7890AD]">{detail}</small></span>
      </div>)}
    </section>

    <section className="rounded-2xl border border-[#D8E1EC] bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="flex items-center gap-2 text-[17px] font-bold text-[#102B54]"><CalendarClock className="h-5 w-5 text-[#1769DC]"/>Renewal Register</h2>
          <p className="mt-1 text-[12px] text-[#7186A0]">{items.length} pending item{items.length===1?"":"s"} across {categories.length} renewal categories</p>
        </div>
        <label className="flex w-full min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#D8E1EC] bg-[#FBFCFE] px-3 py-2.5 focus-within:border-[#4E95E9] sm:min-w-[240px] sm:max-w-[410px]">
          <Search className="h-4 w-4 shrink-0 text-[#73829A]"/>
          <span className="sr-only">Search renewals</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search vehicle, policy or reference..." className="w-full min-w-0 border-0 bg-transparent p-0 text-[13px] outline-none"/>
        </label>
      </div>

      {groups.length ? <div className="space-y-5">
        {groups.map(group => <section key={group.title}>
          <div className="mb-2 flex items-end justify-between gap-3">
            <div><h3 className={`text-[14px] font-bold ${group.tone==="expired"?"text-[#A83240]":group.tone==="urgent"?"text-[#9A5C12]":"text-[#29496F]"}`}>{group.title}</h3><p className="mt-0.5 text-[12px] text-[#8193A9]">{group.description}</p></div>
            <span className="text-[12px] font-semibold text-[#60758F]">{group.records.length}</span>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {group.records.map(item => {
              const isExpired = item.daysUntil < 0;
              const isUrgent = item.daysUntil >= 0 && item.daysUntil <= 7;
              const actionHref = item.key === "insurance_policy" && item.reference
                ? { pathname: "/customer/policies", query: { account: accountId, q: item.reference } }
                : { pathname: `/customer/vehicles/${item.vehicleId}`, query: { account: accountId } };
              return <article key={item.id} className="flex flex-col gap-3 rounded-2xl border border-[#E2EAF4] bg-white p-4 sm:flex-row sm:items-center">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${isExpired?"bg-[#FFF0F1] text-[#C2414D]":isUrgent?"bg-[#FFF7E8] text-[#B66A16]":"bg-[#EAF3FF] text-[#1769DC]"}`}><CategoryIcon title={item.title}/></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><strong className="text-[14px] text-[#17345D]">{item.vehicleNo}</strong><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${isExpired?"bg-[#FFF0F1] text-[#C2414D]":isUrgent?"bg-[#FFF7E8] text-[#9A5C12]":"bg-[#EAF3FF] text-[#1769DC]"}`}>{isExpired?"Expired":`${item.daysUntil} days left`}</span></div>
                  <p className="mt-1 text-[13px] font-semibold text-[#3B5678]">{item.title}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#7186A0]"><span>Expiry: <strong className="font-semibold text-[#526A89]">{item.expiry}</strong></span>{item.reference?<span>Reference: <strong className="font-semibold text-[#526A89]">{item.reference}</strong></span>:null}</div>
                </div>
                <Link href={actionHref} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#EAF3FF] px-3 py-2 text-[12px] font-semibold text-[#1769DC] hover:bg-[#DCEBFF]">{item.key==="insurance_policy"?"Review renewal":"View details"} <ArrowRight className="h-3.5 w-3.5"/></Link>
              </article>;
            })}
          </div>
        </section>)}
      </div>:<div className="rounded-xl bg-[#F8FAFD] p-8 text-center text-[14px] text-[#52657F]">{query.trim()?"No matching renewals":"No pending renewals"}</div>}
      <p className="mt-4 text-[12px] font-medium text-[#6A7B93]">Showing {visible.length} of {items.length} pending renewals</p>
    </section>
  </div>;
}
