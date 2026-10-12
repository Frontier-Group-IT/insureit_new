"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarClock, ChevronDown, ChevronUp, FileText, Search, ShieldCheck, CarFront } from "lucide-react";

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
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter(item => !term || [item.title, item.vehicleNo, item.reference, item.status, item.expiry]
      .some(value => value.toLowerCase().includes(term)));
  }, [items, query]);
  const expiredTotal = items.filter(item => item.daysUntil < 0).length;
  const dueTotal = items.filter(item => item.daysUntil >= 0).length;
  const grouped = categories.map(category => {
    const records = visible.filter(item => item.key === category.key);
    return { ...category, due: records.filter(item => item.daysUntil >= 0), expired: records.filter(item => item.daysUntil < 0) };
  });
  const toggle = (key: string) => setOpenCategories(current =>
    current.includes(key) ? current.filter(value => value !== key) : [...current, key]);

  return <div className="space-y-3">
    <section className="relative isolate overflow-hidden rounded-2xl bg-[#061B3B] text-white">
      <div className="absolute inset-y-0 right-0 w-[67%] bg-[url('/customer-insurance-quote-vehicles.svg')] bg-cover bg-center opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#06162F] via-[#08254C]/95 via-45% to-transparent" />
      <div className="relative flex min-h-[165px] items-center px-5 py-5 sm:min-h-[205px] sm:px-8">
        <h1 className="text-[clamp(24px,3vw,38px)] font-black leading-tight">Policy <span className="text-[#369BFF]">Renewals</span></h1>
      </div>
    </section>

    <section className="rounded-2xl border border-[#D8E1EC] bg-white p-3 shadow-[0_8px_30px_rgba(20,40,75,.04)] sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[17px] font-black text-[#10213D]"><CalendarClock className="h-5 w-5 text-[#175CA8]" aria-hidden="true" />Policy Renewal Register</h2>
        <label className="flex w-full min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#D8E1EC] bg-[#FBFCFE] px-3 py-2.5 focus-within:border-[#4E95E9] sm:min-w-[220px] sm:max-w-[400px]">
          <Search className="h-4 w-4 shrink-0 text-[#73829A]" aria-hidden="true" />
          <span className="sr-only">Search renewals</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search vehicle or reference..." className="w-full min-w-0 border-0 bg-transparent p-0 text-[12px] outline-none" />
        </label>
      </div>
      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-[#071E43] p-3.5 text-white sm:p-4">
        <div>
          <p className="text-sm font-extrabold">Pending Renewals</p>
          <p className="mt-1 text-[11px] text-[#CEDDF2]">{dueTotal} due and {expiredTotal} expired compliance records</p>
        </div>
        <div className="min-w-[65px] rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-center">
          <p className="text-xl font-black leading-none">{expiredTotal}</p>
          <p className="mt-1 text-[10px] text-[#DFE9F9]">Expired</p>
        </div>
      </div>
      <div className="mb-2 flex justify-end gap-4 text-[10px] font-semibold text-[#687991]">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#D99427]" />Due</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#D94A44]" />Expired</span>
      </div>
      <div className="space-y-2">
        {grouped.map(category => {
          const expanded = openCategories.includes(category.key) || (query.trim().length > 0 && category.due.length + category.expired.length > 0);
          return <div key={category.key} className="overflow-hidden rounded-xl border border-[#DDE6F1] bg-white shadow-[0_2px_8px_rgba(15,39,78,.035)]">
            <button type="button" aria-expanded={expanded} onClick={() => toggle(category.key)}
              className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-[#F7FAFE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#267AFF]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EDF4FF] text-[#2169BD]"><CategoryIcon title={category.title} /></span>
              <span className="min-w-0 flex-1 text-[12px] font-extrabold text-[#142746]">{category.title}</span>
              <span className="w-12 text-center text-[12px] font-bold text-[#C78B20]" aria-label={`${category.due.length} due`}>{category.due.length}</span>
              <span className="w-12 text-center text-[12px] font-bold text-[#D94A44]" aria-label={`${category.expired.length} expired`}>{category.expired.length}</span>
              {expanded ? <ChevronUp className="h-4 w-4 text-[#7185A1]" /> : <ChevronDown className="h-4 w-4 text-[#7185A1]" />}
            </button>
            {expanded && <div className="space-y-3 border-t border-[#E8EEF5] bg-[#F9FBFE] p-3">
              {([{ label: "Due", records: category.due, expired: false }, { label: "Expired", records: category.expired, expired: true }]).map(group =>
                <div key={group.label}>
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-bold">
                    <span className={`h-2 w-2 rounded-full ${group.expired ? "bg-[#D94A44]" : "bg-[#D99427]"}`} />
                    <span className={group.expired ? "text-[#C33E38]" : "text-[#B07A1D]"}>{group.label}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-[#62748D]">{group.records.length}</span>
                  </div>
                  {group.records.length === 0 ? <p className="pl-4 text-[11px] text-[#8997AA]">No {group.label.toLowerCase()} records</p> :
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {group.records.map(item => <Link key={item.id}
                        href={{ pathname: `/customer/vehicles/${item.vehicleId}`, query: { account: accountId } }}
                        className="flex items-center gap-2.5 rounded-xl border border-[#E4EAF2] bg-white px-3 py-3 hover:border-[#8EB9EF] hover:bg-[#F3F8FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#267AFF]">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${group.expired ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600"}`}><ShieldCheck className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-extrabold text-[#17345D]">{item.vehicleNo}</span>
                          <span className="block truncate text-[10px] text-[#75859B]">{item.expiry}{item.reference ? ` · ${item.reference}` : ""}</span>
                        </span>
                        <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${group.expired ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
                          {group.expired ? "Expired" : `${item.daysUntil}d left`}
                        </span>
                      </Link>)}
                    </div>}
                </div>)}
            </div>}
          </div>;
        })}
        {grouped.length === 0 && <div className="rounded-xl bg-[#F8FAFD] p-6 text-center text-sm text-[#52657F]">No renewal categories available</div>}
        {query.trim() && visible.length === 0 && <div className="rounded-xl bg-[#F8FAFD] p-6 text-center text-sm text-[#52657F]">No matching renewals</div>}
      </div>
      <p className="mt-3 text-[10px] font-medium text-[#6A7B93]">Showing {visible.length} of {items.length} renewals</p>
    </section>
  </div>;
}
