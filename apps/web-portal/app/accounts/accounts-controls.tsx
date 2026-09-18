"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Loader2 } from "lucide-react";
import { ReconciliationTools } from "./reconciliation-tools";

type Period = "last_month" | "mtd" | "custom";
type Insurer = { id: string; name: string };

type Props = {
  period: Period;
  fromDate: string;
  toDate: string;
  insurerId: string | null;
  insurers: Insurer[];
  exportHref: string;
};

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "last_month", label: "Last month" },
  { value: "mtd", label: "MTD" },
  { value: "custom", label: "Custom" },
];

export function AccountsControls({ period, fromDate, toDate, insurerId, insurers, exportHref }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [from, setFrom] = useState(fromDate);
  const [to, setTo] = useState(toDate);
  const [insurer, setInsurer] = useState(insurerId ?? "");

  useEffect(() => {
    setFrom(fromDate);
    setTo(toDate);
    setInsurer(insurerId ?? "");
  }, [fromDate, toDate, insurerId]);

  const hrefFor = (nextPeriod: Period, nextFrom = from, nextTo = to, nextInsurer = insurer) => {
    const params = new URLSearchParams();
    params.set("period", nextPeriod);
    if (nextPeriod === "custom") {
      params.set("from", nextFrom);
      params.set("to", nextTo);
    }
    if (nextInsurer) params.set("insurer", nextInsurer);
    return `/accounts?${params.toString()}`;
  };

  useEffect(() => {
    for (const standardPeriod of ["last_month", "mtd"] as const) {
      if (standardPeriod !== period) router.prefetch(hrefFor(standardPeriod, fromDate, toDate, insurerId ?? ""));
    }
  }, [router, period, fromDate, toDate, insurerId]);

  const navigate = (nextPeriod: Period, nextFrom = from, nextTo = to, nextInsurer = insurer) => {
    startTransition(() => {
      router.replace(hrefFor(nextPeriod, nextFrom, nextTo, nextInsurer), { scroll: false });
    });
  };

  return <>
    <div className="flex items-center gap-1.5">
      <ReconciliationTools />
      <span className="h-5 w-px bg-[#dce4ee]" aria-hidden="true" />
      <a href={exportHref} title="Export / download Business MIS" aria-label="Export / download Business MIS" className="grid h-8 w-8 place-items-center rounded-lg border border-[#17365D] bg-white text-[#17365D] shadow-sm transition hover:bg-[#f3f7fb]">
        <Download className="h-3.5 w-3.5" />
      </a>
      <div className="flex rounded-lg border border-[#dce4ee] bg-[#f8fafc] p-0.5">
        {PERIODS.map((item) => <button key={item.value} type="button" disabled={isPending} onMouseEnter={() => router.prefetch(hrefFor(item.value))} onFocus={() => router.prefetch(hrefFor(item.value))} onClick={() => navigate(item.value)} className={`rounded-md px-2.5 py-1.5 text-[8px] font-bold transition ${period === item.value ? "bg-[#17365D] text-white shadow-sm" : "text-[#667085] hover:bg-white hover:text-[#17365D]"} disabled:cursor-wait disabled:opacity-70`}>
          {item.label}
        </button>)}
      </div>
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#667085]" aria-label="Updating dashboard" /> : null}
    </div>

    <form onSubmit={(event) => { event.preventDefault(); navigate(period, from, to, insurer); }} className="mt-2 basis-full grid gap-1.5 border-t border-[#edf1f5] pt-2 md:grid-cols-2 xl:grid-cols-[135px_135px_minmax(200px,1fr)_minmax(200px,1fr)_32px]">
      <FilterField label="From"><input name="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} disabled={period !== "custom" || isPending} className="h-8 w-full rounded-lg border border-[#dce4ee] bg-white px-2 text-[8.5px] font-semibold text-[#344054] disabled:bg-[#f6f8fb] disabled:text-[#98a2b3]" /></FilterField>
      <FilterField label="To"><input name="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} disabled={period !== "custom" || isPending} className="h-8 w-full rounded-lg border border-[#dce4ee] bg-white px-2 text-[8.5px] font-semibold text-[#344054] disabled:bg-[#f6f8fb] disabled:text-[#98a2b3]" /></FilterField>
      <FilterField label="Insurer"><select name="insurer" value={insurer} onChange={(event) => setInsurer(event.target.value)} disabled={isPending} className="h-8 w-full rounded-lg border border-[#dce4ee] bg-white px-2 text-[8.5px] font-semibold text-[#344054] disabled:bg-[#f6f8fb] disabled:text-[#98a2b3]"><option value="">All insurers</option>{insurers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FilterField>
      <FilterField label="Branch"><select disabled className="h-8 w-full rounded-lg border border-dashed border-[#d8e1eb] bg-[#f7f9fc] px-2 text-[8.5px] font-semibold text-[#98a2b3]"><option>All branches · Coming soon</option></select></FilterField>
      <button type="submit" disabled={isPending} title="Apply filters" aria-label="Apply filters" className="mt-auto grid h-8 w-8 place-items-center rounded-lg bg-[#17365D] text-white shadow-sm hover:bg-[#234b7a] disabled:cursor-wait disabled:opacity-60">{isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}</button>
    </form>
  </>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-0.5 block text-[7px] font-black uppercase tracking-[.07em] text-[#7c899b]">{label}</span>{children}</label>;
}
