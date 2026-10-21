"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarClock, FileText, Search, ShieldCheck, CarFront, Clock3, AlertTriangle, ArrowRight, CalendarDays, ChevronDown, ChevronUp } from "lucide-react";

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
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["insurance_policy"]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter(item => !term || [item.title, item.vehicleNo, item.reference, item.status, item.expiry]
      .some(value => value.toLowerCase().includes(term)));
  }, [items, query]);

  const dueSoonTotal = items.filter(item => item.daysUntil >= 0 && item.daysUntil <= 7).length;
  const expiredTotal = items.filter(item => item.daysUntil < 0).length;
  const laterTotal = items.filter(item => item.daysUntil > 7).length;
  const due45Total = items.filter(item => item.daysUntil >= 0 && item.daysUntil <= 45).length;
  const categoryGroups = categories.map(category => {
    const records = visible.filter(item => item.key === category.key);
    return {
      ...category,
      due: records.filter(item => item.daysUntil >= 0 && item.daysUntil <= 45).sort((a, b) => a.daysUntil - b.daysUntil),
      expired: records.filter(item => item.daysUntil < 0).sort((a, b) => b.daysUntil - a.daysUntil),
      upcoming: records.filter(item => item.daysUntil > 45).sort((a, b) => a.daysUntil - b.daysUntil),
    };
  });
  const knownKeys = new Set(categories.map(category => category.key));
  const unmatched = visible.filter(item => !knownKeys.has(item.key));
  if (unmatched.length) {
    categoryGroups.push({
      key: "__other__", title: "Other renewals", count: unmatched.length,
      due: unmatched.filter(item => item.daysUntil >= 0 && item.daysUntil <= 45).sort((a, b) => a.daysUntil - b.daysUntil),
      expired: unmatched.filter(item => item.daysUntil < 0).sort((a, b) => b.daysUntil - a.daysUntil),
      upcoming: unmatched.filter(item => item.daysUntil > 45).sort((a, b) => a.daysUntil - b.daysUntil),
    });
  }
  const toggleCategory = (key: string) => setExpandedCategories(previous =>
    previous.includes(key) ? previous.filter(value => value !== key) : [...previous, key]);

  return <div className="space-y-4">
    <section className="relative isolate overflow-hidden rounded-2xl border border-[#D6E7FA] bg-[#DDEEFF] text-[#102B54] shadow-[0_6px_24px_rgba(20,58,100,.05)]">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[62%] bg-[url('/assets/renewal.jpeg')] bg-contain bg-right-bottom bg-no-repeat opacity-55" />
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

    <section aria-label="Renewal Register" className="space-y-3 rounded-2xl border border-[#D8E1EC] bg-[#F7FAFE] p-3 sm:p-4">
      <div className="rounded-2xl bg-[#0C234D] px-4 py-3 text-white shadow-sm sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-[17px] font-bold">Pending Renewals</h2>
            <p className="mt-0.5 text-[12px] text-[#CEDCF1]">Compliance documents due within 45 days.</p>
          </div>
          <div className="min-w-[58px] rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-center">
            <strong className="block text-[22px] leading-none tabular-nums">{due45Total + expiredTotal}</strong>
            <span className="text-[10px] text-[#D8E5F7]">pending</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#102B54]"><CalendarClock className="h-5 w-5 text-[#1769DC]"/>Renewal Register</h3>
        <div className="flex items-center gap-4 text-[11px] font-semibold text-[#61738D]">
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#C38A20]"/>Due</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#D34545]"/>Expired</span>
        </div>
      </div>
      <label className="flex w-full items-center gap-2 rounded-xl border border-[#D8E1EC] bg-white px-3 py-2.5 focus-within:border-[#4E95E9]">
        <Search className="h-4 w-4 shrink-0 text-[#73829A]"/>
        <span className="sr-only">Search renewals</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search vehicle, document or reference..." className="w-full min-w-0 border-0 bg-transparent p-0 text-[13px] outline-none"/>
      </label>
      <div className="space-y-2">
        {categoryGroups.map(category => {
          const expanded = query.trim() ? true : expandedCategories.includes(category.key);
          const count = category.due.length + category.expired.length + category.upcoming.length;
          return <section key={category.key} className="overflow-hidden rounded-xl border border-[#DFE8F3] bg-white">
            <button type="button" aria-expanded={expanded} aria-controls={`renewal-category-${category.key}`} onClick={() => toggleCategory(category.key)}
              className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-[#F7FAFE] sm:px-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EDF4FF] text-[#1769DC]"><CategoryIcon title={category.title}/></span>
              <span className="min-w-0 flex-1 text-[13px] font-bold text-[#19365B]">{category.title}</span>
              <span className="w-12 text-center text-[12px] font-bold tabular-nums text-[#AE751B]" aria-label={`${category.due.length} due`}>{category.due.length}</span>
              <span className="w-12 text-center text-[12px] font-bold tabular-nums text-[#C64040]" aria-label={`${category.expired.length} expired`}>{category.expired.length}</span>
              {expanded?<ChevronUp className="h-4 w-4 shrink-0 text-[#7D91AC]"/>:<ChevronDown className="h-4 w-4 shrink-0 text-[#7D91AC]"/>}
            </button>
            {expanded && <div id={`renewal-category-${category.key}`} className="space-y-3 border-t border-[#E4ECF5] bg-[#FAFCFF] px-3 py-3 sm:px-4">
              {count===0?<p className="py-2 text-[12px] text-[#7186A0]">No pending renewals in this category.</p>:null}
              {([
                {label:"Due", records:category.due, color:"#B78221", dot:"bg-[#C38A20]"},
                {label:"Expired", records:category.expired, color:"#C64040", dot:"bg-[#D34545]"},
                {label:"Upcoming", records:category.upcoming, color:"#366DA4", dot:"bg-[#5991CD]"},
              ] as const).map(group => group.records.length ? <div key={group.label} className="space-y-2">
                <div className="flex items-center gap-2 text-[12px] font-bold" style={{color:group.color}}>
                  <span className={`h-2 w-2 rounded-full ${group.dot}`}/>{group.label}
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-[#60758F]">{group.records.length}</span>
                </div>
                <div className="grid gap-2 xl:grid-cols-2">
                  {group.records.map(item => {
                    const isExpired = item.daysUntil < 0;
                    const actionHref = item.key === "insurance_policy" && item.reference
                      ? { pathname: "/customer/policies", query: { account: accountId, q: item.reference } }
                      : { pathname: `/customer/vehicles/${item.vehicleId}`, query: { account: accountId } };
                    return <article key={item.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-[#E4EAF2] bg-white p-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${isExpired?"bg-[#FFF0F1] text-[#C64040]":"bg-[#FFF6E6] text-[#B78221]"}`}><CategoryIcon title={item.title}/></span>
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-[12px] text-[#17345D]">{item.vehicleNo}</strong>
                        <span className="block truncate text-[11px] text-[#5B7393]">{item.title}</span>
                        <span className="block text-[10px] text-[#8192AA]">Expiry: {item.expiry}{item.reference?` · Ref: ${item.reference}`:""}</span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${isExpired?"bg-[#FFF0F1] text-[#C64040]":"bg-[#FFF6E6] text-[#A66D16]"}`}>{isExpired?"Expired":`${item.daysUntil}d left`}</span>
                        <Link href={actionHref} className="text-[11px] font-semibold text-[#1769DC] hover:underline">{item.key==="insurance_policy"?"Review renewal":"View details"} <ArrowRight className="inline h-3 w-3"/></Link>
                      </div>
                    </article>;
                  })}
                </div>
              </div>:null)}
            </div>}
          </section>;
        })}
      </div>
      <p className="text-[12px] font-medium text-[#6A7B93]">Showing {visible.length} of {items.length} renewal records</p>
    </section>
  </div>;
}
